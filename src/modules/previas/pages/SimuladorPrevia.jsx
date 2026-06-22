import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, Play, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown,
  Users, Activity, BarChart2, ChevronRight, RotateCcw, Lock, ArrowLeftRight, Download,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { SECRETARIAS, MESES, formatarCompetencia } from '@/modules/previas/constants';
import {
  parseArquivo,
  compararArquivos,
  analisarComHistorico,
  analisarComHistoricoTipado,
  detectarAnomalias,
  classificarOcorrencias,
  labelClassificacao,
  corClassificacao,
  CODIGO_FALTA,
  CODIGO_ATRASO,
} from '@/modules/previas/utils/analise';
import { fetchHistoricoSecretaria, publicarPrevia, verificarPublicacaoExistente } from '@/modules/previas/services/previasService';
import { baixarCSV } from '@/lib/exportar';

const ANOS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

function fmt(n) { return (n || 0).toLocaleString('pt-BR'); }
function fmtPct(n) { return `${n > 0 ? '+' : ''}${n}%`; }

function DeltaBadge({ valor }) {
  if (valor === null || valor === undefined) return <span style={{ color: '#64748b', fontSize: 11 }}>—</span>;
  const cor = valor > 15 ? '#ef4444' : valor > 0 ? '#f59e0b' : '#10b981';
  const Icon = valor > 0 ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: cor, fontSize: 11, fontWeight: 700 }}>
      <Icon size={12} />
      {fmtPct(valor)}
    </span>
  );
}

function AnomaliaCard({ nivel, mensagem, detalhe }) {
  const cor = nivel === 'anomalia_critica' ? '#ef4444' : '#f59e0b';
  const Icon = nivel === 'anomalia_critica' ? XCircle : AlertTriangle;
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 8, border: `1px solid ${cor}22`,
      background: `${cor}11`, display: 'flex', gap: 10, alignItems: 'flex-start',
    }}>
      <Icon size={15} color={cor} style={{ flexShrink: 0, marginTop: 1 }} />
      <div>
        <div style={{ fontSize: 12, color: cor, fontWeight: 600 }}>{mensagem}</div>
        {detalhe && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{detalhe}</div>}
      </div>
    </div>
  );
}

function ComparacaoRow({ label, valor, delta, media }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
      <div style={{ fontSize: 12, color: '#94a3b8' }}>{label}</div>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#64748b' }}>Média hist.: <strong style={{ color: '#94a3b8' }}>{fmt(media)}</strong></span>
        <DeltaBadge valor={delta} />
      </div>
    </div>
  );
}

// P10 — Badge do Z-Score por tipo
function ZScoreBadge({ label, zScore, classificacao, media3m, cor }) {
  if (zScore === null && !media3m) return null;
  const corClass = corClassificacao(classificacao);
  return (
    <div style={{ padding: '10px 14px', borderRadius: 8, background: `${corClass}0d`, border: `1px solid ${corClass}22` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Média 3m: <strong style={{ color: '#e2e8f0' }}>{fmt(media3m)}</strong></div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {zScore !== null ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, color: corClass, fontFamily: 'monospace' }}>
                Z = {zScore > 0 ? '+' : ''}{zScore}
              </div>
              <div style={{ fontSize: 10, color: corClass, marginTop: 1 }}>{labelClassificacao(classificacao)}</div>
            </>
          ) : (
            <div style={{ fontSize: 11, color: '#64748b' }}>Sem histórico suficiente</div>
          )}
        </div>
      </div>
    </div>
  );
}

function parsearNomeArquivo(nome, mesEsperado, anoEsperado) {
  // IMP012026 - 84 SETIDE.TXT → mes=01 ano=2026 codigo=84
  const match = nome.match(/^IMP(\d{2})(\d{4})\s*-\s*(\d+)/i);
  if (!match) return { valido: false, motivo: 'Nome não segue o padrão IMP{MM}{YYYY} - {código} {nome}.TXT' };
  const [, mes, ano, codigoStr] = match;
  if (mes !== mesEsperado) return { valido: false, motivo: `Mês do arquivo (${mes}) ≠ competência selecionada (${mesEsperado})` };
  if (ano !== anoEsperado) return { valido: false, motivo: `Ano do arquivo (${ano}) ≠ competência selecionada (${anoEsperado})` };
  const secretaria = SECRETARIAS.find(s => parseInt(s.numero, 10) === parseInt(codigoStr, 10));
  if (!secretaria) return { valido: false, motivo: `Código ${parseInt(codigoStr, 10)} não encontrado nas secretarias cadastradas` };
  return { valido: true, secretaria };
}

export default function SimuladorPrevia() {
  const { isVisitor } = useAuth();
  const [step, setStep] = useState('config');

  const [secretariaCodigo, setSecretariaCodigo] = useState('');
  const [mesComp, setMesComp] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [anoComp, setAnoComp] = useState(String(new Date().getFullYear()));
  const [arquivo, setArquivo] = useState(null);

  const [validos, setValidos]         = useState([]);
  const [descartados, setDescartados] = useState([]);

  const [historico, setHistorico]         = useState([]);
  const [analise, setAnalise]             = useState(null);
  const [analiseTipada, setAnaliseTipada] = useState(null);
  const [anomalias, setAnomalias]         = useState([]);
  const [classificacao, setClassificacao] = useState(null);

  const [publicando, setPublicando] = useState(false);
  const [publicado, setPublicado]   = useState(false);
  const [jaExiste, setJaExiste]     = useState(false);
  const [erro, setErro]             = useState(null);
  const [mesVazio, setMesVazio]     = useState(false);

  const inputRef = useRef(null);
  const loteRef  = useRef(null);
  const compRefA = useRef(null);
  const compRefB = useRef(null);

  const [modo,           setModo]          = useState('unico'); // 'unico' | 'lote' | 'comparar'
  const [loteItems,      setLoteItems]     = useState([]);
  const [lotePublicando, setLotePublicando] = useState(false);

  const [compArqA,      setCompArqA]      = useState(null); // { nome, validos }
  const [compArqB,      setCompArqB]      = useState(null);
  const [compResultado, setCompResultado] = useState(null);
  const [compSoDiff,    setCompSoDiff]    = useState(false);

  const competencia = `${anoComp}-${mesComp}`;
  const secretariaSelecionada = SECRETARIAS.find(s => s.codigo === secretariaCodigo);
  const secretariaNome = secretariaSelecionada
    ? `${secretariaSelecionada.numero} - ${secretariaSelecionada.sigla}`
    : secretariaCodigo;

  const processarArquivo = useCallback(async (file) => {
    setArquivo(file);
    setErro(null);
    const texto = await file.text();
    const { validos: v, descartados: d } = parseArquivo(texto);
    setValidos(v);
    setDescartados(d);
  }, []);

  const simular = useCallback(async () => {
    if (!secretariaCodigo || (!arquivo && !mesVazio)) return;
    setStep('analisando');
    setErro(null);

    try {
      const [hist, existe] = await Promise.all([
        fetchHistoricoSecretaria(secretariaCodigo, competencia),
        verificarPublicacaoExistente(secretariaCodigo, competencia),
      ]);

      setHistorico(hist);
      setJaExiste(existe);

      const classif = classificarOcorrencias(validos);
      setClassificacao(classif);

      // Análise total (backward compat)
      const an = analisarComHistorico(validos.length, hist);
      setAnalise(an);

      // P10 — Análise tipada por faltas e atrasos
      if (!classif.semCodigo) {
        const anTip = analisarComHistoricoTipado(classif.faltas, classif.atrasos, hist);
        setAnaliseTipada(anTip);
      } else {
        setAnaliseTipada(null);
      }

      setAnomalias(detectarAnomalias(validos, hist));
      setStep('resultado');
    } catch (err) {
      setErro(err.message);
      setStep('config');
    }
  }, [secretariaCodigo, arquivo, validos, competencia, mesVazio]);

  const publicar = useCallback(async () => {
    setPublicando(true);
    setErro(null);
    try {
      await publicarPrevia({ secretariaCodigo, secretariaNome, competencia, registros: validos, analise });
      setPublicado(true);
    } catch (err) {
      setErro(err.message);
    } finally {
      setPublicando(false);
    }
  }, [secretariaCodigo, secretariaNome, competencia, validos, analise]);

  const reiniciar = () => {
    setStep('config'); setArquivo(null); setValidos([]); setDescartados([]);
    setHistorico([]); setAnalise(null); setAnaliseTipada(null);
    setAnomalias([]); setClassificacao(null); setPublicado(false);
    setMesVazio(false); setJaExiste(false); setErro(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const processarLote = useCallback(async (files) => {
    const arr = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.txt'));
    if (!arr.length) return;
    const inicial = arr.map(file => {
      const parse = parsearNomeArquivo(file.name, mesComp, anoComp);
      return {
        file, nome: file.name,
        secretaria: parse.valido ? parse.secretaria : null,
        erroNome:   parse.valido ? null : parse.motivo,
        validos: [], descartados: [],
        status: parse.valido ? 'lendo' : 'rejeitado',
        erroPublicacao: null, jaExiste: false,
      };
    });
    setLoteItems(inicial);
    const resultado = await Promise.all(inicial.map(async item => {
      if (item.status === 'rejeitado') return item;
      try {
        const texto = await item.file.text();
        const { validos: v, descartados: d } = parseArquivo(texto);
        const existe = await verificarPublicacaoExistente(item.secretaria.codigo, competencia);
        return { ...item, validos: v, descartados: d, status: 'pendente', jaExiste: existe };
      } catch (e) {
        return { ...item, status: 'rejeitado', erroNome: e.message };
      }
    }));
    setLoteItems(resultado);
  }, [mesComp, anoComp, competencia]);

  const publicarLote = useCallback(async () => {
    setLotePublicando(true);
    const pendentes = loteItems.filter(i => i.status === 'pendente');
    for (const item of pendentes) {
      setLoteItems(prev => prev.map(p => p.nome === item.nome ? { ...p, status: 'publicando' } : p));
      try {
        await publicarPrevia({
          secretariaCodigo: item.secretaria.codigo,
          secretariaNome:   `${item.secretaria.numero} - ${item.secretaria.sigla}`,
          competencia,
          registros: item.validos,
          analise:   null,
        });
        setLoteItems(prev => prev.map(p => p.nome === item.nome ? { ...p, status: 'publicado' } : p));
      } catch (e) {
        setLoteItems(prev => prev.map(p => p.nome === item.nome ? { ...p, status: 'erro', erroPublicacao: e.message } : p));
      }
    }
    setLotePublicando(false);
  }, [loteItems, competencia]);

  const carregarCompArq = useCallback(async (file, lado) => {
    const texto = await file.text();
    const { validos: v } = parseArquivo(texto);
    const arq = { nome: file.name, validos: v };
    if (lado === 'a') { setCompArqA(arq); setCompResultado(null); }
    else               { setCompArqB(arq); setCompResultado(null); }
  }, []);

  const comparar = useCallback(() => {
    if (!compArqA || !compArqB) return;
    setCompResultado(compararArquivos(compArqA.validos, compArqB.validos));
  }, [compArqA, compArqB]);

  const exportarCompCSV = useCallback(() => {
    if (!compResultado) return;
    const { apenasA, apenasB, alterados, iguais } = compResultado;
    const labels = { apenas_a: 'Apenas em A', apenas_b: 'Apenas em B', alterado: 'Alterado', igual: 'Igual' };
    const todas = [...apenasA, ...apenasB, ...alterados, ...iguais];
    baixarCSV(
      'comparacao_previas.csv',
      ['Matrícula', 'Faltas A', 'Atrasos A', 'Faltas B', 'Atrasos B', 'Δ Faltas', 'Δ Atrasos', 'Status'],
      todas.map(r => [r.matricula, r.faltasA, r.atrasosA, r.faltasB, r.atrasosB,
        r.diffFaltas > 0 ? `+${r.diffFaltas}` : r.diffFaltas,
        r.diffAtrasos > 0 ? `+${r.diffAtrasos}` : r.diffAtrasos,
        labels[r.status] || r.status]),
    );
  }, [compResultado]);

  const podeFiltrar = secretariaCodigo && (arquivo || mesVazio);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Simulador de Prévias</h1>
          <p>Análise e publicação de prévias de frequência</p>
        </div>
        <div className="topbar-right">
          {step !== 'config' && (
            <button
              onClick={reiniciar}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}
            >
              <RotateCcw size={13} />
              Nova Simulação
            </button>
          )}
          <div className="avatar">MC</div>
        </div>
      </div>

      <div className="content">
        {/* ─── ETAPA 1: Configuração ─── */}
        {step === 'config' && (
          <>
            {/* Tabs de modo */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[
                { id: 'unico',    label: 'Arquivo Único', sub: 'Uma secretaria por vez' },
                { id: 'lote',     label: 'Lote',           sub: 'Todas as secretarias de uma vez' },
                { id: 'comparar', label: 'Comparar TXT',   sub: 'Diferenças entre dois arquivos' },
              ].map(({ id, label, sub }) => (
                <button
                  key={id}
                  onClick={() => { setModo(id); setLoteItems([]); setCompResultado(null); if (id !== 'lote') { setArquivo(null); setValidos([]); } }}
                  style={{
                    padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: modo === id ? 'rgba(59,130,246,.18)' : 'rgba(255,255,255,.05)',
                    border: `1px solid ${modo === id ? 'rgba(59,130,246,.4)' : 'rgba(255,255,255,.1)'}`,
                    color: modo === id ? '#60a5fa' : '#64748b',
                  }}
                >
                  {label}
                  <span style={{ display: 'block', fontSize: 10, fontWeight: 400, color: modo === id ? '#3b82f6' : '#475569', marginTop: 1 }}>{sub}</span>
                </button>
              ))}
            </div>

            {/* ── MODO LOTE ── */}
            {modo === 'lote' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="chart-card">
                  <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, alignItems: 'start' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>Competência</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        <select value={mesComp} onChange={e => { setMesComp(e.target.value); setLoteItems([]); if (loteRef.current) loteRef.current.value = ''; }} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,.1)', color: '#f1f5f9', fontSize: 13 }}>
                          {MESES.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                        </select>
                        <select value={anoComp} onChange={e => { setAnoComp(e.target.value); setLoteItems([]); if (loteRef.current) loteRef.current.value = ''; }} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,.1)', color: '#f1f5f9', fontSize: 13 }}>
                          {ANOS.map(a => <option key={a} value={String(a)}>{a}</option>)}
                        </select>
                      </div>
                      <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 6 }}>Competência: {formatarCompetencia(competencia)}</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 10, lineHeight: 1.6 }}>
                        A secretaria é detectada automaticamente pelo nome do arquivo.<br />
                        Padrão: <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>IMP{mesComp}{anoComp} - {'{código}'} {'{nome}'}.TXT</span>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>Arquivos das Prévias</label>
                      <div
                        style={{
                          border: `2px dashed ${loteItems.length > 0 ? 'rgba(59,130,246,.4)' : 'rgba(255,255,255,.1)'}`,
                          borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                          background: loteItems.length > 0 ? 'rgba(59,130,246,.04)' : 'transparent',
                        }}
                        onClick={() => loteRef.current?.click()}
                        onDragOver={e => e.preventDefault()}
                        onDrop={e => { e.preventDefault(); processarLote(e.dataTransfer.files); }}
                      >
                        <input ref={loteRef} type="file" accept=".txt" multiple style={{ display: 'none' }} onChange={e => processarLote(e.target.files)} />
                        {loteItems.length === 0 ? (
                          <>
                            <Upload size={24} color="#64748b" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontSize: 13, color: '#64748b' }}>Arraste todos os arquivos .txt ou clique para selecionar</div>
                            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Exemplo: IMP012026 - 57 SED.TXT · IMP012026 - 58 SS.TXT</div>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={24} color="#10b981" style={{ margin: '0 auto 8px' }} />
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                              {loteItems.length} arquivo{loteItems.length !== 1 ? 's' : ''} carregados
                            </div>
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                              {loteItems.filter(i => i.status !== 'rejeitado' && i.status !== 'erro').length} válidos
                              {' · '}
                              {loteItems.filter(i => i.status === 'rejeitado' || i.status === 'erro').length} rejeitados
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); setLoteItems([]); if (loteRef.current) loteRef.current.value = ''; }}
                              style={{ marginTop: 8, fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              Limpar e recarregar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tabela de resultados do lote */}
                {loteItems.length > 0 && (
                  <div className="table-card">
                    <div className="chart-header" style={{ marginBottom: 16 }}>
                      <div>
                        <div className="chart-title">Resultado do Lote</div>
                        <div className="chart-sub">
                          {loteItems.filter(i => i.status === 'publicado').length} publicados
                          {' · '}
                          {loteItems.filter(i => i.status === 'pendente' || i.status === 'lendo').length} pendentes
                          {' · '}
                          {loteItems.filter(i => i.status === 'rejeitado' || i.status === 'erro').length} rejeitados
                        </div>
                      </div>
                      {loteItems.some(i => i.status === 'pendente') && !isVisitor && (
                        <button
                          onClick={publicarLote}
                          disabled={lotePublicando}
                          style={{
                            padding: '8px 18px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 12,
                            background: lotePublicando ? 'rgba(59,130,246,.4)' : '#3b82f6',
                            color: '#fff', cursor: lotePublicando ? 'wait' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                          }}
                        >
                          <CheckCircle size={13} />
                          {lotePublicando
                            ? 'Publicando...'
                            : `Publicar Todos (${loteItems.filter(i => i.status === 'pendente').length})`}
                        </button>
                      )}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Arquivo</th>
                            <th style={{ textAlign: 'center' }}>Secretaria</th>
                            <th style={{ textAlign: 'center' }}>Válidos</th>
                            <th style={{ textAlign: 'center' }}>Já publicado?</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loteItems.map((item, idx) => {
                            const cor = item.secretaria
                              ? (SECRETARIAS.find(s => s.codigo === item.secretaria.codigo)?.cor || '#64748b')
                              : '#ef4444';
                            return (
                              <tr key={idx}>
                                <td style={{ maxWidth: 240 }}>
                                  <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.nome}
                                  </div>
                                  {item.erroNome && (
                                    <div style={{ fontSize: 10, color: '#f87171', marginTop: 2 }}>{item.erroNome}</div>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {item.secretaria ? (
                                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6, background: `${cor}18`, color: cor, fontWeight: 700 }}>
                                      {item.secretaria.numero} · {item.secretaria.sigla}
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: 11, color: '#475569' }}>—</span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'center', fontSize: 12, fontWeight: 700 }}>
                                  {item.status === 'lendo'    ? <span style={{ color: '#64748b' }}>...</span>
                                  : item.status === 'rejeitado' ? <span style={{ color: '#475569' }}>—</span>
                                  : <span style={{ color: item.validos.length > 0 ? '#60a5fa' : '#64748b' }}>{item.validos.length}</span>}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  {item.status === 'rejeitado' || item.status === 'lendo'
                                    ? <span style={{ color: '#475569' }}>—</span>
                                    : item.jaExiste
                                      ? <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(245,158,11,.12)', color: '#f59e0b', fontWeight: 700 }}>Sim — será substituído</span>
                                      : <span style={{ fontSize: 10, color: '#475569' }}>Não</span>}
                                </td>
                                <td style={{ textAlign: 'center', minWidth: 100 }}>
                                  {item.status === 'lendo'      && <span style={{ fontSize: 11, color: '#60a5fa' }}>Lendo...</span>}
                                  {item.status === 'pendente'   && <span style={{ fontSize: 11, color: '#94a3b8' }}>Aguardando</span>}
                                  {item.status === 'publicando' && <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>Publicando...</span>}
                                  {item.status === 'publicado'  && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>✓ Publicado</span>}
                                  {item.status === 'rejeitado'  && <span style={{ fontSize: 11, color: '#f87171' }}>✗ Rejeitado</span>}
                                  {item.status === 'erro' && (
                                    <div>
                                      <span style={{ fontSize: 11, color: '#f87171' }}>✗ Erro</span>
                                      {item.erroPublicacao && <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>{item.erroPublicacao}</div>}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── MODO COMPARAR ── */}
            {modo === 'comparar' && (() => {
              const statusCor   = { apenas_a: '#f87171', apenas_b: '#34d399', alterado: '#f59e0b', igual: '#64748b' };
              const statusLabel = { apenas_a: 'Apenas A', apenas_b: 'Apenas B', alterado: 'Alterado', igual: 'Igual' };
              const linhasVisiveis = compResultado
                ? (compSoDiff
                    ? [...compResultado.apenasA, ...compResultado.apenasB, ...compResultado.alterados]
                    : [...compResultado.apenasA, ...compResultado.apenasB, ...compResultado.alterados, ...compResultado.iguais])
                : [];

              function ZoneComp({ lado, arq, refEl, onChange }) {
                const cor = lado === 'a' ? '#60a5fa' : '#34d399';
                return (
                  <div className="chart-card">
                    <div style={{ fontSize: 10, color: '#64748b', fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                      Arquivo {lado.toUpperCase()} {lado === 'a' ? '— base' : '— comparação'}
                    </div>
                    <div
                      style={{
                        border: `2px dashed ${arq ? cor + '66' : 'rgba(255,255,255,.1)'}`,
                        borderRadius: 10, padding: '20px 14px', textAlign: 'center', cursor: 'pointer',
                        background: arq ? cor + '08' : 'transparent',
                      }}
                      onClick={() => refEl.current?.click()}
                      onDragOver={e => e.preventDefault()}
                      onDrop={e => { e.preventDefault(); onChange(e.dataTransfer.files[0]); }}
                    >
                      <input ref={refEl} type="file" accept=".txt" style={{ display: 'none' }} onChange={e => onChange(e.target.files[0])} />
                      {arq ? (
                        <>
                          <CheckCircle size={22} color={cor} style={{ margin: '0 auto 6px' }} />
                          <div style={{ fontSize: 12, color: '#f1f5f9', fontWeight: 600 }}>{arq.nome}</div>
                          <div style={{ fontSize: 11, color: cor, marginTop: 4 }}>
                            {arq.validos.length} registros válidos
                            {' · '}
                            {new Set(arq.validos.map(r => r.matricula)).size} matrículas
                          </div>
                          <button
                            onClick={e => { e.stopPropagation(); onChange(null); }}
                            style={{ marginTop: 8, fontSize: 10, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                          >
                            Trocar arquivo
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload size={22} color="#64748b" style={{ margin: '0 auto 6px' }} />
                          <div style={{ fontSize: 12, color: '#64748b' }}>Arraste o .txt ou clique</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Zonas de upload */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <ZoneComp
                      lado="a" arq={compArqA} refEl={compRefA}
                      onChange={f => f ? carregarCompArq(f, 'a') : setCompArqA(null)}
                    />
                    <ZoneComp
                      lado="b" arq={compArqB} refEl={compRefB}
                      onChange={f => f ? carregarCompArq(f, 'b') : setCompArqB(null)}
                    />
                  </div>

                  {/* Botão comparar */}
                  {compArqA && compArqB && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <button
                        onClick={comparar}
                        style={{
                          padding: '10px 28px', borderRadius: 8, border: 'none', background: '#3b82f6',
                          color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}
                      >
                        <ArrowLeftRight size={14} />
                        Comparar arquivos
                      </button>
                    </div>
                  )}

                  {/* Resultado da comparação */}
                  {compResultado && (() => {
                    const { apenasA, apenasB, alterados, iguais, totalA, totalB } = compResultado;
                    return (
                      <>
                        {/* KPIs */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                          {[
                            { label: 'Matrículas em A', value: totalA,          cor: '#60a5fa' },
                            { label: 'Matrículas em B', value: totalB,          cor: '#34d399' },
                            { label: 'Apenas em A',     value: apenasA.length,  cor: '#f87171' },
                            { label: 'Apenas em B',     value: apenasB.length,  cor: '#34d399' },
                            { label: 'Alterados',       value: alterados.length, cor: '#f59e0b' },
                            { label: 'Iguais',          value: iguais.length,   cor: '#64748b' },
                          ].map(({ label, value, cor }) => (
                            <div key={label} className="kpi-card" style={{ padding: '12px 14px' }}>
                              <div className="kpi-label" style={{ fontSize: 10 }}>{label}</div>
                              <div className="kpi-value" style={{ color: cor, fontSize: 22 }}>{fmt(value)}</div>
                            </div>
                          ))}
                        </div>

                        {/* Tabela */}
                        <div className="table-card">
                          <div className="chart-header" style={{ marginBottom: 12 }}>
                            <div>
                              <div className="chart-title">Servidores com diferença</div>
                              <div className="chart-sub">{linhasVisiveis.length} linha{linhasVisiveis.length !== 1 ? 's' : ''} exibida{linhasVisiveis.length !== 1 ? 's' : ''}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, color: '#94a3b8' }}>
                                <input
                                  type="checkbox"
                                  checked={compSoDiff}
                                  onChange={e => setCompSoDiff(e.target.checked)}
                                  style={{ accentColor: '#3b82f6' }}
                                />
                                Apenas diferenças
                              </label>
                              <button
                                onClick={exportarCompCSV}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,.1)',
                                  background: 'rgba(255,255,255,.05)', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
                                }}
                              >
                                <Download size={12} />
                                Exportar CSV
                              </button>
                            </div>
                          </div>
                          <div style={{ overflowX: 'auto' }}>
                            <table>
                              <thead>
                                <tr>
                                  <th>Matrícula</th>
                                  <th style={{ textAlign: 'center', color: '#60a5fa' }}>Faltas A</th>
                                  <th style={{ textAlign: 'center', color: '#34d399' }}>Faltas B</th>
                                  <th style={{ textAlign: 'center' }}>Δ Faltas</th>
                                  <th style={{ textAlign: 'center', color: '#60a5fa' }}>Atrasos A</th>
                                  <th style={{ textAlign: 'center', color: '#34d399' }}>Atrasos B</th>
                                  <th style={{ textAlign: 'center' }}>Δ Atrasos</th>
                                  <th style={{ textAlign: 'center' }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {linhasVisiveis.map((r, i) => {
                                  const cor = statusCor[r.status];
                                  const fmtDiff = d => d === 0 ? <span style={{ color: '#475569' }}>—</span>
                                    : <span style={{ color: d > 0 ? '#f87171' : '#34d399', fontWeight: 700 }}>{d > 0 ? `+${d}` : d}</span>;
                                  return (
                                    <tr key={i} style={{ background: r.status === 'igual' ? undefined : `${cor}08` }}>
                                      <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.matricula}</td>
                                      <td style={{ textAlign: 'center', fontSize: 11 }}>{r.faltasA || '—'}</td>
                                      <td style={{ textAlign: 'center', fontSize: 11 }}>{r.faltasB || '—'}</td>
                                      <td style={{ textAlign: 'center' }}>{fmtDiff(r.diffFaltas)}</td>
                                      <td style={{ textAlign: 'center', fontSize: 11 }}>{r.atrasosA || '—'}</td>
                                      <td style={{ textAlign: 'center', fontSize: 11 }}>{r.atrasosB || '—'}</td>
                                      <td style={{ textAlign: 'center' }}>{fmtDiff(r.diffAtrasos)}</td>
                                      <td style={{ textAlign: 'center' }}>
                                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${cor}18`, color: cor, fontWeight: 700 }}>
                                          {statusLabel[r.status]}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                                {linhasVisiveis.length === 0 && (
                                  <tr>
                                    <td colSpan={8} style={{ textAlign: 'center', color: '#64748b', padding: '24px 0', fontSize: 12 }}>
                                      {compSoDiff ? 'Nenhuma diferença encontrada — os arquivos são idênticos.' : 'Nenhum registro.'}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ marginTop: 10, fontSize: 10, color: '#475569', lineHeight: 1.5 }}>
                            Esta aba é somente leitura — nenhum dado é publicado ou salvo.
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              );
            })()}

            {/* ── MODO ARQUIVO ÚNICO (original) ── */}
            {modo === 'unico' && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="chart-card">
              <div className="chart-title" style={{ marginBottom: 20 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color="#60a5fa" />
                  Configuração da Simulação
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>Secretaria</label>
                  <select
                    value={secretariaCodigo}
                    onChange={e => setSecretariaCodigo(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,.1)', color: secretariaCodigo ? '#f1f5f9' : '#64748b', fontSize: 13 }}
                  >
                    <option value="">Selecione a secretaria...</option>
                    {SECRETARIAS.map(s => (
                      <option key={s.codigo} value={s.codigo}>{s.numero} - {s.sigla}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>Competência</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <select value={mesComp} onChange={e => setMesComp(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,.1)', color: '#f1f5f9', fontSize: 13 }}>
                      {MESES.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
                    </select>
                    <select value={anoComp} onChange={e => setAnoComp(e.target.value)} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--card-bg)', border: '1px solid rgba(255,255,255,.1)', color: '#f1f5f9', fontSize: 13 }}>
                      {ANOS.map(a => <option key={a} value={String(a)}>{a}</option>)}
                    </select>
                  </div>
                  <div style={{ fontSize: 11, color: '#60a5fa', marginTop: 6 }}>Competência: {formatarCompetencia(competencia)}</div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#94a3b8', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.05em' }}>Arquivo da Prévia</label>
                  <div
                    style={{ border: `2px dashed ${arquivo ? 'rgba(59,130,246,.4)' : 'rgba(255,255,255,.1)'}`, borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .2s', background: arquivo ? 'rgba(59,130,246,.04)' : 'transparent' }}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); processarArquivo(e.dataTransfer.files[0]); }}
                  >
                    <input ref={inputRef} type="file" accept=".txt" style={{ display: 'none' }} onChange={e => processarArquivo(e.target.files[0])} />
                    {arquivo ? (
                      <div>
                        <CheckCircle size={24} color="#10b981" style={{ margin: '0 auto 8px' }} />
                        <div style={{ fontSize: 13, color: '#f1f5f9', fontWeight: 600 }}>{arquivo.name}</div>
                        <div style={{ fontSize: 11, color: '#10b981', marginTop: 4 }}>{validos.length} registros válidos · {descartados.length} descartados</div>
                      </div>
                    ) : (
                      <div>
                        <Upload size={24} color="#64748b" style={{ margin: '0 auto 8px' }} />
                        <div style={{ fontSize: 13, color: '#64748b' }}>Arraste o arquivo .txt ou clique</div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Formato posicional ou delimitado</div>
                      </div>
                    )}
                  </div>
                </div>

                {!arquivo && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '8px 0' }}>
                    <input type="checkbox" checked={mesVazio} onChange={e => setMesVazio(e.target.checked)} style={{ width: 14, height: 14, accentColor: '#3b82f6' }} />
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>
                      Este mês <strong style={{ color: '#f1f5f9' }}>não possui arquivo</strong> — registrar competência com 0 ocorrências
                    </span>
                  </label>
                )}

                {erro && (
                  <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', color: '#f87171', fontSize: 12 }}>{erro}</div>
                )}

                <button
                  onClick={simular}
                  disabled={!podeFiltrar}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: 'none', cursor: podeFiltrar ? 'pointer' : 'not-allowed',
                    background: podeFiltrar ? '#3b82f6' : 'rgba(255,255,255,.06)', color: podeFiltrar ? '#fff' : '#475569',
                    fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background .2s',
                  }}
                >
                  <Play size={14} /> Simular e Analisar <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Preview dos registros */}
            <div className="chart-card" style={{ overflowY: 'auto', maxHeight: 480 }}>
              <div className="chart-title" style={{ marginBottom: 16 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><BarChart2 size={16} color="#60a5fa" />Preview do Arquivo</span>
              </div>
              {!arquivo ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 280, color: '#475569' }}>
                  <FileText size={40} style={{ marginBottom: 12, opacity: .4 }} />
                  <div style={{ fontSize: 13 }}>Nenhum arquivo carregado</div>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Registros válidos', value: validos.length, cor: '#10b981' },
                      { label: 'Descartados', value: descartados.length, cor: descartados.length > 0 ? '#f87171' : '#10b981' },
                    ].map(({ label, value, cor }) => (
                      <div key={label} className="chamado-modal-item">
                        <div className="chamado-modal-label">{label}</div>
                        <div className="chamado-modal-value" style={{ color: cor, fontSize: 18, fontWeight: 700 }}>{fmt(value)}</div>
                      </div>
                    ))}
                  </div>
                  <table>
                    <thead><tr>
                      <th>#</th><th>Matrícula</th>
                      {validos[0]?.data_ocorrencia && <th>Data</th>}
                      {validos[0]?.codigo_ocorrencia && <th>Cód.</th>}
                      <th style={{ textAlign: 'right' }}>% Desc.</th>
                    </tr></thead>
                    <tbody>
                      {validos.slice(0, 12).map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontFamily: 'monospace', fontSize: 10, color: '#475569' }}>{i + 1}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.matricula}</td>
                          {validos[0]?.data_ocorrencia && <td style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b' }}>{r.data_ocorrencia}</td>}
                          {validos[0]?.codigo_ocorrencia && <td style={{ fontFamily: 'monospace', fontSize: 10, color: '#64748b' }}>{r.codigo_ocorrencia}</td>}
                          <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: r.percentual_desconto > 0 ? '#f87171' : '#94a3b8' }}>{r.percentual_desconto}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validos.length > 12 && <div style={{ textAlign: 'center', color: '#475569', fontSize: 11, marginTop: 8 }}>+ {validos.length - 12} registros</div>}
                </>
              )}
            </div>
          </div>}
          </>
        )}

        {/* ─── ETAPA 2: Analisando ─── */}
        {step === 'analisando' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 16 }}>
            <div style={{ width: 48, height: 48, border: '3px solid rgba(59,130,246,.3)', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div style={{ color: '#60a5fa', fontSize: 14 }}>Carregando histórico e calculando análise...</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ─── ETAPA 3: Resultado ─── */}
        {step === 'resultado' && analise && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Banner secretaria + competência */}
            <div className="chart-card" style={{ background: 'rgba(59,130,246,.08)', border: '1px solid rgba(59,130,246,.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Análise da Prévia</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>{secretariaNome}</div>
                  <div style={{ fontSize: 14, color: '#60a5fa' }}>Competência: {formatarCompetencia(competencia)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Classificação (Total)</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: corClassificacao(analise.classificacao) }}>
                    {labelClassificacao(analise.classificacao)}
                  </div>
                  {analise.zScore !== null && (
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Z-Score total: {analise.zScore > 0 ? '+' : ''}{analise.zScore}</div>
                  )}
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div className="kpi-card">
                <div className="kpi-accent" style={{ background: '#3b82f6' }} />
                <div className="kpi-label"><Activity size={13} />Total de Ocorrências</div>
                <div className="kpi-value" style={{ color: '#3b82f6', fontSize: 26 }}>{fmt(validos.length)}</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-accent" style={{ background: '#ef4444' }} />
                <div className="kpi-label"><XCircle size={13} />Faltas <span style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>(cód. 171)</span></div>
                <div className="kpi-value" style={{ color: '#ef4444', fontSize: 26 }}>
                  {classificacao?.semCodigo ? <span style={{ fontSize: 14, color: '#64748b' }}>N/D</span> : fmt(classificacao?.faltas ?? 0)}
                </div>
                {!classificacao?.semCodigo && classificacao?.faltas > 0 && (
                  <div className="kpi-footer">
                    <span className="kpi-tag" style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444' }}>
                      {Math.round((classificacao.faltas / validos.length) * 100)}% do total
                    </span>
                  </div>
                )}
              </div>
              <div className="kpi-card">
                <div className="kpi-accent" style={{ background: '#f59e0b' }} />
                <div className="kpi-label"><AlertTriangle size={13} />Atrasos <span style={{ fontSize: 10, color: '#64748b', fontWeight: 400 }}>(cód. 335)</span></div>
                <div className="kpi-value" style={{ color: '#f59e0b', fontSize: 26 }}>
                  {classificacao?.semCodigo ? <span style={{ fontSize: 14, color: '#64748b' }}>N/D</span> : fmt(classificacao?.atrasos ?? 0)}
                </div>
                {!classificacao?.semCodigo && classificacao?.atrasos > 0 && (
                  <div className="kpi-footer">
                    <span className="kpi-tag" style={{ background: 'rgba(245,158,11,.12)', color: '#f59e0b' }}>
                      {Math.round((classificacao.atrasos / validos.length) * 100)}% do total
                    </span>
                  </div>
                )}
              </div>
              <div className="kpi-card">
                <div className="kpi-accent" style={{ background: '#8b5cf6' }} />
                <div className="kpi-label"><Users size={13} />Servidores Impactados</div>
                <div className="kpi-value" style={{ color: '#8b5cf6', fontSize: 26 }}>
                  {fmt(new Set(validos.map(r => r.matricula)).size)}
                </div>
              </div>
            </div>

            {/* Composição */}
            {classificacao && (
              <div className="chart-card" style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Composição das Ocorrências</div>
                  {classificacao.semCodigo && <span style={{ fontSize: 11, color: '#64748b' }}>Arquivo sem código de ocorrência</span>}
                </div>
                {validos.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', padding: '4px 0' }}>
                    <CheckCircle size={15} />
                    <span style={{ fontSize: 13 }}>
                      {mesVazio ? 'Mês sem arquivo — competência com 0 ocorrências' : 'Arquivo sem ocorrências válidas'}
                    </span>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,.06)', marginBottom: 8 }}>
                      {classificacao.faltas  > 0 && <div style={{ width: `${(classificacao.faltas  / validos.length) * 100}%`, background: '#ef4444' }} />}
                      {classificacao.atrasos > 0 && <div style={{ width: `${(classificacao.atrasos / validos.length) * 100}%`, background: '#f59e0b' }} />}
                      {classificacao.outros  > 0 && <div style={{ flex: 1, background: '#334155' }} />}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Faltas (171)',  value: classificacao.faltas,  cor: '#ef4444' },
                        { label: 'Atrasos (335)', value: classificacao.atrasos, cor: '#f59e0b' },
                        ...(classificacao.outros > 0 ? [{ label: 'Outros', value: classificacao.outros, cor: '#64748b' }] : []),
                      ].map(({ label, value, cor }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: cor, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>{label}:</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: cor }}>{fmt(value)}</span>
                        </div>
                      ))}
                    </div>
                    {classificacao.outrosCodigos?.length > 0 && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)' }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>Outros códigos encontrados:</div>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {classificacao.outrosCodigos.map(([cod, qtd]) => (
                            <span key={cod} style={{ padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.08)', fontSize: 11, fontFamily: 'monospace', color: '#94a3b8' }}>
                              {cod} <strong style={{ color: '#f1f5f9' }}>×{qtd}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* P10 — Z-Scores por tipo */}
            {analiseTipada && (analiseTipada.zScoreFaltas !== null || analiseTipada.zScoreAtrasos !== null) && (
              <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: 14 }}>Análise Z-Score por Tipo</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <ZScoreBadge
                    label="Faltas (cód. 171)"
                    zScore={analiseTipada.zScoreFaltas}
                    classificacao={analiseTipada.classificacaoFaltas}
                    media3m={analiseTipada.media3mFaltas}
                    cor="#ef4444"
                  />
                  <ZScoreBadge
                    label="Atrasos (cód. 335)"
                    zScore={analiseTipada.zScoreAtrasos}
                    classificacao={analiseTipada.classificacaoAtrasos}
                    media3m={analiseTipada.media3mAtrasos}
                    cor="#f59e0b"
                  />
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: '#475569' }}>
                  Z-Score indica quantos desvios padrão o valor atual está acima/abaixo da média dos 3 meses anteriores.
                </div>
              </div>
            )}

            {/* Comparação histórica + Anomalias */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: 16 }}>Comparação Histórica (Total)</div>
                {analise.mesesHistorico === 0 ? (
                  <div style={{ color: '#64748b', fontSize: 13, padding: '20px 0' }}>Nenhum histórico disponível para esta secretaria.</div>
                ) : (
                  <>
                    <ComparacaoRow label="vs. Média 3 meses"  valor={validos.length} delta={analise.deltaPct3m}  media={analise.media3m} />
                    <ComparacaoRow label="vs. Média 6 meses"  valor={validos.length} delta={analise.deltaPct6m}  media={analise.media6m} />
                    <ComparacaoRow label="vs. Média 12 meses" valor={validos.length} delta={analise.deltaPct12m} media={analise.media12m} />
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>Últimos períodos</div>
                      {historico.slice(0, 6).map(h => (
                        <div key={h.periodo_referencia} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                          <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{formatarCompetencia(h.periodo_referencia)}</span>
                          <div style={{ display: 'flex', gap: 12 }}>
                            {h.total_faltas != null && <span style={{ fontSize: 10, color: '#ef4444' }}>{h.total_faltas}F</span>}
                            {h.total_atrasos != null && <span style={{ fontSize: 10, color: '#f59e0b' }}>{h.total_atrasos}A</span>}
                            <span style={{ fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>{fmt(h.total_ocorrencias)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="chart-card">
                <div className="chart-title" style={{ marginBottom: 16 }}>Detecção de Anomalias</div>
                {anomalias.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', color: '#10b981' }}>
                    <CheckCircle size={20} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Nenhuma anomalia detectada</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {anomalias.map((a, i) => <AnomaliaCard key={i} {...a} />)}
                  </div>
                )}
              </div>
            </div>

            {/* Ações */}
            {!publicado ? (
              <div className="chart-card" style={{ background: jaExiste ? 'rgba(245,158,11,.06)' : undefined }}>
                {isVisitor && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.18)' }}>
                    <Lock size={14} color="#f87171" />
                    <span style={{ fontSize: 12, color: '#f87171', fontWeight: 500 }}>
                      Visitantes não podem publicar prévias. Faça login como Administrador para liberar esta ação.
                    </span>
                  </div>
                )}
                {!isVisitor && jaExiste && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '8px 12px', borderRadius: 6, background: 'rgba(245,158,11,.1)', border: '1px solid rgba(245,158,11,.2)' }}>
                    <AlertTriangle size={14} color="#f59e0b" />
                    <span style={{ fontSize: 12, color: '#fbbf24' }}>
                      Já existe uma prévia publicada para {secretariaNome} em {formatarCompetencia(competencia)}. Publicar irá substituí-la.
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={publicar}
                    disabled={publicando || isVisitor}
                    style={{
                      flex: 1, padding: '12px 20px', borderRadius: 8, border: 'none',
                      background: isVisitor ? 'rgba(255,255,255,.04)' : publicando ? 'rgba(59,130,246,.4)' : '#3b82f6',
                      color: isVisitor ? '#374151' : '#fff', fontWeight: 700, fontSize: 13,
                      cursor: isVisitor ? 'not-allowed' : publicando ? 'wait' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {isVisitor ? <Lock size={14} /> : <CheckCircle size={15} />}
                    {isVisitor ? 'Publicação restrita a Administradores' : publicando ? 'Publicando...' : `Publicar Prévia · ${fmt(validos.length)} registros`}
                  </button>
                  <button onClick={reiniciar} style={{ padding: '12px 20px', borderRadius: 8, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', color: '#94a3b8', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                    <XCircle size={15} style={{ display: 'inline', marginRight: 6 }} />Cancelar
                  </button>
                </div>
                {erro && <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, background: 'rgba(239,68,68,.1)', color: '#f87171', fontSize: 12 }}>Erro: {erro}</div>}
              </div>
            ) : (
              <div className="chart-card" style={{ background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)', textAlign: 'center' }}>
                <CheckCircle size={36} color="#10b981" style={{ margin: '0 auto 12px' }} />
                <div style={{ fontSize: 16, color: '#34d399', fontWeight: 700, marginBottom: 8 }}>Prévia publicada com sucesso!</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
                  {fmt(validos.length)} registros importados para {secretariaNome} · {formatarCompetencia(competencia)}
                </div>
                <button onClick={reiniciar} style={{ padding: '8px 20px', borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  Nova Simulação
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
