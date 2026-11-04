import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useCallback, useMemo } from 'react';
import {
  Upload, AlertTriangle, CheckCircle, Download, Search,
  ChevronDown, ChevronUp, Info, XCircle, Clock, Users, Calendar
} from 'lucide-react';
import {
  lerCSVMarcacoes,
  lerXLSXHorarios,
  cruzarDados,
  exportarRelatorioXLSX,
  LIMITE_PADRAO,
  minParaHorario,
  minParaHrMm,
  formatarData,
  diaDaSemana,
} from '@/modules/ponto/utils/analisarHorasPositivas';

// ─── Estilos base ─────────────────────────────────────────────────────────────

const CARD = {
  background: 'rgba(0,0,0,.02)',
  border: '1px solid rgba(0,0,0,.07)',
  borderRadius: 12,
  padding: '20px 24px',
  marginBottom: 16,
};

const BTN_PRIMARY = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '9px 20px', borderRadius: 8,
  background: '#0D7C3D', border: 'none',
  color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  transition: 'opacity .15s',
};

const BTN_GHOST = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '9px 18px', borderRadius: 8,
  background: 'rgba(0,0,0,.03)', border: '1px solid rgba(0,0,0,.07)',
  color: 'var(--muted-c)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
};

const INPUT_SEARCH = {
  background: 'none', border: 'none',
  color: 'var(--text)', fontSize: 12,
  outline: 'none', width: '100%', padding: '7px 0',
};

const TH = {
  padding: '8px 12px', fontSize: 10, fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '.06em',
  color: 'var(--muted-c)', textAlign: 'left',
  borderBottom: '1px solid rgba(0,0,0,.06)',
  background: 'rgba(0,0,0,.03)',
};

const TD = {
  padding: '8px 12px', fontSize: 12,
  borderBottom: '1px solid rgba(0,0,0,.03)',
};

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function KPI({ label, valor, sub, cor, icon: Icon }) {
  return (
    <div style={{
      flex: 1, minWidth: 150,
      padding: '14px 18px', borderRadius: 10,
      background: 'rgba(0,0,0,.02)',
      border: '1px solid rgba(0,0,0,.06)',
      borderTop: `3px solid ${cor}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        {Icon && <Icon size={13} color={cor} />}
        <span style={{ fontSize: 10, color: 'var(--muted-c)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
        {typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function DropZone({ label, accept, arquivo, onChange, cor }) {
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files[0];
    if (f) onChange(f);
  }, [onChange]);

  return (
    <label
      onDragOver={handleDrag}
      onDrop={handleDrop}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 10, padding: '28px 20px',
        border: `2px dashed ${arquivo ? cor : 'rgba(0,0,0,.12)'}`,
        borderRadius: 10, cursor: 'pointer',
        background: arquivo ? `${cor}08` : 'rgba(0,0,0,.01)',
        transition: 'all .2s',
        textAlign: 'center',
      }}
    >
      <input
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={e => { if (e.target.files[0]) onChange(e.target.files[0]); }}
      />
      {arquivo
        ? <CheckCircle size={28} color={cor} />
        : <Upload size={28} color="var(--muted-c)" />
      }
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: arquivo ? cor : 'var(--text)' }}>
          {arquivo ? arquivo.name : label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 3 }}>
          {arquivo ? 'Clique ou arraste para substituir' : 'Clique ou arraste o arquivo aqui'}
        </div>
      </div>
    </label>
  );
}

function ResumoServidor({ r, expanded, onToggle, modo = 'entrada' }) {
  const pct = Math.round((r.pctDosDias || 0) * 100);
  const isCritico = r.diasComHoraPositiva >= 15 || pct >= 80;
  const isMedio = r.diasComHoraPositiva >= 5 || pct >= 30;

  const corStatus = isCritico ? '#dc2626' : isMedio ? '#d97706' : '#0D7C3D';
  const bgStatus = isCritico ? 'rgba(239,68,68,.1)' : isMedio ? 'rgba(217,119,6,.1)' : 'rgba(13,124,61,.1)';

  return (
    <div style={{ border: '1px solid rgba(0,0,0,.07)', borderRadius: 10, overflow: 'hidden', marginBottom: 8, background: 'var(--card-bg)' }}>
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', cursor: 'pointer',
          background: expanded ? 'rgba(31,56,100,.04)' : 'rgba(0,0,0,.01)',
          gap: 12, flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 260, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{r.nome}</span>
            {r.cargo && (
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,0,0,.05)', color: 'var(--muted-c)' }}>
                {r.cargo}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 2 }}>
            {r.setor || r.horarioPrevisto}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {modo === 'geral' && (
            <div style={{ display: 'flex', gap: 6, fontSize: 10 }}>
              <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(13,124,61,.08)', color: '#0D7C3D', fontWeight: 600 }}>
                ☀️ {r.diasHEEntrada}d entrada ({minParaHrMm(r.totalMinutosEntrada)})
              </span>
              <span style={{ padding: '2px 6px', borderRadius: 4, background: 'rgba(30,58,138,.08)', color: '#1e3a8a', fontWeight: 600 }}>
                🌙 {r.diasHESaida}d saída ({minParaHrMm(r.totalMinutosSaida)})
              </span>
            </div>
          )}

          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: corStatus, background: bgStatus,
              padding: '3px 9px', borderRadius: 6,
            }}>
              {r.diasComHoraPositiva} de {r.diasComMarcacao} dias ({pct}%)
            </span>
            <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 3 }}>
              Média: ~{r.mediaMinutos} min ({minParaHrMm(r.mediaMinutos)})
            </div>
          </div>

          <div style={{ textAlign: 'right', minWidth: 80 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
              Total: {minParaHrMm(r.totalMinutos)}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted-c)' }}>
              Maior: +{minParaHrMm(r.maxMinutos)}
            </div>
          </div>

          {expanded ? <ChevronUp size={16} color="var(--muted-c)" /> : <ChevronDown size={16} color="var(--muted-c)" />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(0,0,0,.05)', background: 'rgba(0,0,0,.005)' }}>
          {/* Barra de incidência */}
          <div style={{ marginTop: 12, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted-c)', marginBottom: 4 }}>
              <span>Frequência no período: <strong>{pct}% dos dias trabalhados</strong></span>
              <span>Primeira: {formatarData(r.primeiraData)} · Última: {formatarData(r.ultimaData)}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,.06)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: corStatus, borderRadius: 3, transition: 'width .3s' }} />
            </div>
          </div>

          {/* Mini-tabela de ocorrências */}
          <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid rgba(0,0,0,.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  {modo === 'geral' ? (
                    ['Data', 'Dia', 'Tipo HE', 'Escala Prevista', 'Entrada Prev.', '1ª Entrada', 'HE Entrada', 'Saída Prev.', 'Última Saída', 'HE Saída', 'Total Dia'].map(h => (
                      <th key={h} style={{ ...TH, fontSize: 9, padding: '6px 10px' }}>{h}</th>
                    ))
                  ) : modo === 'saida' ? (
                    ['Data', 'Dia', 'Escala Prevista', 'Saída Prevista', 'Última Marcação', 'Minutos Excedentes'].map(h => (
                      <th key={h} style={{ ...TH, fontSize: 9, padding: '6px 10px' }}>{h}</th>
                    ))
                  ) : (
                    ['Data', 'Dia', 'Escala Prevista', 'Entrada Prevista', '1ª Marcação', 'Antecipação'].map(h => (
                      <th key={h} style={{ ...TH, fontSize: 9, padding: '6px 10px' }}>{h}</th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {r.ocorrencias.map((oc, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.015)' }}>
                    <td style={{ ...TD, fontSize: 11, padding: '6px 10px', fontFamily: 'monospace' }}>{formatarData(oc.data)}</td>
                    <td style={{ ...TD, fontSize: 11, padding: '6px 10px', color: 'var(--muted-c)' }}>{diaDaSemana(oc.data)}</td>
                    {modo === 'geral' && (
                      <td style={{ ...TD, fontSize: 10, padding: '6px 10px' }}>
                        <span style={{
                          fontWeight: 700,
                          fontSize: 9,
                          padding: '2px 5px',
                          borderRadius: 4,
                          background: oc.tipoHE.includes('+') ? 'rgba(168,85,247,.1)' : oc.tipoHE === 'ENTRADA' ? 'rgba(13,124,61,.1)' : 'rgba(30,58,138,.1)',
                          color: oc.tipoHE.includes('+') ? '#9333ea' : oc.tipoHE === 'ENTRADA' ? '#0D7C3D' : '#1e3a8a',
                        }}>
                          {oc.tipoHE}
                        </span>
                      </td>
                    )}
                    <td style={{ ...TD, fontSize: 11, padding: '6px 10px', color: 'var(--muted-c)' }}>{oc.horarioPrevisto}</td>

                    {modo === 'geral' ? (
                      <>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', fontFamily: 'monospace' }}>{oc.inicioPrevistoMin !== null ? minParaHorario(oc.inicioPrevistoMin) : '—'}</td>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', fontFamily: 'monospace', color: oc.minutosEntrada > 0 ? '#dc2626' : 'var(--text)', fontWeight: oc.minutosEntrada > 0 ? 700 : 400 }}>{oc.primeiraEntrada}</td>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', color: oc.minutosEntrada > 0 ? '#d97706' : 'var(--muted-c)', fontWeight: oc.minutosEntrada > 0 ? 700 : 400 }}>
                          {oc.minutosEntrada > 0 ? `+${oc.minutosEntrada} min` : '—'}
                        </td>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', fontFamily: 'monospace' }}>{oc.fimPrevistoMin !== null ? minParaHorario(oc.fimPrevistoMin) : '—'}</td>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', fontFamily: 'monospace', color: oc.minutosSaida > 0 ? '#dc2626' : 'var(--text)', fontWeight: oc.minutosSaida > 0 ? 700 : 400 }}>{oc.ultimaSaida}</td>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', color: oc.minutosSaida > 0 ? '#d97706' : 'var(--muted-c)', fontWeight: oc.minutosSaida > 0 ? 700 : 400 }}>
                          {oc.minutosSaida > 0 ? `+${oc.minutosSaida} min` : '—'}
                        </td>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', fontWeight: 700, color: '#dc2626' }}>
                          +{oc.totalMinutos} min ({minParaHrMm(oc.totalMinutos)})
                        </td>
                      </>
                    ) : modo === 'saida' ? (
                      <>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', fontFamily: 'monospace' }}>{minParaHorario(oc.fimPrevistoMin)}</td>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', fontFamily: 'monospace', color: '#dc2626', fontWeight: 700 }}>{oc.ultimaSaida}</td>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px' }}>
                          <span style={{ color: oc.minutosSaida >= 120 ? '#dc2626' : '#d97706', fontWeight: 700 }}>
                            +{oc.minutosSaida} min ({minParaHrMm(oc.minutosSaida)})
                          </span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', fontFamily: 'monospace' }}>{minParaHorario(oc.inicioPrevistoMin)}</td>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px', fontFamily: 'monospace', color: '#dc2626', fontWeight: 700 }}>{oc.primeiraEntrada}</td>
                        <td style={{ ...TD, fontSize: 11, padding: '6px 10px' }}>
                          <span style={{ color: oc.minutosEntrada >= 120 ? '#dc2626' : '#d97706', fontWeight: 700 }}>
                            +{oc.minutosEntrada} min ({minParaHrMm(oc.minutosEntrada)})
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function HorasPositivasEntrada() {
  const [arquivoCSV, setArquivoCSV] = useState(null);
  const [arquivoXLSX, setArquivoXLSX] = useState(null);
  const [limiteMin, setLimiteMin] = useState(LIMITE_PADRAO);
  const [modoAnalise, setModoAnalise] = useState('entrada'); // 'entrada' | 'saida' | 'geral'
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null);

  // Filtros da tabela de detalhe
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState('resumo'); // 'resumo' | 'detalhe' | 'detalheEntrada' | 'detalheSaida' | 'semHorario' | 'extremos'
  const [expandidos, setExpandidos] = useState(new Set());

  const podeAnalisar = arquivoCSV && arquivoXLSX && !processando;

  const analisar = useCallback(async () => {
    setErro(null);
    setResultado(null);
    setProcessando(true);
    try {
      const [marcacoes, mapaHorarios] = await Promise.all([
        lerCSVMarcacoes(arquivoCSV),
        lerXLSXHorarios(arquivoXLSX),
      ]);
      const res = cruzarDados(marcacoes, mapaHorarios, limiteMin, modoAnalise);
      setResultado(res);
      setAbaAtiva('resumo');
      setExpandidos(new Set());
    } catch (e) {
      setErro(e.message);
    } finally {
      setProcessando(false);
    }
  }, [arquivoCSV, arquivoXLSX, limiteMin, modoAnalise]);

  const toggleExpandido = useCallback((nome) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(nome)) next.delete(nome);
      else next.add(nome);
      return next;
    });
  }, []);

  // Filtrar ocorrências detalhadas
  const ocorrenciasFiltradas = useMemo(() => {
    if (!resultado) return [];
    let base = resultado.ocorrencias;
    if (abaAtiva === 'detalheEntrada') {
      base = resultado.ocorrencias.filter(oc => (oc.minutosEntrada || oc.antecipacaoMin) > 0);
    } else if (abaAtiva === 'detalheSaida') {
      base = resultado.ocorrencias.filter(oc => (oc.minutosSaida || oc.excedenteSaidaMin) > 0);
    }

    const b = busca.trim().toLowerCase();
    if (!b) return base;
    return base.filter(oc =>
      oc.nome.toLowerCase().includes(b) ||
      (oc.setor && oc.setor.toLowerCase().includes(b)) ||
      (oc.cargo && oc.cargo.toLowerCase().includes(b)) ||
      formatarData(oc.data).includes(b)
    );
  }, [resultado, busca, abaAtiva]);

  const resumoFiltrado = useMemo(() => {
    if (!resultado) return [];
    const b = busca.trim().toLowerCase();
    if (!b) return resultado.resumoPorServidor;
    return resultado.resumoPorServidor.filter(r =>
      r.nome.toLowerCase().includes(b) ||
      (r.setor && r.setor.toLowerCase().includes(b)) ||
      (r.cargo && r.cargo.toLowerCase().includes(b))
    );
  }, [resultado, busca]);

  const ABAS = useMemo(() => {
    if (!resultado) return [];
    if (resultado.modoAnalise === 'geral') {
      const diasEntrada = resultado.ocorrencias.filter(o => o.minutosEntrada > 0).length;
      const diasSaida = resultado.ocorrencias.filter(o => o.minutosSaida > 0).length;
      return [
        { id: 'resumo', label: `Resumo Consolidado (${resultado.resumoPorServidor.length})`, cor: '#1F3864' },
        { id: 'detalhe', label: `Detalhe Geral (${resultado.ocorrencias.length})`, cor: '#9333ea' },
        { id: 'detalheEntrada', label: `HE Entrada (${diasEntrada})`, cor: '#0D7C3D' },
        { id: 'detalheSaida', label: `HE Saída (${diasSaida})`, cor: '#1e3a8a' },
        ...(resultado.semHorario.length ? [{ id: 'semHorario', label: `Sem horário (${resultado.semHorario.length})`, cor: '#6366f1' }] : []),
        ...(resultado.extremos.length ? [{ id: 'extremos', label: `Revisar - Extremos (${resultado.extremos.length})`, cor: '#64748b' }] : []),
      ];
    }
    return [
      { id: 'resumo', label: `Resumo (${resultado.resumoPorServidor.length})`, cor: resultado.modoAnalise === 'saida' ? '#1e3a8a' : '#dc2626' },
      { id: 'detalhe', label: `Detalhe (${resultado.ocorrencias.length})`, cor: '#d97706' },
      ...(resultado.semHorario.length ? [{ id: 'semHorario', label: `Sem horário (${resultado.semHorario.length})`, cor: '#6366f1' }] : []),
      ...(resultado.extremos.length ? [{ id: 'extremos', label: `Revisar - Extremos (${resultado.extremos.length})`, cor: '#64748b' }] : []),
    ];
  }, [resultado]);

  const totalMinutosGerais = useMemo(() => {
    if (!resultado) return 0;
    return resultado.ocorrencias.reduce((acc, oc) => acc + (oc.totalMinutos || oc.antecipacaoMin || oc.excedenteSaidaMin || 0), 0);
  }, [resultado]);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Auditoria de Horas Positivas (HE)</h1>
          <p>Levantamento e cruzamento automatizado de marcações biométricas fora da escala prevista</p>
        </div>
        <div className="topbar-right">
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">

        {/* ── Instruções ── */}
        <div style={{ ...CARD, background: 'rgba(31,56,100,.04)', border: '1px solid rgba(31,56,100,.15)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <Info size={16} color="#1F3864" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
              <strong>Como usar:</strong> carregue o <strong>relatório de marcações</strong> (CSV com colunas Nome, Data_Hora e E_S —
              exportado do sistema de ponto biométrico) e o <strong>XLSX de horários previstos</strong>
              (colunas <em>funcionarionome</em>, <em>calendariodata</em>, <em>calendariohorarioprevisto</em>).
              Escolha abaixo se deseja auditar <strong>HE na Entrada</strong>, <strong>HE na Saída</strong> ou <strong>Consolidado Geral</strong>.
            </div>
          </div>
        </div>

        {/* ── Upload & Configuração ── */}
        <div style={CARD}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
            1. Carregar Arquivos e Configurar Análise
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-c)', marginBottom: 8 }}>
                📄 Relatório de Marcações (CSV ou Excel)
              </div>
              <DropZone
                label="Relatório de Marcações"
                accept=".csv,.xls,.xlsx"
                arquivo={arquivoCSV}
                onChange={setArquivoCSV}
                cor="#0D7C3D"
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-c)', marginBottom: 8 }}>
                📋 Horários Previstos dos Servidores (Excel)
              </div>
              <DropZone
                label="Horários Previstos (Des_Horario)"
                accept=".xls,.xlsx"
                arquivo={arquivoXLSX}
                onChange={setArquivoXLSX}
                cor="#1F3864"
              />
            </div>
          </div>

          {/* Seletor de Modo de Análise */}
          <div style={{ marginBottom: 20, padding: '14px 16px', background: 'rgba(0,0,0,.015)', borderRadius: 10, border: '1px solid rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Modo de Levantamento
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
              {[
                {
                  id: 'entrada',
                  titulo: '☀️ HE na Entrada',
                  desc: 'Entrada antecipada além da tolerância (> limite da escala)',
                  cor: '#0D7C3D',
                  bgAtivo: 'rgba(13,124,61,.1)',
                },
                {
                  id: 'saida',
                  titulo: '🌙 HE na Saída',
                  desc: 'Permanência além do encerramento previsto da jornada',
                  cor: '#1e3a8a',
                  bgAtivo: 'rgba(30,58,138,.1)',
                },
                {
                  id: 'geral',
                  titulo: '⚡ Consolidado Geral',
                  desc: 'Entrada e saída unificadas num único relatório executivo',
                  cor: '#7c3aed',
                  bgAtivo: 'rgba(124,58,237,.1)',
                },
              ].map(m => {
                const ativo = modoAnalise === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModoAnalise(m.id)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '12px 14px', borderRadius: 8,
                      border: `2px solid ${ativo ? m.cor : 'rgba(0,0,0,.08)'}`,
                      background: ativo ? m.bgAtivo : '#fff',
                      cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: ativo ? m.cor : 'var(--text)', marginBottom: 3 }}>
                      {m.titulo}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted-c)', lineHeight: 1.3 }}>
                      {m.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuração de limite e Botão de Ação */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={14} color="var(--muted-c)" />
              <span style={{ fontSize: 12, color: 'var(--muted-c)' }}>Tolerância para considerar HE:</span>
              <select
                value={limiteMin}
                onChange={e => setLimiteMin(Number(e.target.value))}
                style={{
                  padding: '6px 12px', borderRadius: 6,
                  background: '#fff', border: '1px solid rgba(0,0,0,.12)',
                  color: 'var(--text)', fontSize: 12, outline: 'none', fontWeight: 600,
                }}
              >
                <option value={30}>Mais de 30 minutos</option>
                <option value={45}>Mais de 45 minutos</option>
                <option value={59}>A partir de 60 minutos (59 inclusive)</option>
                <option value={60}>Mais de 60 minutos (estritamente &gt; 1h)</option>
                <option value={90}>Mais de 90 minutos</option>
                <option value={120}>Mais de 2 horas</option>
              </select>
            </div>

            <button
              onClick={analisar}
              disabled={!podeAnalisar}
              style={{
                ...BTN_PRIMARY,
                background: modoAnalise === 'saida' ? '#1e3a8a' : modoAnalise === 'geral' ? '#7c3aed' : '#0D7C3D',
                opacity: podeAnalisar ? 1 : 0.4,
                cursor: podeAnalisar ? 'pointer' : 'not-allowed',
              }}
            >
              {processando
                ? <><span className="spinner" style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Cruzando dados...</>
                : <><Search size={15} />Executar Cruzamento {modoAnalise === 'geral' ? 'Geral' : modoAnalise === 'saida' ? 'de Saída' : 'de Entrada'}</>
              }
            </button>
          </div>
        </div>

        {/* ── Erro ── */}
        {erro && (
          <div style={{ ...CARD, background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.2)', borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <XCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>Erro ao processar os arquivos</div>
                <div style={{ fontSize: 12, color: 'var(--muted-c)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{erro}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Resultado ── */}
        {resultado && (
          <>
            {/* KPIs */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
              <KPI
                label={resultado.modoAnalise === 'geral' ? 'Servidores com HE' : resultado.modoAnalise === 'saida' ? 'Servidores c/ HE Saída' : 'Servidores c/ HE Entrada'}
                valor={resultado.resumoPorServidor.length}
                sub={`de ${resultado.totalServidoresCSV} no CSV`}
                cor={resultado.modoAnalise === 'geral' ? '#7c3aed' : resultado.modoAnalise === 'saida' ? '#1e3a8a' : '#dc2626'}
                icon={AlertTriangle}
              />
              <KPI
                label={resultado.modoAnalise === 'geral' ? 'Ocorrências Totais' : resultado.modoAnalise === 'saida' ? 'Dias com HE Saída' : 'Dias com HE Entrada'}
                valor={resultado.ocorrencias.length}
                sub={`> ${resultado.limiteMinutos} min da escala`}
                cor="#d97706"
                icon={Calendar}
              />
              <KPI
                label="Total de Horas Extras"
                valor={minParaHrMm(totalMinutosGerais)}
                sub={`${totalMinutosGerais.toLocaleString('pt-BR')} minutos somados`}
                cor="#0D7C3D"
                icon={Clock}
              />
              <KPI
                label="Marcações Lidas"
                valor={resultado.totalMarcacoesAnalisadas}
                sub={`${resultado.totalServidoresCSV} servidores identificados`}
                cor="#1F3864"
                icon={Users}
              />
              {resultado.extremos.length > 0 && (
                <KPI
                  label="Revisar — Extremos"
                  valor={resultado.extremos.length}
                  sub="Prováveis erros de coletor (>6h)"
                  cor="#f59e0b"
                  icon={AlertTriangle}
                />
              )}
            </div>

            {/* Aviso se nenhuma ocorrência */}
            {resultado.ocorrencias.length === 0 && (
              <div style={{ ...CARD, background: 'rgba(13,124,61,.05)', border: '1px solid rgba(13,124,61,.15)', textAlign: 'center' }}>
                <CheckCircle size={32} color="#0D7C3D" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0D7C3D' }}>
                  Nenhuma hora positiva encontrada no critério selecionado
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted-c)', marginTop: 4 }}>
                  Todos os servidores com horário previsto cadastrado registraram ponto dentro da tolerância de {resultado.limiteMinutos} minutos.
                </div>
              </div>
            )}

            {resultado.ocorrencias.length > 0 && (
              <div style={CARD}>
                {/* Header com ações */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                    2. Relatório {resultado.modoAnalise === 'geral' ? 'Consolidado (Entrada e Saída)' : resultado.modoAnalise === 'saida' ? 'de Horas Extras na Saída' : 'de Horas Extras na Entrada'}
                  </div>
                  <button
                    onClick={() => exportarRelatorioXLSX(resultado)}
                    style={{ ...BTN_PRIMARY, background: '#1F3864' }}
                  >
                    <Download size={15} /> Exportar Relatório Executivo XLSX
                  </button>
                </div>

                {/* Busca */}
                <div style={{ display: 'flex', alignItems: 'center', background: '#fff', border: '1px solid rgba(0,0,0,.12)', borderRadius: 7, padding: '0 10px', marginBottom: 14, maxWidth: 360 }}>
                  <Search size={13} color="#64748b" style={{ marginRight: 8, flexShrink: 0 }} />
                  <input
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar servidor, cargo, setor ou data..."
                    style={INPUT_SEARCH}
                  />
                </div>

                {/* Abas */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
                  {ABAS.map(aba => (
                    <button
                      key={aba.id}
                      onClick={() => setAbaAtiva(aba.id)}
                      style={{
                        padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                        border: 'none', cursor: 'pointer', transition: 'all .15s',
                        background: abaAtiva === aba.id ? aba.cor : 'rgba(0,0,0,.04)',
                        color: abaAtiva === aba.id ? '#fff' : 'var(--muted-c)',
                      }}
                    >
                      {aba.label}
                    </button>
                  ))}
                </div>

                {/* Aba Resumo por Servidor */}
                {abaAtiva === 'resumo' && (
                  <div>
                    {resumoFiltrado.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 30, color: 'var(--muted-c)', fontSize: 13 }}>
                        Nenhum servidor encontrado com os filtros aplicados.
                      </div>
                    )}
                    {resumoFiltrado.map(r => (
                      <ResumoServidor
                        key={r.nome}
                        r={r}
                        modo={resultado.modoAnalise}
                        expanded={expandidos.has(r.nome)}
                        onToggle={() => toggleExpandido(r.nome)}
                      />
                    ))}
                  </div>
                )}

                {/* Aba Detalhe (Geral, Entrada ou Saída) */}
                {(abaAtiva === 'detalhe' || abaAtiva === 'detalheEntrada' || abaAtiva === 'detalheSaida') && (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {resultado.modoAnalise === 'geral' ? (
                            ['Servidor', 'Setor', 'Data', 'Dia', 'Tipo HE', 'Escala Prevista', 'Entrada Prev.', '1ª Entrada', 'HE Entrada', 'Saída Prev.', 'Última Saída', 'HE Saída', 'Total Dia'].map(h => (
                              <th key={h} style={TH}>{h}</th>
                            ))
                          ) : resultado.modoAnalise === 'saida' ? (
                            ['Servidor', 'Setor', 'Data', 'Dia', 'Escala Prevista', 'Saída Prevista', 'Última Marcação', 'Excedente na Saída'].map(h => (
                              <th key={h} style={TH}>{h}</th>
                            ))
                          ) : (
                            ['Servidor', 'Setor', 'Data', 'Dia', 'Escala Prevista', 'Entrada Prevista', '1ª Marcação', 'Antecipação'].map(h => (
                              <th key={h} style={TH}>{h}</th>
                            ))
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {ocorrenciasFiltradas.length === 0 && (
                          <tr>
                            <td colSpan={resultado.modoAnalise === 'geral' ? 13 : 8} style={{ ...TD, textAlign: 'center', color: 'var(--muted-c)', padding: 24 }}>
                              Nenhuma ocorrência encontrada.
                            </td>
                          </tr>
                        )}
                        {ocorrenciasFiltradas.map((oc, i) => (
                          <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.01)' }}>
                            <td style={{ ...TD, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{oc.nome}</td>
                            <td style={{ ...TD, color: 'var(--muted-c)', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={oc.setor}>
                              {oc.setor || '—'}
                            </td>
                            <td style={{ ...TD, fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatarData(oc.data)}</td>
                            <td style={{ ...TD, color: 'var(--muted-c)', fontSize: 11 }}>{diaDaSemana(oc.data)}</td>

                            {resultado.modoAnalise === 'geral' ? (
                              <>
                                <td style={{ ...TD }}>
                                  <span style={{
                                    fontWeight: 700, fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                    background: oc.tipoHE.includes('+') ? 'rgba(168,85,247,.1)' : oc.tipoHE === 'ENTRADA' ? 'rgba(13,124,61,.1)' : 'rgba(30,58,138,.1)',
                                    color: oc.tipoHE.includes('+') ? '#9333ea' : oc.tipoHE === 'ENTRADA' ? '#0D7C3D' : '#1e3a8a',
                                  }}>
                                    {oc.tipoHE}
                                  </span>
                                </td>
                                <td style={{ ...TD, color: 'var(--muted-c)', fontSize: 11, whiteSpace: 'nowrap' }}>{oc.horarioPrevisto}</td>
                                <td style={{ ...TD, fontFamily: 'monospace', color: '#0D7C3D', fontWeight: 600 }}>{oc.inicioPrevistoMin !== null ? minParaHorario(oc.inicioPrevistoMin) : '—'}</td>
                                <td style={{ ...TD, fontFamily: 'monospace', color: oc.minutosEntrada > 0 ? '#dc2626' : 'var(--text)', fontWeight: oc.minutosEntrada > 0 ? 700 : 400 }}>{oc.primeiraEntrada}</td>
                                <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                                  {oc.minutosEntrada > 0 ? (
                                    <span style={{ fontWeight: 700, color: '#0D7C3D' }}>+{oc.minutosEntrada} min ({minParaHrMm(oc.minutosEntrada)})</span>
                                  ) : <span style={{ color: 'var(--muted-c)' }}>—</span>}
                                </td>
                                <td style={{ ...TD, fontFamily: 'monospace', color: '#1e3a8a', fontWeight: 600 }}>{oc.fimPrevistoMin !== null ? minParaHorario(oc.fimPrevistoMin) : '—'}</td>
                                <td style={{ ...TD, fontFamily: 'monospace', color: oc.minutosSaida > 0 ? '#dc2626' : 'var(--text)', fontWeight: oc.minutosSaida > 0 ? 700 : 400 }}>{oc.ultimaSaida}</td>
                                <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                                  {oc.minutosSaida > 0 ? (
                                    <span style={{ fontWeight: 700, color: '#1e3a8a' }}>+{oc.minutosSaida} min ({minParaHrMm(oc.minutosSaida)})</span>
                                  ) : <span style={{ color: 'var(--muted-c)' }}>—</span>}
                                </td>
                                <td style={{ ...TD, whiteSpace: 'nowrap', fontWeight: 700, color: '#dc2626' }}>
                                  +{oc.totalMinutos} min ({minParaHrMm(oc.totalMinutos)})
                                </td>
                              </>
                            ) : resultado.modoAnalise === 'saida' ? (
                              <>
                                <td style={{ ...TD, color: 'var(--muted-c)', fontSize: 11, whiteSpace: 'nowrap' }}>{oc.horarioPrevisto}</td>
                                <td style={{ ...TD, fontFamily: 'monospace', color: '#1e3a8a', fontWeight: 700 }}>{minParaHorario(oc.fimPrevistoMin)}</td>
                                <td style={{ ...TD, fontFamily: 'monospace', color: '#dc2626', fontWeight: 700 }}>{oc.ultimaMarcacao}</td>
                                <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    fontWeight: 700,
                                    color: oc.excedenteSaidaMin >= 120 ? '#dc2626' : '#d97706',
                                    background: oc.excedenteSaidaMin >= 120 ? 'rgba(239,68,68,.08)' : 'rgba(217,119,6,.08)',
                                    padding: '2px 7px', borderRadius: 5, fontSize: 11,
                                  }}>
                                    +{oc.excedenteSaidaMin} min ({minParaHrMm(oc.excedenteSaidaMin)})
                                  </span>
                                </td>
                              </>
                            ) : (
                              <>
                                <td style={{ ...TD, color: 'var(--muted-c)', fontSize: 11, whiteSpace: 'nowrap' }}>{oc.horarioPrevisto}</td>
                                <td style={{ ...TD, fontFamily: 'monospace', color: '#0D7C3D', fontWeight: 700 }}>{minParaHorario(oc.inicioPrevistoMin)}</td>
                                <td style={{ ...TD, fontFamily: 'monospace', color: '#dc2626', fontWeight: 700 }}>{oc.primeiraMarcacao}</td>
                                <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                                  <span style={{
                                    fontWeight: 700,
                                    color: oc.antecipacaoMin >= 120 ? '#dc2626' : '#d97706',
                                    background: oc.antecipacaoMin >= 120 ? 'rgba(239,68,68,.08)' : 'rgba(217,119,6,.08)',
                                    padding: '2px 7px', borderRadius: 5, fontSize: 11,
                                  }}>
                                    +{oc.antecipacaoMin} min ({minParaHrMm(oc.antecipacaoMin)})
                                  </span>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Aba Sem Horário */}
                {abaAtiva === 'semHorario' && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted-c)', marginBottom: 12, padding: '8px 12px', background: 'rgba(99,102,241,.06)', borderRadius: 7, border: '1px solid rgba(99,102,241,.15)' }}>
                      <Info size={12} style={{ display: 'inline', marginRight: 4 }} />
                      Dias com marcação registrada no sistema, mas sem escala cadastrada no arquivo XLSX (ex: folgas oficiais ou ausência de cadastro no período).
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            {['Servidor', 'Setor', 'Data', '1ª Marcação', 'Motivo'].map(h => (
                              <th key={h} style={TH}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.semHorario.map((s, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.01)' }}>
                              <td style={{ ...TD, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{s.nome}</td>
                              <td style={{ ...TD, color: 'var(--muted-c)', fontSize: 11 }}>{s.setor || '—'}</td>
                              <td style={{ ...TD, fontFamily: 'monospace' }}>{formatarData(s.data)}</td>
                              <td style={{ ...TD, fontFamily: 'monospace' }}>{s.primeiraMarcacao}</td>
                              <td style={{ ...TD, color: 'var(--muted-c)', fontStyle: 'italic' }}>{s.motivo}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Aba Extremos */}
                {abaAtiva === 'extremos' && (
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted-c)', marginBottom: 12, padding: '8px 12px', background: 'rgba(245,158,11,.06)', borderRadius: 7, border: '1px solid rgba(245,158,11,.2)' }}>
                      <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} color="#d97706" />
                      Marcações com diferença superior a 6 horas (360 minutos). Geralmente são erros de coletor, viradas de turno não documentadas ou batidas duplicadas — mantidas separadas para revisão.
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr>
                            {['Servidor', 'Setor', 'Data', 'Escala Prevista', 'Tipo', 'Marcação', 'Diferença'].map(h => (
                              <th key={h} style={TH}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resultado.extremos.map((oc, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,.01)' }}>
                              <td style={{ ...TD, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{oc.nome}</td>
                              <td style={{ ...TD, color: 'var(--muted-c)', fontSize: 11 }}>{oc.setor || '—'}</td>
                              <td style={{ ...TD, fontFamily: 'monospace' }}>{formatarData(oc.data)}</td>
                              <td style={{ ...TD, color: 'var(--muted-c)' }}>{oc.horarioPrevisto}</td>
                              <td style={{ ...TD }}>
                                <span style={{ fontWeight: 700, fontSize: 10, padding: '2px 5px', borderRadius: 4, background: 'rgba(245,158,11,.1)', color: '#b45309' }}>
                                  {oc.tipoExtremo || oc.tipoHE || 'EXTREMO'}
                                </span>
                              </td>
                              <td style={{ ...TD, fontFamily: 'monospace', color: '#dc2626', fontWeight: 700 }}>
                                {oc.primeiraEntrada || oc.primeiraMarcacao || oc.ultimaSaida || oc.ultimaMarcacao}
                              </td>
                              <td style={{ ...TD }}>
                                <span style={{ fontWeight: 700, color: '#b45309', fontSize: 11 }}>
                                  +{oc.antecipacaoMin || oc.excedenteSaidaMin || oc.totalMinutos} min ({minParaHrMm(oc.antecipacaoMin || oc.excedenteSaidaMin || oc.totalMinutos)})
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            )}

            {/* Notas metodológicas */}
            <div style={{ ...CARD, marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>📝 Notas Metodológicas</div>
              <ul style={{ fontSize: 12, color: 'var(--muted-c)', lineHeight: 1.9, paddingLeft: 18, margin: 0 }}>
                <li>O cruzamento é realizado por <strong>nome normalizado + data exata</strong> (maiúsculas, espaços extras e acentuações tratados).</li>
                <li><strong>Modo Selecionado ({resultado.modoAnalise.toUpperCase()}):</strong> {
                  resultado.modoAnalise === 'geral'
                    ? 'Avalia conjuntamente as horas extras realizadas na entrada (primeira batida antes da escala) e na saída (última batida após o término previsto).'
                    : resultado.modoAnalise === 'saida'
                    ? 'Avalia exclusivamente o excedente na saída além do término programado da jornada.'
                    : 'Avalia exclusivamente a antecipação na entrada antes do horário de início da escala.'
                }</li>
                <li>Dias com exatamente {resultado.limiteMinutos} minutos <em>não entram</em> (critério estrito: &gt; {resultado.limiteMinutos} min). Para incluí-los, utilize o limite de {resultado.limiteMinutos - 1} min.</li>
                <li>Marcações anômalas com desvio superior a 6h são separadas na aba "Revisar - Extremos" para não distorcer os totais executivos.</li>
                <li>Abonos, justificativas e trocas de turno manuais não estão incluídos na base bruta do coletor — confira os servidores com alta recorrência antes de encaminhar à chefia.</li>
                <li>O arquivo Excel exportado utiliza formatação executiva com cabeçalhos institucionais (`#1F3864`), linhas zebradas, congelamento de painéis, filtros automáticos e totais calculados.</li>
              </ul>
            </div>
          </>
        )}

      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
