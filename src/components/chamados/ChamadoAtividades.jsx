import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const STATUS_OPCOES = [
  'Aguardando Atendimento',
  'Em Andamento',
  'Atendimento Encerrado',
  'Atendimento Cancelado',
];

function obterIniciais(nome) {
  if (!nome) return 'U';
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function extrairAutor(texto) {
  if (!texto) return { mensagem: '', autor: 'Sistema' };
  const regex = /^(.*)\s\((.*?)\)$/;
  const match = texto.match(regex);
  if (match) {
    return { mensagem: match[1], autor: match[2] };
  }
  return { mensagem: texto, autor: 'Sistema' };
}

function formatarDataHora(dataIso) {
  if (!dataIso) return '';
  try {
    const d = new Date(dataIso);
    if (isNaN(d.getTime())) return dataIso;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dataIso;
  }
}

export default function ChamadoAtividades({ chamado, onChamadoUpdated }) {
  const { sessao } = useAuth();
  const meuNome = sessao?.nome || sessao?.username || 'Usuário';

  const statusAtual = chamado?.status_auvo || chamado?.status || 'Aguardando Atendimento';
  const [novoStatus, setNovoStatus] = useState(statusAtual);
  const [observacao, setObservacao] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState('');
  const [historico, setHistorico] = useState([]);
  const [usandoFallback, setUsandoFallback] = useState(false);

  // Sincroniza o status local quando o chamado selecionado muda
  useEffect(() => {
    if (chamado) {
      setNovoStatus(statusAtual);
      carregarHistorico();
    }
  }, [chamado?.ticket]);

  // Carrega o histórico do banco (com fallback automático se a coluna não existir)
  const carregarHistorico = async () => {
    if (!chamado?.ticket) return;

    try {
      // 1. Tentar ler diretamente da coluna historico_tramitacao na tabela chamados
      const { data, error } = await supabase
        .from('chamados')
        .select('historico_tramitacao')
        .eq('ticket', chamado.ticket)
        .maybeSingle();

      if (!error && data?.historico_tramitacao && Array.isArray(data.historico_tramitacao)) {
        setHistorico(data.historico_tramitacao);
        setUsandoFallback(false);
        return;
      }

      // Se der erro de coluna inexistente (42703), buscar do fallback em configuracoes
      if (error && error.code === '42703') {
        setUsandoFallback(true);
        const { data: confData } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', `chamado_historico_${chamado.ticket}`)
          .maybeSingle();

        if (confData?.valor) {
          try {
            setHistorico(JSON.parse(confData.valor));
          } catch {
            setHistorico([]);
          }
        } else {
          setHistorico([]);
        }
      } else if (chamado.historico_tramitacao && Array.isArray(chamado.historico_tramitacao)) {
        setHistorico(chamado.historico_tramitacao);
      } else {
        setHistorico([]);
      }
    } catch (err) {
      console.warn('Aviso ao carregar histórico do chamado:', err);
      setHistorico([]);
    }
  };

  const handleComentar = async (e) => {
    e.preventDefault();
    if (!observacao.trim()) {
      setErro('Digite um comentário antes de enviar.');
      return;
    }

    setErro('');
    setSubmitting(true);

    try {
      const now = new Date().toISOString();
      const operador = meuNome;
      const novoItem = {
        data: now,
        status: novoStatus,
        observacao: `${observacao.trim()} (${operador})`,
        origem: 'sic',
      };

      const novoHistorico = [...historico, novoItem];

      let salvou = false;

      // 1. Tentar salvar diretamente na coluna historico_tramitacao
      if (!usandoFallback) {
        const { error } = await supabase
          .from('chamados')
          .update({
            historico_tramitacao: novoHistorico,
            status: novoStatus,
            status_auvo: novoStatus,
          })
          .eq('ticket', chamado.ticket);

        if (!error) {
          salvou = true;
        } else if (error.code === '42703') {
          // Coluna ainda não criada no Supabase, ativar fallback
          setUsandoFallback(true);
        } else {
          throw error;
        }
      }

      // 2. Se a coluna ainda não existe, salvar status no chamado e histórico em configuracoes
      if (!salvou) {
        await supabase
          .from('chamados')
          .update({
            status: novoStatus,
            status_auvo: novoStatus,
          })
          .eq('ticket', chamado.ticket);

        await supabase.from('configuracoes').upsert({
          chave: `chamado_historico_${chamado.ticket}`,
          valor: JSON.stringify(novoHistorico),
          descricao: `Histórico de atividades do chamado #${chamado.ticket}`,
        });
      }

      // 3. Sincronização assíncrona bidirecional com a tarefa no Asana
      const textoParaAsana = observacao.trim();
      fetch('/api/comentar-asana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: chamado.ticket,
          observacao: textoParaAsana,
          autor: operador,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            console.warn('Aviso ao sincronizar comentário com Asana:', res.status);
          }
        })
        .catch((err) => {
          console.warn('Aviso de rede ao postar no Asana:', err.message);
        });

      setHistorico(novoHistorico);
      setObservacao('');

      if (onChamadoUpdated) {
        onChamadoUpdated({
          ...chamado,
          status: novoStatus,
          status_auvo: novoStatus,
          historico_tramitacao: novoHistorico,
        });
      }
    } catch (err) {
      console.error('Erro ao salvar comentário:', err);
      setErro(err.message || 'Erro ao registrar comentário.');
    } finally {
      setSubmitting(false);
    }
  };

  // Se o histórico estiver vazio, gerar visualmente a entrada padrão de abertura do chamado
  const historicoExibicao = historico.length > 0 ? historico : [
    {
      data: chamado.data_abertura || chamado.created_at,
      status: chamado.status_auvo || chamado.status || 'Aguardando Atendimento',
      observacao: 'Chamado registrado no sistema de biometria. (Sistema)',
      origem: 'sistema',
    },
  ];

  return (
    <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-c, rgba(0,0,0,0.06))' }}>
      {/* Título da Seção */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
          Todas as atividades
        </div>
        <span style={{ fontSize: 11, color: 'var(--sub)' }}>
          {historicoExibicao.length} {historicoExibicao.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Lista de Atividades Anteriores */}
        {historicoExibicao.map((t, idx) => {
          const { mensagem, autor } = extrairAutor(t.observacao);
          const iniciais = obterIniciais(autor);
          const isSistema = autor === 'Sistema' || autor.toLowerCase().startsWith('sistema');
          const isAsana = t.origem === 'asana' || Boolean(t.asana_gid) || autor.toLowerCase().includes('asana');
          const isSic = t.origem === 'sic' || (!isSistema && !isAsana);

          return (
            <div key={idx} style={{ display: 'flex', gap: 12 }}>
              {/* Avatar com iniciais */}
              <div
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: isAsana
                    ? 'rgba(240, 106, 106, 0.14)'
                    : isSistema
                    ? 'rgba(100, 116, 139, 0.12)'
                    : 'rgba(13, 124, 61, 0.14)',
                  color: isAsana ? '#E04B4B' : isSistema ? '#64748b' : '#0D7C3D',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {iniciais}
              </div>

              {/* Conteúdo do Comentário */}
              <div style={{ flex: 1, paddingTop: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {autor}
                  </span>

                  {isAsana && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(240, 106, 106, 0.12)',
                        color: '#E04B4B',
                      }}
                      title="Comentário importado em tempo real do Asana"
                    >
                      Asana
                    </span>
                  )}

                  {isSic && !isSistema && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: 'rgba(13, 124, 61, 0.1)',
                        color: '#0D7C3D',
                      }}
                      title="Publicado no SIC e sincronizado com o Asana"
                    >
                      SIC ⇄ Asana
                    </span>
                  )}

                  <span style={{ fontSize: 11, color: 'var(--muted-c)', marginLeft: 'auto' }}>
                    {formatarDataHora(t.data)}
                  </span>
                </div>

                <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {mensagem}
                </div>

                {t.status && t.status !== 'Aguardando Atendimento' && (
                  <div style={{ marginTop: 5, fontSize: 11, color: 'var(--muted-c)' }}>
                    → Status: <strong>{t.status}</strong>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Input de Comentário Fixo (Igual ao Protocolo / Asana Style) */}
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          {/* Avatar do Usuário Conectado */}
          <div
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#0D7C3D',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {obterIniciais(meuNome)}
          </div>

          {/* Caixa de Entrada Estilizada */}
          <div
            style={{
              flex: 1,
              border: '1px solid var(--border-c, rgba(0,0,0,0.12))',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--surface, #ffffff)',
            }}
          >
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Adicionar um comentário..."
              rows={2}
              style={{
                width: '100%',
                minHeight: 56,
                padding: '10px 12px',
                border: 'none',
                background: 'transparent',
                color: 'var(--text, #1e293b)',
                fontSize: 13,
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />

            {/* Rodapé da Caixa de Entrada */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.02)',
                padding: '8px 12px',
                borderTop: '1px solid var(--border-c, rgba(0,0,0,0.08))',
              }}
            >
              {/* Seletor de Status */}
              <select
                value={novoStatus}
                onChange={(e) => setNovoStatus(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 4,
                  background: 'var(--surface, #ffffff)',
                  border: '1px solid var(--border-c, rgba(0,0,0,0.15))',
                  color: 'var(--text, #1e293b)',
                  fontSize: 11.5,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {STATUS_OPCOES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              {/* Botão Comentar */}
              <button
                onClick={handleComentar}
                disabled={submitting || !observacao.trim()}
                style={{
                  padding: '6px 14px',
                  borderRadius: 6,
                  background: submitting || !observacao.trim() ? '#8b9cb0' : '#0D7C3D',
                  border: 'none',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: submitting || !observacao.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s, opacity 0.2s',
                }}
              >
                {submitting ? 'Salvando...' : 'Comentar'}
              </button>
            </div>
          </div>
        </div>

        {erro && (
          <div style={{ fontSize: 11, color: '#dc2626', marginTop: -8, paddingLeft: 44 }}>
            {erro}
          </div>
        )}
      </div>
    </div>
  );
}
