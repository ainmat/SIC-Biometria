import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Filter, RefreshCw, FileText, ChevronRight, Eye, Clipboard, ArrowRight, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Calendar, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { fetchProtocolos, atualizarStatusProtocolo, importarProtocolos, atualizarProtocolo, fetchProtocoloDetalhe } from '../services/protocoloService';
import { lerArquivoXLS, processarLinhasPlanilha } from '../utils/processarProtocoloXLS';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const STATUS_OPCOES = ['Aberto', 'Em Análise', 'Concluído'];
const SECRETARIAS = ['Administração', 'Saúde', 'Educação', 'Finanças', 'Obras', 'Outros'];
const TIPOS = [
  'Abono de Faltas - Atestado Médico',
  'Retificação de Batida de Ponto',
  'Solicitação de Acesso Biométrico',
  'Licença Prêmio',
  'Opção por Acúmulo de Cargo',
  'Outros'
];

const CORES_STATUS = {
  'Aberto': { bg: 'rgba(13, 124, 61, 0.12)', text: '#15A050', border: 'rgba(13, 124, 61, 0.25)' },
  'Em Análise': { bg: 'rgba(245, 158, 11, 0.12)', text: '#b45309', border: 'rgba(245, 158, 11, 0.25)' },
  'Concluído': { bg: 'rgba(16, 185, 129, 0.12)', text: '#047857', border: 'rgba(16, 185, 129, 0.25)' }
};

const CORES_PRIORIDADE = {
  'Baixa': { bg: 'rgba(100, 116, 139, 0.12)', text: '#64748b', border: 'rgba(100, 116, 139, 0.25)' },
  'Normal': { bg: 'rgba(13, 124, 61, 0.12)', text: '#15A050', border: 'rgba(13, 124, 61, 0.25)' },
  'Alta': { bg: 'rgba(245, 158, 11, 0.12)', text: '#b45309', border: 'rgba(245, 158, 11, 0.25)' },
  'Urgente': { bg: 'rgba(239, 68, 68, 0.12)', text: '#dc2626', border: 'rgba(239, 68, 68, 0.25)' }
};

function formatarData(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatarDataSimples(isoStr) {
  if (!isoStr) return '—';
  // Datas no formato YYYY-MM-DD são interpretadas como UTC meia-noite pelo new Date(),
  // o que em GMT-3 mostra o dia anterior. Parseamos manualmente para evitar isso.
  if (typeof isoStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoStr)) {
    const [ano, mes, dia] = isoStr.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function obterIniciais(nome) {
  if (!nome) return '';
  return nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

// Modal de detalhes e tramitação
function DetalhesModal({ protocolo, onClose, onRefresh, operadores, isAdmin, meuNome }) {
  const { sessao } = useAuth();
  const [localProt, setLocalProt] = useState(protocolo);
  
  const [novoStatus, setNovoStatus] = useState(protocolo.status);
  const [observacao, setObservacao] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState('');
  const [editingField, setEditingField] = useState(null);

  useEffect(() => {
    setLocalProt(protocolo);
    setNovoStatus(protocolo.status);
  }, [protocolo]);

  const stStyle = CORES_STATUS[localProt.status] || { bg: 'rgba(0, 0, 0, 0.03)', text: '#1e293b', border: 'rgba(0, 0, 0, 0.06)' };
  const prioStyle = CORES_PRIORIDADE[localProt.prioridade || 'Normal'] || { bg: 'rgba(0, 0, 0, 0.03)', text: '#cbd5e1', border: 'rgba(0, 0, 0, 0.06)' };

  async function handleUpdateField(campo, valor) {
    try {
      setEditingField(null);
      if (campo === 'status') {
        const operador = sessao?.nome || sessao?.username || 'Operador';
        await atualizarStatusProtocolo(localProt.id, valor, `Status alterado no detalhamento`, operador);
      } else {
        await atualizarProtocolo(localProt.id, { [campo]: valor });
      }
      
      const res = await fetchProtocoloDetalhe(localProt.id);
      if (res.data) {
        setLocalProt(res.data);
        setNovoStatus(res.data.status);
      }
      onRefresh();
    } catch (err) {
      alert('Erro ao atualizar: ' + err.message);
    }
  }

  async function handleTramitar(e) {
    e.preventDefault();
    if (!observacao.trim()) {
      setErro('Informe uma justificativa ou observação para a tramitação.');
      return;
    }
    setErro('');
    setSubmitting(true);
    try {
      const operador = sessao?.nome || sessao?.username || 'Administrador';
      await atualizarStatusProtocolo(localProt.id, novoStatus, observacao, operador);
      setObservacao('');
      
      const res = await fetchProtocoloDetalhe(localProt.id);
      if (res.data) {
        setLocalProt(res.data);
        setNovoStatus(res.data.status);
      }
      onRefresh();
    } catch (err) {
      setErro(err.message || 'Erro ao atualizar protocolo');
    } finally {
      setSubmitting(false);
    }
  }

  function extrairAutor(texto) {
    const regex = /^(.*)\s\((.*?)\)$/;
    const match = texto.match(regex);
    if (match) {
      return { mensagem: match[1], autor: match[2] };
    }
    return { mensagem: texto, autor: 'Sistema' };
  }

  const isAtrasado = () => {
    if (!localProt.data_conclusao || localProt.status === 'Concluído') return false;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const parts = localProt.data_conclusao.split('-');
    const conclusao = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    conclusao.setHours(0, 0, 0, 0);
    return conclusao < hoje;
  };
  const atrasado = isAtrasado();

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 680 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Detalhes do Protocolo</div>
          <button className="chamado-modal-close" onClick={onClose}>×</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#15A050', fontFamily: 'monospace' }}>{localProt.numero_protocolo}</div>
        </div>

        <div className="chamado-modal-grid" style={{ marginBottom: 16 }}>
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Requerente</div>
            <div className="chamado-modal-value">{localProt.requerente_nome}</div>
          </div>
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Matrícula</div>
            <div className="chamado-modal-value">{localProt.requerente_matricula || 'Não informada'}</div>
          </div>
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Secretaria</div>
            <div className="chamado-modal-value">{localProt.secretaria}</div>
          </div>
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Tipo de Solicitação</div>
            <div className="chamado-modal-value">{localProt.tipo_solicitacao}</div>
          </div>
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Data de Abertura</div>
            <div className="chamado-modal-value">{formatarData(localProt.data_abertura)}</div>
          </div>
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Prazo Estimado</div>
            <div className="chamado-modal-value">{formatarDataSimples(localProt.prazo_estimado)}</div>
          </div>
          
          {/* Status editável */}
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Status</div>
            <div className="chamado-modal-value" style={{ marginTop: 2 }}>
              {editingField === 'status' ? (
                <select
                  defaultValue={localProt.status}
                  onChange={(e) => handleUpdateField('status', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  autoFocus
                  style={{
                    padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                    border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none'
                  }}
                >
                  {STATUS_OPCOES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              ) : (
                <span 
                  onClick={() => setEditingField('status')}
                  style={{
                    padding: '3px 8px', borderRadius: 6,
                    background: stStyle.bg, color: stStyle.text,
                    border: `1px solid ${stStyle.border}`,
                    fontSize: 11, fontWeight: 600, display: 'inline-block', cursor: 'pointer'
                  }}
                  title="Clique para alterar"
                >
                  {localProt.status}
                </span>
              )}
            </div>
          </div>

          {/* Responsável editável */}
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Responsável</div>
            <div className="chamado-modal-value" style={{ marginTop: 2 }}>
              {editingField === 'responsavel' ? (
                <div style={{ position: 'relative' }}>
                  <select
                    defaultValue={localProt.responsavel || ''}
                    onChange={(e) => handleUpdateField('responsavel', e.target.value || null)}
                    onBlur={() => setEditingField(null)}
                    autoFocus
                    style={{
                      padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                      border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none', width: '100%'
                    }}
                  >
                    <option value="">Ninguém</option>
                    {operadores.map(op => <option key={op} value={op}>{op}</option>)}
                  </select>
                </div>
              ) : localProt.responsavel ? (
                (localProt.responsavel === meuNome || isAdmin) ? (
                  <div 
                    onClick={() => setEditingField('responsavel')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '3px 8px', borderRadius: 20, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0, 0, 0, 0.04)' }}
                    title="Clique para alterar"
                  >
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#0D7C3D', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {obterIniciais(localProt.responsavel)}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text)' }}>{localProt.responsavel}</span>
                  </div>
                ) : (
                  <div 
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'not-allowed', padding: '3px 8px', borderRadius: 20, background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.03)', opacity: 0.5 }}
                    title="Apenas o próprio ou Admin pode alterar"
                  >
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#475569', color: 'var(--muted-c)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {obterIniciais(localProt.responsavel)}
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--muted-c)' }}>{localProt.responsavel}</span>
                  </div>
                )
              ) : (
                <div 
                  onClick={() => setEditingField('responsavel')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '3px 8px', borderRadius: 20, border: '1px dashed rgba(0,0,0,0.18)', color: 'var(--muted-c)' }}
                  title="Atribuir"
                >
                  <Plus size={12} />
                  <span style={{ fontSize: 11 }}>Atribuir</span>
                </div>
              )}
            </div>
          </div>

          {/* Data de Conclusão editável */}
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Data de Conclusão</div>
            <div className="chamado-modal-value" style={{ marginTop: 2 }}>
              {editingField === 'data_conclusao' ? (
                <input
                  type="date"
                  defaultValue={localProt.data_conclusao || ''}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleUpdateField('data_conclusao', e.target.value || null);
                    }
                    if (e.key === 'Escape') setEditingField(null);
                  }}
                  onBlur={(e) => handleUpdateField('data_conclusao', e.target.value || null)}
                  autoFocus
                  style={{
                    padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                    border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none'
                  }}
                />
              ) : localProt.data_conclusao ? (
                <div 
                  onClick={() => setEditingField('data_conclusao')}
                  style={{ fontSize: 12, color: atrasado ? '#ef4444' : 'var(--text)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  title="Clique para alterar"
                >
                  <Calendar size={12} color={atrasado ? '#ef4444' : '#64748b'} />
                  <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{formatarDataSimples(localProt.data_conclusao)}</span>
                </div>
              ) : (
                <div 
                  onClick={() => setEditingField('data_conclusao')}
                  style={{ fontSize: 12, color: 'var(--muted-c)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  title="Definir data"
                >
                  <Calendar size={12} />
                  <span style={{ borderBottom: '1px dashed rgba(0,0,0,0.18)' }}>Definir data</span>
                </div>
              )}
            </div>
          </div>

          {/* Prioridade editável */}
          <div className="chamado-modal-item">
            <div className="chamado-modal-label">Prioridade</div>
            <div className="chamado-modal-value" style={{ marginTop: 2 }}>
              {editingField === 'prioridade' ? (
                <select
                  defaultValue={localProt.prioridade || 'Normal'}
                  onChange={(e) => handleUpdateField('prioridade', e.target.value)}
                  onBlur={() => setEditingField(null)}
                  autoFocus
                  style={{
                    padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                    border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none'
                  }}
                >
                  <option value="Baixa">Baixa</option>
                  <option value="Normal">Normal</option>
                  <option value="Alta">Alta</option>
                  <option value="Urgente">Urgente</option>
                </select>
              ) : (
                <span 
                  onClick={() => setEditingField('prioridade')}
                  style={{
                    padding: '3px 8px', borderRadius: 6,
                    background: prioStyle.bg, color: prioStyle.text,
                    border: `1px solid ${prioStyle.border}`,
                    fontSize: 11, fontWeight: 600, display: 'inline-block', cursor: 'pointer'
                  }}
                  title="Clique para alterar"
                >
                  {localProt.prioridade || 'Normal'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="chamado-modal-item" style={{ marginBottom: 16 }}>
          <div className="chamado-modal-label">Descrição / Motivação</div>
          <div className="chamado-modal-desc" style={{ whiteSpace: 'pre-wrap' }}>{localProt.descricao || 'Nenhuma descrição fornecida.'}</div>
        </div>

        {localProt.documento_anexo && (
          <div className="chamado-modal-item" style={{ marginBottom: 16 }}>
            <div className="chamado-modal-label">Documento Anexo</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#15A050', marginTop: 4 }}>
              <FileText size={14} />
              <a href="#" onClick={e => e.preventDefault()} style={{ color: '#15A050', textDecoration: 'underline' }}>
                {localProt.documento_anexo}
              </a>
            </div>
          </div>
        )}

        <hr style={{ border: 'none', borderTop: '1px solid rgba(0, 0, 0, 0.05)', margin: '20px 0' }} />

        {/* Linha do tempo de tramitação (Estilo Chat) */}
        <div style={{ marginBottom: 20 }}>
          <div className="chamado-modal-label" style={{ marginBottom: 12 }}>Histórico de Tramitação</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 240, overflowY: 'auto', paddingRight: 6 }}>
            {localProt.historico_tramitacao?.map((t, idx) => {
              const { mensagem, autor } = extrairAutor(t.observacao);
              const cs = CORES_STATUS[t.status] || { text: '#64748b', bg: 'rgba(0,0,0,0.05)', border: 'transparent' };
              const iniciais = obterIniciais(autor);
              
              return (
                <div key={idx} style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: 'rgba(13, 124, 61, 0.1)', color: '#0D7C3D', border: '1px solid rgba(13, 124, 61, 0.2)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {iniciais}
                  </div>
                  <div style={{ flex: 1, background: 'rgba(0, 0, 0, 0.02)', border: '1px solid rgba(0,0,0,0.04)', borderRadius: 12, borderTopLeftRadius: 0, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{autor}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{formatarData(t.data)}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 8, whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                      {mensagem}
                    </div>
                    <span style={{ padding: '3px 8px', borderRadius: 6, background: cs.bg, color: cs.text, border: `1px solid ${cs.border}`, fontSize: 10, fontWeight: 700, display: 'inline-block' }}>
                      Status: {t.status}
                    </span>
                  </div>
                </div>
              );
            })}
            {(!localProt.historico_tramitacao || localProt.historico_tramitacao.length === 0) && (
              <div style={{ fontSize: 13, color: 'var(--muted-c)', textAlign: 'center', padding: '20px 0' }}>
                Nenhuma tramitação registrada.
              </div>
            )}
          </div>
        </div>

        {/* Formulário de Nova Tramitação */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-c)', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>Nova Tramitação / Observação</div>
          <form onSubmit={handleTramitar} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <select
                  value={novoStatus}
                  onChange={e => setNovoStatus(e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', borderRadius: 6,
                    background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0, 0, 0, 0.06)',
                    color: 'var(--text)', fontSize: 12, outline: 'none'
                  }}
                >
                  {STATUS_OPCOES.map(st => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
            </div>
            <div>
              <textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Insira um parecer ou observação detalhada..."
                style={{
                  width: '100%', height: 60, padding: '8px 10px', borderRadius: 6,
                  background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0, 0, 0, 0.06)',
                  color: 'var(--text)', fontSize: 12, outline: 'none', resize: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {erro && (
              <div style={{ fontSize: 11, color: '#dc2626', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 10px', borderRadius: 4 }}>
                {erro}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  padding: '6px 14px', borderRadius: 6,
                  background: 'linear-gradient(135deg, #0D7C3D 0%, #0A6B33 100%)',
                  border: 'none', color: '#fff', fontSize: 11, fontWeight: 600,
                  cursor: submitting ? 'wait' : 'pointer'
                }}
              >
                {submitting ? 'Salvando...' : 'Adicionar Observação'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ConsultaProtocolo() {
  const { sessao, isMaster, isAdmin } = useAuth();
  const meuNome = sessao?.nome || sessao?.username;
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [modal, setModal] = useState(null);
  const [modalImportar, setModalImportar] = useState(false);
  const [operadores, setOperadores] = useState([]);

  useEffect(() => {
    async function fetchOperadores() {
      try {
        const { data, error } = await supabase.rpc('listar_usuarios_rpc', { p_token: sessao?.token });
        if (!error && data) {
          const ops = data.filter(u => 
            u.ativo && 
            u.role !== 'viewer' && 
            !u.nome.toLowerCase().includes('teste')
          );
          setOperadores(ops.map(u => u.nome));
        }
      } catch (e) {}
    }
    if (sessao) fetchOperadores();
  }, [sessao]);

  // Abas estilo Asana (Todos vs Meus)
  const [abaAtiva, setAbaAtiva] = useState('todos'); // 'todos' ou 'meus'

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroSecretaria, setFiltroSecretaria] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');

  const tiposDisponiveis = useMemo(() => {
    const ts = new Set(TIPOS);
    dados.forEach(d => {
      if (d.tipo_solicitacao) ts.add(d.tipo_solicitacao);
    });
    return Array.from(ts).sort();
  }, [dados]);

  // Ordenação (Estilo Excel/Asana)
  const [sortField, setSortField] = useState('data_abertura');
  const [sortDirection, setSortDirection] = useState('desc');

  // Estados de Edição Inline (Estilo Asana)
  const [editingPrioId, setEditingPrioId] = useState(null);
  const [editingRespId, setEditingRespId] = useState(null);
  const [editingDateId, setEditingDateId] = useState(null);
  const [editingStatusId, setEditingStatusId] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchProtocolos();
      setDados(res.data);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar protocolos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Filtragem local e Ordenação
  const filtrados = useMemo(() => {
    let res = dados.filter(p => {
      const termo = busca.trim().toLowerCase();
      const matchBusca = !termo ||
        p.numero_protocolo.toLowerCase().includes(termo) ||
        p.requerente_nome.toLowerCase().includes(termo) ||
        (p.requerente_matricula && p.requerente_matricula.includes(termo));
      
      const matchStatus = !filtroStatus || p.status === filtroStatus;
      const matchSec = !filtroSecretaria || p.secretaria === filtroSecretaria;
      const matchTipo = !filtroTipo || p.tipo_solicitacao === filtroTipo;

      return matchBusca && matchStatus && matchSec && matchTipo;
    });

    // Filtro por "Meus Protocolos"
    if (abaAtiva === 'meus') {
      res = res.filter(p => p.responsavel === meuNome);
    }

    if (sortField) {
      res.sort((a, b) => {
        let valA = a[sortField] || '';
        let valB = b[sortField] || '';

        if (sortField === 'data_abertura' || sortField === 'data_conclusao' || sortField === 'prazo_estimado') {
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
        } else if (typeof valA === 'string' && typeof valB === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return res;
  }, [dados, busca, filtroStatus, filtroSecretaria, filtroTipo, sortField, sortDirection, abaAtiva, sessao]);

  const SEL = {
    padding: '7px 10px',
    borderRadius: 8,
    background: 'var(--card-bg)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    color: 'var(--text)',
    fontSize: 12,
    outline: 'none',
    minWidth: 120
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Consulta de Protocolos</h1>
          <p>Localize, analise e faça a tramitação de requerimentos digitais</p>
        </div>
        <div className="topbar-right">
          <button
            onClick={() => setModalImportar(true)}
            title="Importar Planilha XLSX"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8,
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              color: '#047857', fontSize: 12, fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Upload size={14} />
            Importar Planilha
          </button>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* Abas estilo Asana */}
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid rgba(0, 0, 0, 0.04)', marginBottom: 16 }}>
          <button
            onClick={() => setAbaAtiva('todos')}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              color: abaAtiva === 'todos' ? '#0D7C3D' : '#64748b',
              borderBottom: abaAtiva === 'todos' ? '2px solid #0D7C3D' : '2px solid transparent',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none',
              transition: 'color 0.2s, border-color 0.2s'
            }}
          >
            Todos os Protocolos
          </button>
          <button
            onClick={() => setAbaAtiva('meus')}
            style={{
              padding: '10px 16px', background: 'none', border: 'none',
              color: abaAtiva === 'meus' ? '#0D7C3D' : '#64748b',
              borderBottom: abaAtiva === 'meus' ? '2px solid #0D7C3D' : '2px solid transparent',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', outline: 'none',
              transition: 'color 0.2s, border-color 0.2s'
            }}
          >
            Meus Protocolos
          </button>
        </div>

        {/* Barra de Filtros */}
        <div className="chart-card" style={{ padding: '14px 18px', display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border-c)', borderRadius: 8, padding: '6px 12px', flex: 1, minWidth: 200 }}>
            <Search size={15} color="#64748b" />
            <input
              type="text"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por Requerente ou Protocolo..."
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={13} color="#64748b" />
            <select
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
              style={SEL}
            >
              <option value="">Todos os status</option>
              {STATUS_OPCOES.map(st => <option key={st} value={st}>{st}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              value={filtroSecretaria}
              onChange={e => setFiltroSecretaria(e.target.value)}
              style={SEL}
            >
              <option value="">Todas secretarias</option>
              {SECRETARIAS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              style={{ ...SEL, maxWidth: 220 }}
            >
              <option value="">Todos os tipos</option>
              {tiposDisponiveis.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
            </select>
          </div>

          {/* Ordenação - Visual Asana */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>Ordenar:</span>
            <select
              value={sortField}
              onChange={e => setSortField(e.target.value)}
              style={SEL}
            >
              <option value="data_abertura">Data de Abertura</option>
              <option value="numero_protocolo">Número do Protocolo</option>
              <option value="requerente_nome">Requerente</option>
              <option value="data_conclusao">Data de Conclusão</option>
              <option value="prioridade">Prioridade</option>
            </select>
            <button
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              style={{
                padding: '7px 12px', borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)',
                color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 600
              }}
            >
              {sortDirection === 'asc' ? 'Crescente' : 'Decrescente'}
            </button>
          </div>

        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted-c)' }}>Carregando protocolos...</div>
        ) : erro ? (
          <div style={{ padding: '14px 18px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.25)', color: '#dc2626', fontSize: 13 }}>
            <strong>Erro:</strong> {erro}
          </div>
        ) : filtrados.length === 0 ? (
          <div className="chart-card" style={{ textAlign: 'center', padding: 60, color: 'var(--muted-c)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Nenhum protocolo localizado</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Ajuste os filtros ou crie um novo protocolo.</div>
          </div>
        ) : (
          <div className="chart-card" style={{ padding: 0, overflowX: 'auto' }}>
            <table className="unidades-tabela" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
                  <th 
                    onClick={() => {
                      setSortField('numero_protocolo');
                      setSortDirection(prev => sortField === 'numero_protocolo' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                    }}
                    style={{ padding: '14px 18px', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Protocolo
                      {sortField === 'numero_protocolo' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => {
                      setSortField('requerente_nome');
                      setSortDirection(prev => sortField === 'requerente_nome' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                    }}
                    style={{ padding: '14px 18px', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Requerente
                      {sortField === 'requerente_nome' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </div>
                  </th>
                  <th style={{ padding: '14px 18px', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase' }}>Tipo de Demanda</th>
                  <th style={{ padding: '14px 18px', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase' }}>Secretaria</th>
                  <th 
                    onClick={() => {
                      setSortField('data_abertura');
                      setSortDirection(prev => sortField === 'data_abertura' ? (prev === 'asc' ? 'desc' : 'asc') : 'desc');
                    }}
                    style={{ padding: '14px 18px', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Abertura
                      {sortField === 'data_abertura' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => {
                      setSortField('responsavel');
                      setSortDirection(prev => sortField === 'responsavel' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                    }}
                    style={{ padding: '14px 18px', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Responsável
                      {sortField === 'responsavel' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => {
                      setSortField('data_conclusao');
                      setSortDirection(prev => sortField === 'data_conclusao' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                    }}
                    style={{ padding: '14px 18px', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Conclusão
                      {sortField === 'data_conclusao' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => {
                      setSortField('prioridade');
                      setSortDirection(prev => sortField === 'prioridade' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                    }}
                    style={{ padding: '14px 18px', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Prioridade
                      {sortField === 'prioridade' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </div>
                  </th>
                  <th 
                    onClick={() => {
                      setSortField('status');
                      setSortDirection(prev => sortField === 'status' ? (prev === 'asc' ? 'desc' : 'asc') : 'asc');
                    }}
                    style={{ padding: '14px 18px', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Status
                      {sortField === 'status' && (sortDirection === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const st = CORES_STATUS[p.status] || { bg: 'rgba(0, 0, 0, 0.03)', text: '#1e293b', border: 'rgba(0, 0, 0, 0.06)' };
                  const prioStyle = CORES_PRIORIDADE[p.prioridade || 'Normal'] || { bg: 'rgba(0, 0, 0, 0.03)', text: '#cbd5e1', border: 'rgba(0, 0, 0, 0.06)' };
                  
                  const isAtrasado = () => {
                    if (!p.data_conclusao || p.status === 'Concluído') return false;
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    // Parsear data sem timezone shift
                    const parts = p.data_conclusao.split('-');
                    const conclusao = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    conclusao.setHours(0, 0, 0, 0);
                    return conclusao < hoje;
                  };
                  const atrasado = isAtrasado();

                  const obterIniciais = (nome) => {
                    if (!nome) return '';
                    return nome.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
                  };

                  return (
                    <tr 
                      key={p.id} 
                      style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)', cursor: 'pointer' }} 
                      className="table-row"
                      onClick={() => setModal(p)}
                      title="Clique na linha para abrir os detalhes e histórico"
                    >
                      {/* Protocolo */}
                      <td style={{ padding: '14px 18px', fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{p.numero_protocolo}</td>
                      
                      {/* Requerente */}
                      <td style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text)' }}>
                        <div>{p.requerente_nome}</div>
                        {p.requerente_matricula && <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>Mat: {p.requerente_matricula}</div>}
                      </td>
                      
                      {/* Tipo de Demanda */}
                      <td style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text)' }}>{p.tipo_solicitacao}</td>
                      
                      {/* Secretaria */}
                      <td style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text)' }}>{p.secretaria}</td>
                      
                      {/* Abertura */}
                      <td style={{ padding: '14px 18px', fontSize: 13, color: 'var(--text)' }}>{formatarDataSimples(p.data_abertura)}</td>
                      
                      {/* Responsável (Estilo Asana com Bloqueio de Teammates) */}
                      <td style={{ padding: '14px 18px' }} onClick={e => e.stopPropagation()}>
                        {editingRespId === p.id ? (
                          <div style={{ position: 'relative', display: 'inline-block' }}>
                            <div
                              style={{
                                padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                                border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12,
                                display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                                minWidth: 120
                              }}
                            >
                              {p.responsavel || 'Ninguém'}
                            </div>
                            <div
                              style={{
                                position: 'absolute', top: '100%', left: 0, zIndex: 9999,
                                background: 'var(--surface)', border: '1px solid var(--border-c)',
                                borderRadius: 8, padding: 4, minWidth: 200,
                                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                                display: 'flex', flexDirection: 'column', gap: 2,
                                marginTop: 4, maxHeight: 200, overflowY: 'auto'
                              }}
                            >
                              <div
                                onClick={async () => {
                                  setEditingRespId(null);
                                  try {
                                    await atualizarProtocolo(p.id, { responsavel: null });
                                    carregar();
                                  } catch (err) { alert('Erro ao atualizar responsável: ' + err.message); }
                                }}
                                style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 6, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                Ninguém
                              </div>
                              {operadores.map(op => (
                                <div
                                  key={op}
                                  onClick={async () => {
                                    setEditingRespId(null);
                                    try {
                                      await atualizarProtocolo(p.id, { responsavel: op });
                                      carregar();
                                    } catch (err) { alert('Erro ao atualizar responsável: ' + err.message); }
                                  }}
                                  style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 6, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#0D7C3D', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {obterIniciais(op)}
                                  </div>
                                  {op}
                                </div>
                              ))}
                            </div>
                            <div 
                              style={{ position: 'fixed', inset: 0, zIndex: 9998 }} 
                              onClick={(e) => { e.stopPropagation(); setEditingRespId(null); }}
                            />
                          </div>
                        ) : p.responsavel ? (
                          (p.responsavel === meuNome || isAdmin) ? (
                            <div 
                              onClick={() => setEditingRespId(p.id)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '3px 8px', borderRadius: 20, background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0, 0, 0, 0.04)' }}
                              title="Clique para alterar o responsável"
                            >
                              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#0D7C3D', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {obterIniciais(p.responsavel)}
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--text)' }}>{p.responsavel}</span>
                            </div>
                          ) : (
                            <div 
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'not-allowed', padding: '3px 8px', borderRadius: 20, background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.03)', opacity: 0.5 }}
                              title={`Atribuído a ${p.responsavel} (Apenas o próprio ou Admin pode alterar para evitar conflitos)`}
                            >
                              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#475569', color: 'var(--muted-c)', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {obterIniciais(p.responsavel)}
                              </div>
                              <span style={{ fontSize: 12, color: 'var(--muted-c)' }}>{p.responsavel}</span>
                            </div>
                          )
                        ) : (
                          <div 
                            onClick={() => setEditingRespId(p.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '3px 8px', borderRadius: 20, border: '1px dashed rgba(0,0,0,0.18)', color: 'var(--muted-c)' }}
                            title="Atribuir responsável"
                          >
                            <Plus size={12} />
                            <span style={{ fontSize: 11 }}>Atribuir</span>
                          </div>
                        )}
                      </td>

                      {/* Conclusão (Estilo Asana) */}
                      <td style={{ padding: '14px 18px' }} onClick={e => e.stopPropagation()}>
                        {editingDateId === p.id ? (
                          <input
                            type="date"
                            defaultValue={p.data_conclusao || ''}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const nv = e.target.value || null;
                                setEditingDateId(null);
                                try {
                                  await atualizarProtocolo(p.id, { data_conclusao: nv });
                                  carregar();
                                } catch (err) {
                                  alert('Erro ao atualizar data de conclusão: ' + err.message);
                                }
                              } else if (e.key === 'Escape') {
                                setEditingDateId(null);
                              }
                            }}
                            onBlur={async (e) => {
                              const nv = e.target.value || null;
                              setEditingDateId(null);
                              try {
                                await atualizarProtocolo(p.id, { data_conclusao: nv });
                                carregar();
                              } catch (err) {
                                alert('Erro ao atualizar data de conclusão: ' + err.message);
                              }
                            }}
                            autoFocus
                            style={{
                              padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                              border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none', width: 120
                            }}
                          />
                        ) : p.data_conclusao ? (
                          <div 
                            onClick={() => setEditingDateId(p.id)}
                            style={{ fontSize: 12, color: atrasado ? '#ef4444' : '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title={atrasado ? 'Prazo expirado!' : 'Clique para alterar a data'}
                          >
                            <Calendar size={12} color={atrasado ? '#ef4444' : '#64748b'} />
                            <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted' }}>{formatarDataSimples(p.data_conclusao)}</span>
                          </div>
                        ) : (
                          <div 
                            onClick={() => setEditingDateId(p.id)}
                            style={{ fontSize: 12, color: 'var(--muted-c)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            title="Definir data de conclusão"
                          >
                            <Calendar size={12} />
                            <span style={{ borderBottom: '1px dashed rgba(0,0,0,0.18)' }}>Definir data</span>
                          </div>
                        )}
                      </td>

                      {/* Prioridade (Estilo Asana) */}
                      <td style={{ padding: '14px 18px' }} onClick={e => e.stopPropagation()}>
                        {editingPrioId === p.id ? (
                          <select
                            value={p.prioridade || 'Normal'}
                            onChange={async (e) => {
                              const nv = e.target.value;
                              setEditingPrioId(null);
                              try {
                                await atualizarProtocolo(p.id, { prioridade: nv });
                                carregar();
                              } catch (err) {
                                alert('Erro ao atualizar prioridade: ' + err.message);
                              }
                            }}
                            onBlur={() => setEditingPrioId(null)}
                            autoFocus
                            style={{
                              padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                              border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none'
                            }}
                          >
                            <option value="Baixa">Baixa</option>
                            <option value="Normal">Normal</option>
                            <option value="Alta">Alta</option>
                            <option value="Urgente">Urgente</option>
                          </select>
                        ) : (
                          <span 
                            onClick={() => setEditingPrioId(p.id)}
                            style={{
                              padding: '3px 8px', borderRadius: 6,
                              background: prioStyle.bg, color: prioStyle.text,
                              border: `1px solid ${prioStyle.border}`,
                              fontSize: 11, fontWeight: 600, display: 'inline-block', cursor: 'pointer'
                            }}
                            title="Clique para alterar prioridade"
                          >
                            {p.prioridade || 'Normal'}
                          </span>
                        )}
                      </td>

                      {/* Status (Estilo Asana) */}
                      <td style={{ padding: '14px 18px' }} onClick={e => e.stopPropagation()}>
                        {editingStatusId === p.id ? (
                          <select
                            value={p.status}
                            onChange={async (e) => {
                              const nv = e.target.value;
                              setEditingStatusId(null);
                              try {
                                const operador = sessao?.nome || sessao?.username || 'Operador';
                                await atualizarStatusProtocolo(p.id, nv, `Status alterado inline na listagem`, operador);
                                carregar();
                              } catch (err) {
                                alert('Erro ao atualizar status: ' + err.message);
                              }
                            }}
                            onBlur={() => setEditingStatusId(null)}
                            autoFocus
                            style={{
                              padding: '4px 6px', borderRadius: 6, background: 'var(--surface)',
                              border: '1px solid var(--border-c)', color: 'var(--text)', fontSize: 12, outline: 'none'
                            }}
                          >
                            {STATUS_OPCOES.map(stOpt => <option key={stOpt} value={stOpt}>{stOpt}</option>)}
                          </select>
                        ) : (
                          <span 
                            onClick={() => setEditingStatusId(p.id)}
                            style={{
                              padding: '3px 8px', borderRadius: 6,
                              background: st.bg, color: st.text,
                              border: `1px solid ${st.border}`,
                              fontSize: 11, fontWeight: 600, display: 'inline-block', cursor: 'pointer'
                            }}
                            title="Clique para alterar status"
                          >
                            {p.status}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal de Detalhes */}
        {modal && (
          <DetalhesModal
            protocolo={modal}
            onClose={() => setModal(null)}
            onRefresh={carregar}
            operadores={operadores}
            isAdmin={isAdmin}
            meuNome={meuNome}
          />
        )}

        {/* Modal de Importação */}
        {modalImportar && (
          <ImportarModal
            onClose={() => setModalImportar(false)}
            onRefresh={carregar}
          />
        )}
      </div>
    </div>
  );
}

// Modal de importação de planilha
function ImportarModal({ onClose, onRefresh }) {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [prots, setProts] = useState([]);
  const [sucessoMsg, setSucessoMsg] = useState('');

  async function handleFileChange(e) {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    if (!['xls', 'xlsx'].includes(ext)) {
      setErro('Apenas arquivos .xls e .xlsx são aceitos.');
      setFile(null);
      setProts([]);
      return;
    }

    setErro('');
    setFile(selectedFile);
    setLoading(true);

    try {
      const rows = await lerArquivoXLS(selectedFile);
      const parsed = processarLinhasPlanilha(rows);
      setProts(parsed);
    } catch (err) {
      console.error(err);
      setErro(err.message || 'Erro ao processar planilha. Verifique o formato.');
      setProts([]);
      setFile(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmar() {
    if (prots.length === 0) return;
    setLoading(true);
    setErro('');
    try {
      const res = await importarProtocolos(prots);
      setSucessoMsg(`Sucesso! ${res.count} protocolo(s) importado(s) com sucesso.`);
    } catch (err) {
      setErro(err.message || 'Erro ao salvar os protocolos no sistema.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 540 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Importar Planilha de Protocolos</div>
          <button className="chamado-modal-close" onClick={onClose} disabled={loading}>×</button>
        </div>

        {sucessoMsg ? (
          <div style={{ textAlign: 'center', padding: '24px 10px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px'
            }}>
              <CheckCircle size={24} color="#10b981" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{sucessoMsg}</div>
            <button
              onClick={() => { onClose(); onRefresh(); }}
              style={{
                padding: '8px 20px', borderRadius: 8,
                background: 'linear-gradient(135deg, #0D7C3D 0%, #0A6B33 100%)',
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              Concluído
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--muted-c)', lineHeight: '1.5' }}>
              Faça upload do relatório <strong>"Protocolos Aceitar e Receber"</strong> em formato XLS ou XLSX. O sistema identificará automaticamente as colunas correspondentes de forma inteligente.
            </p>

            {!file ? (
              <div style={{
                border: '2px dashed rgba(0, 0, 0, 0.08)', borderRadius: 10,
                padding: '30px 20px', textAlign: 'center', background: 'rgba(0,0,0,.15)',
                cursor: 'pointer', position: 'relative'
              }}>
                <input
                  type="file"
                  onChange={handleFileChange}
                  accept=".xls,.xlsx"
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    opacity: 0, cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(13, 124, 61, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Upload size={20} color="#15A050" />
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Clique para selecionar</span>
                    <span style={{ fontSize: 13, color: 'var(--muted-c)' }}> ou arraste o arquivo aqui</span>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>Formatos aceitos: .XLS e .XLSX</span>
                </div>
              </div>
            ) : (
              <div style={{
                background: 'rgba(13, 124, 61, 0.05)', border: '1px solid rgba(13, 124, 61, 0.15)',
                borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10
              }}>
                <FileSpreadsheet size={20} color="#818cf8" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>{(file.size / 1024).toFixed(1)} KB · {prots.length} protocolo(s) localizado(s)</div>
                </div>
                {!loading && (
                  <button
                    onClick={() => { setFile(null); setProts([]); }}
                    style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                  >
                    Remover
                  </button>
                )}
              </div>
            )}

            {loading && <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 12, color: 'var(--muted-c)' }}>Processando planilha...</div>}
            {erro && (
              <div style={{ fontSize: 12, color: '#dc2626', padding: '10px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 6, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{erro}</span>
              </div>
            )}

            {prots.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Pré-visualização (primeiros 3 itens)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
                  {prots.slice(0, 3).map((p, idx) => (
                    <div key={idx} style={{ background: 'rgba(0,0,0,.02)', border: '1px solid rgba(0, 0, 0, 0.03)', borderRadius: 6, padding: '8px 10px', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, color: '#15A050', fontFamily: 'monospace' }}>{p.numero_protocolo}</span>
                        <span style={{ color: 'var(--muted-c)' }}>{p.secretaria}</span>
                      </div>
                      <div style={{ color: 'var(--text)', fontWeight: 600 }}>{p.requerente_nome}</div>
                      <div style={{ color: 'var(--muted-c)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.tipo_solicitacao} - {p.descricao}</div>
                    </div>
                  ))}
                  {prots.length > 3 && (
                    <div style={{ fontSize: 11, color: 'var(--muted-c)', textAlign: 'center', marginTop: 4 }}>e mais {prots.length - 3} protocolo(s)...</div>
                  )}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '9px 18px', borderRadius: 8,
                  background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)',
                  color: 'var(--muted-c)', fontSize: 13, cursor: 'pointer'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmar}
                disabled={loading || prots.length === 0}
                style={{
                  padding: '9px 20px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #0D7C3D 0%, #0A6B33 100%)',
                  border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: (loading || prots.length === 0) ? 'not-allowed' : 'pointer',
                  opacity: prots.length === 0 ? 0.6 : 1
                }}
              >
                {loading ? 'Processando...' : 'Confirmar Importação'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

