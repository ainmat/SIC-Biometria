import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid,
} from 'recharts';
import { X, Plus, TrendingUp, TrendingDown, Minus, Filter, LayoutList, LayoutGrid } from 'lucide-react';
import { baixarCSV } from '@/lib/exportar';
import { SearchSelect } from '@/components/ui/search-select';
import {
  fetchCompetencias,
  fetchComparativoGeral,
  fetchComparativoSecretaria,
  fetchComparativoUnidade,
} from '@/modules/folha/services/folhaService';
import { fmtCompetencia } from '@/modules/folha/constants';

/* ─────────────────────────── constants ─────────────────────────── */

// Secretarias que não devem aparecer no comparativo
const SECRETARIAS_EXCLUIDAS = new Set(['PENSIONISTAS']);
const filtrarSecretaria = (nome) => !SECRETARIAS_EXCLUIDAS.has(String(nome).toUpperCase().trim());

const METRICAS = [
  { id: 'faltas',            label: 'Faltas',          short: 'Faltas',    cor: '#ef4444' },
  { id: 'atrasos_total',     label: 'Atrasos',         short: 'Atrasos',   cor: '#f97316' },
  { id: 'atrasos_dia',       label: 'Atrasos ≥ 1h',    short: 'Atr ≥1h',  cor: '#c2410c' },
  { id: 'atrasos_fracao',    label: 'Atrasos < 1h',    short: 'Atr <1h',  cor: '#eab308' },
  { id: 'dsr',               label: 'DSR',              short: 'DSR',       cor: '#a855f7' },
  { id: 'hora_extra_total',  label: 'H.E. Total',      short: 'H.E.',      cor: '#22d3ee' },
  { id: 'hora_extra_50',     label: 'HE 50%',          short: 'HE 50%',   cor: '#0D7C3D' },
  { id: 'hora_extra_100',    label: 'HE 100%',         short: 'HE 100%',  cor: '#10b981' },
];

// Métricas agrupadas usadas na view Resumida (secundárias nos cards)
const METRICAS_RESUMIDAS = [
  { id: 'faltas',           label: 'Faltas',  cor: '#ef4444' },
  { id: 'atrasos_total',    label: 'Atrasos', cor: '#f97316' },
  { id: 'dsr',              label: 'DSR',     cor: '#a855f7' },
  { id: 'hora_extra_total', label: 'H.E.',    cor: '#22d3ee' },
];

const MES_CORES = ['#0D7C3D', '#0D7C3D', '#10b981', '#f97316', '#ec4899', '#a855f7'];

const N    = (v) => Number(v || 0);
const fmt  = (n) => Math.round(n).toLocaleString('pt-BR');
const fmtK = (n) => n >= 10000 ? (n / 1000).toFixed(0) + 'k'
                   : n >= 1000  ? (n / 1000).toFixed(1) + 'k'
                   : Math.round(n).toString();

/* ─────────────────────────── helpers ───────────────────────────── */

function getVal(dados, id) {
  if (id === 'atrasos_total')    return N(dados?.atrasos_dia) + N(dados?.atrasos_fracao);
  if (id === 'hora_extra_total') return N(dados?.hora_extra_50) + N(dados?.hora_extra_100);
  return N(dados?.[id]);
}

function deltaInfo(from, to) {
  if (from === 0 && to === 0) return { pct: 0,    color: 'var(--muted-c)', Icon: Minus };
  if (from === 0)             return { pct: null,  color: '#dc2626', Icon: TrendingUp };
  const pct = ((to - from) / from) * 100;
  return {
    pct,
    color: pct > 0 ? '#dc2626' : pct < 0 ? '#047857' : '#475569',
    Icon:  pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus,
  };
}

function thSt(extra = {}) {
  return {
    padding: '10px 10px', fontWeight: 700, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '.06em',
    borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
    color: 'var(--muted-c)', whiteSpace: 'nowrap',
    ...extra,
  };
}

/* ─────────────────────────── sub-components ────────────────────── */

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#ffffff', border: '1px solid rgba(0, 0, 0, 0.1)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,.15)',
    }}>
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: 8, fontSize: 11, letterSpacing: '.04em' }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, padding: '2px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill || p.color }} />
            <span style={{ color: '#334155', fontWeight: 600 }}>{p.dataKey || p.name}</span>
          </div>
          <span style={{ color: '#0f172a', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function PeriodCard({ comp, dados, prevDados, cor, metrica, detalhada = true }) {
  const val     = getVal(dados,     metrica.id);
  const prevVal = getVal(prevDados, metrica.id);
  const { pct, color: dColor, Icon: DIcon } = deltaInfo(prevVal, val);
  const hasDelta  = prevDados !== null;
  const secondary = detalhada
    ? METRICAS.filter(m => m.id !== metrica.id && m.id !== 'atrasos_total' && m.id !== 'hora_extra_total')
    : METRICAS_RESUMIDAS.filter(m => m.id !== metrica.id);

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'linear-gradient(160deg, rgba(0, 0, 0, 0.02) 0%, rgba(0,0,0,.015) 100%)',
      border: '1px solid rgba(0, 0, 0, 0.05)',
      borderTop: `3px solid ${cor}`,
      borderRadius: 14, padding: detalhada ? '20px 22px' : '16px 18px',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '.12em' }}>
          {fmtCompetencia(comp)}
        </span>
        <span style={{
          fontSize: 10, padding: '2px 8px', borderRadius: 10,
          background: `${cor}18`, color: cor, fontWeight: 700,
        }}>
          {fmt(N(dados?.servidores ?? 0))} serv.
        </span>
      </div>

      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: detalhada ? 42 : 36, fontWeight: 800, color: 'var(--text)', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>
          {fmt(val)}
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--muted-c)', fontWeight: 500 }}>{metrica.label}</span>
          {hasDelta && pct !== null && (
            <span style={{
              fontSize: 11, fontWeight: 700, color: dColor,
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 6px', borderRadius: 8, background: `${dColor}18`,
            }}>
              <DIcon size={10} />
              {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
            </span>
          )}
          {hasDelta && pct === null && (
            <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>novo</span>
          )}
        </div>
      </div>

      <>
        <div style={{ height: 1, background: 'rgba(0, 0, 0, 0.04)', margin: '14px 0' }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {secondary.map(m => {
            const sv  = getVal(dados,     m.id);
            const spv = getVal(prevDados, m.id);
            const { pct: sp, color: sc } = deltaInfo(spv, sv);
            return (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.cor, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{m.label}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {hasDelta && sp !== null && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: sc }}>
                      {sp > 0 ? '+' : ''}{sp.toFixed(0)}%
                    </span>
                  )}
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted-c)', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>
                    {fmtK(sv)}
                  </span>
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, paddingTop: 6, borderTop: '1px solid rgba(0, 0, 0, 0.02)' }}>
            <span style={{ fontSize: 10, color: 'var(--text)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
              servidores c/ oc.
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-c)', fontVariantNumeric: 'tabular-nums' }}>
              {fmt(N(dados?.servidores ?? 0))}
            </span>
          </div>
        </div>
      </>
    </div>
  );
}

/* ─────────────────────────── main component ────────────────────── */

export default function ComparativoFolha() {
  const [todasComp,    setTodasComp]    = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [nivel,        setNivel]        = useState('geral');
  const [metrica,      setMetrica]      = useState(METRICAS[0]);
  const [detalhada,    setDetalhada]    = useState(true);

  // filtros de escopo (como no DashboardFolha)
  const [filtroSec,    setFiltroSec]    = useState('');
  const [filtroUnd,    setFiltroUnd]    = useState('');

  const [dadosGeral,   setDadosGeral]   = useState({});
  const [dadosSec,     setDadosSec]     = useState({});
  const [dadosUnd,     setDadosUnd]     = useState({});
  const [loading,      setLoading]      = useState(false);
  const [addOpen,      setAddOpen]      = useState(false);
  const addRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (addRef.current && !addRef.current.contains(e.target)) setAddOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  /* competências disponíveis */
  useEffect(() => {
    fetchCompetencias().then(c => {
      const s = [...c].sort();
      setTodasComp(s);
      setSelecionadas(s);
    }).catch(console.error);
  }, []);

  /* geral + secretaria quando competências mudam */
  useEffect(() => {
    if (!selecionadas.length) return;
    setLoading(true);
    Promise.all([
      fetchComparativoGeral(selecionadas),
      fetchComparativoSecretaria(selecionadas),
    ]).then(([g, s]) => { setDadosGeral(g); setDadosSec(s); setDadosUnd({}); setFiltroUnd(''); })
      .catch(console.error).finally(() => setLoading(false));
  }, [selecionadas]);

  /* unidades sempre que uma secretaria é filtrada */
  useEffect(() => {
    if (!selecionadas.length || !filtroSec) {
      setDadosUnd({});
      setFiltroUnd('');
      return;
    }
    setLoading(true);
    setFiltroUnd('');
    fetchComparativoUnidade(selecionadas, filtroSec)
      .then(setDadosUnd).catch(console.error).finally(() => setLoading(false));
  }, [filtroSec, selecionadas]);

  const compsOrdenadas = useMemo(() => [...selecionadas].sort(), [selecionadas]);

  /* ── dados visíveis de acordo com o filtro ── */
  const dadosGeralVis = useMemo(() => {
    if (filtroUnd) {
      // totais da unidade selecionada
      const result = {};
      compsOrdenadas.forEach(c => { result[c] = dadosUnd[filtroUnd]?.[c] ?? null; });
      return result;
    }
    if (filtroSec) {
      // totais da secretaria selecionada
      const result = {};
      compsOrdenadas.forEach(c => { result[c] = dadosSec[filtroSec]?.[c] ?? null; });
      return result;
    }
    return dadosGeral;
  }, [filtroUnd, filtroSec, dadosGeral, dadosSec, dadosUnd, compsOrdenadas]);

  /* fonte para o ranking (secretarias ou unidades, conforme filtro) */
  const rankingSource = useMemo(() => {
    const source = filtroSec ? dadosUnd : dadosSec;
    return Object.fromEntries(Object.entries(source).filter(([k]) => filtrarSecretaria(k)));
  }, [filtroSec, dadosSec, dadosUnd]);

  const rankingLabel = filtroSec ? 'Unidade' : 'Secretaria';

  const secOptions = useMemo(
    () => Object.keys(dadosSec).filter(filtrarSecretaria).sort().map(s => ({ value: s, label: s })),
    [dadosSec]
  );
  const undOptions = useMemo(
    () => Object.keys(dadosUnd).filter(filtrarSecretaria).sort().map(u => ({ value: u, label: u })),
    [dadosUnd]
  );

  /* ── chart data ── */
  const chartData = useMemo(() => {
    if (nivel === 'geral') {
      return compsOrdenadas.map((c, i) => ({
        name: fmtCompetencia(c),
        value: getVal(dadosGeralVis[c], metrica.id),
        fill: MES_CORES[i % MES_CORES.length],
      }));
    }
    const source   = rankingSource;
    const lastComp = compsOrdenadas[compsOrdenadas.length - 1];
    return Object.entries(source)
      .sort((a, b) => getVal(b[1][lastComp], metrica.id) - getVal(a[1][lastComp], metrica.id))
      .slice(0, 8)
      .map(([nome, data]) => {
        const row = { name: nome.length > 24 ? nome.slice(0, 22) + '…' : nome };
        compsOrdenadas.forEach(c => { row[fmtCompetencia(c)] = getVal(data[c], metrica.id); });
        return row;
      });
  }, [nivel, dadosGeralVis, rankingSource, compsOrdenadas, metrica]);

  /* ── table rows ── */
  const METRICAS_TABELA = METRICAS.filter(m => m.id !== 'atrasos_total' && m.id !== 'hora_extra_total');
  const tableRows = useMemo(() => {
    if (nivel === 'geral' || filtroUnd) {
      // métricas como linhas (exclui virtuais para evitar duplicidade)
      return METRICAS_TABELA.map(m => ({
        key: m.id, nome: m.label, cor: m.cor, isMetric: true,
        meses: compsOrdenadas.map(c => getVal(dadosGeralVis[c], m.id)),
      }));
    }
    const source  = rankingSource;
    const lastIdx = compsOrdenadas.length - 1;
    return Object.entries(source)
      .map(([nome, data]) => ({
        key: nome, nome, cor: null, isMetric: false,
        meses: compsOrdenadas.map(c => getVal(data[c], metrica.id)),
      }))
      .sort((a, b) => (b.meses[lastIdx] || 0) - (a.meses[lastIdx] || 0));
  }, [nivel, filtroUnd, dadosGeralVis, rankingSource, compsOrdenadas, metrica]);

  /* heat map: máximo por coluna (só ranking) */
  const colMaxes = useMemo(() => {
    if (tableRows[0]?.isMetric) return [];
    return compsOrdenadas.map((_, ci) =>
      Math.max(...tableRows.map(r => r.meses[ci] || 0), 1)
    );
  }, [tableRows, compsOrdenadas]);

  const toggleComp = (c) => setSelecionadas(prev =>
    prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c].sort()
  );

  function exportarTabela() {
    if (!tableRows.length) return;
    const cabecalhos = [tableRows[0]?.isMetric ? 'Métrica' : rankingLabel, ...compsOrdenadas.map(fmtCompetencia)];
    const linhas = tableRows.map(r => [r.nome, ...r.meses]);
    baixarCSV(
      `comparativo_${compsOrdenadas.map(c => fmtCompetencia(c).replace('/', '-')).join('_')}.csv`,
      cabecalhos,
      linhas
    );
  }

  const naoSelecionadas = todasComp.filter(c => !selecionadas.includes(c));
  const isGrouped       = nivel !== 'geral';
  const showRanking     = nivel !== 'geral' && !filtroUnd;

  /* escopo textual para subtítulo */
  const escopoLabel = filtroUnd
    ? filtroUnd
    : filtroSec
    ? filtroSec
    : 'Todos';

  /* ─── render ─── */
  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Comparativo de Folhas</h1>
          <p>Análise e comparação de verbas entre competências</p>
        </div>
        <div className="topbar-right no-print"><TopbarAvatar /></div>
      </div>

      <div className="content">

        {/* ══════════ FILTROS ══════════ */}
        <div className="no-print" style={{
          background: 'var(--surface)', border: '1px solid var(--border-c)',
          borderRadius: 14, padding: '18px 22px', marginBottom: 20,
          boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        }}>

          {/* Linha 1: competências + nível */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, flex: 1 }}>
              {compsOrdenadas.map((c, i) => (
                <span key={c} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: `${MES_CORES[i % MES_CORES.length]}18`,
                  border: `1px solid ${MES_CORES[i % MES_CORES.length]}40`,
                  color: MES_CORES[i % MES_CORES.length],
                }}>
                  {fmtCompetencia(c)}
                  {selecionadas.length > 1 && (
                    <button type="button" onClick={() => toggleComp(c)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 0, color: 'inherit', display: 'flex', lineHeight: 1, opacity: .7,
                    }}><X size={10} /></button>
                  )}
                </span>
              ))}
              {naoSelecionadas.length > 0 && (
                <span ref={addRef} style={{ position: 'relative' }}>
                  <button type="button" onClick={() => setAddOpen(v => !v)} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                    background: 'rgba(0, 0, 0, 0.02)', border: '1px dashed rgba(0, 0, 0, 0.08)',
                    color: 'var(--muted-c)', fontSize: 12,
                  }}>
                    <Plus size={10} /> Adicionar
                  </button>
                  {addOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30,
                      background: 'var(--surface)', border: '1px solid var(--border-c)',
                      borderRadius: 10, overflow: 'hidden',
                      boxShadow: '0 8px 32px rgba(0,0,0,.08)', minWidth: 140,
                    }}>
                      {naoSelecionadas.map(c => (
                        <div key={c}
                          onClick={() => { toggleComp(c); setAddOpen(false); }}
                          style={{ padding: '8px 14px', fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(13,124,61,.08)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {fmtCompetencia(c)}
                        </div>
                      ))}
                    </div>
                  )}
                </span>
              )}
            </div>

            {/* level toggle */}
            <div style={{
              display: 'inline-flex', background: '#f1f5f9',
              borderRadius: 10, padding: 3, gap: 2, flexShrink: 0,
            }}>
              {[
                { key: 'geral',      label: 'Geral' },
                { key: 'secretaria', label: 'Secretarias' },
              ].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setNivel(key)} style={{
                  padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  background: nivel === key ? '#0D7C3D' : 'transparent',
                  color: nivel === key ? '#ffffff' : '#64748b',
                }}>
                  {label}
                </button>
              ))}
            </div>

            {/* visão dos cards: resumida / detalhada */}
            <div style={{
              display: 'inline-flex', background: '#f1f5f9',
              borderRadius: 10, padding: 3, gap: 2, flexShrink: 0,
            }}>
              {[
                { val: false, label: 'Resumida', Icon: LayoutGrid },
                { val: true,  label: 'Detalhada', Icon: LayoutList },
              ].map(({ val, label, Icon }) => (
                <button key={label} type="button" onClick={() => setDetalhada(val)} style={{
                  padding: '6px 13px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: detalhada === val ? '#0D7C3D' : 'transparent',
                  color: detalhada === val ? '#ffffff' : '#64748b',
                }}>
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Linha 2: métrica + secretaria + unidade */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            {/* métricas */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '.08em', marginRight: 2 }}>
                Métrica
              </span>
              {METRICAS.map(m => (
                <button key={m.id} type="button" onClick={() => setMetrica(m)} style={{
                  padding: '5px 13px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, transition: 'all .15s',
                  background: metrica.id === m.id ? m.cor : 'rgba(0, 0, 0, 0.03)',
                  color: metrica.id === m.id ? '#fff' : '#64748b',
                  boxShadow: metrica.id === m.id ? `0 0 12px ${m.cor}55` : 'none',
                }}>
                  {m.short}
                </button>
              ))}
            </div>

            {/* separador */}
            <div style={{ width: 1, height: 28, background: 'rgba(0, 0, 0, 0.05)', flexShrink: 0 }} />

            {/* filtros de escopo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Filter size={13} color="#475569" />
              <SearchSelect
                value={filtroSec}
                onChange={(v) => { setFiltroSec(v); setFiltroUnd(''); }}
                options={secOptions}
                placeholder="Secretaria"
                minWidth={160}
                disabled={!secOptions.length}
              />
              <SearchSelect
                value={filtroUnd}
                onChange={setFiltroUnd}
                options={undOptions}
                placeholder="Unidade"
                minWidth={220}
                disabled={!filtroSec || !undOptions.length}
              />
              {(filtroSec || filtroUnd) && (
                <button type="button"
                  onClick={() => { setFiltroSec(''); setFiltroUnd(''); }}
                  style={{
                    background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)',
                    color: '#dc2626', borderRadius: 6, padding: '4px 10px',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <X size={10} /> Limpar
                </button>
              )}
            </div>
          </div>

          {/* breadcrumb de escopo ativo */}
          {(filtroSec || filtroUnd) && (
            <div style={{
              marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0, 0, 0, 0.04)',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted-c)',
            }}>
              <span style={{ color: 'var(--text)' }}>Escopo:</span>
              <span style={{ color: '#15A050', fontWeight: 600 }}>Todos os meses</span>
              {filtroSec && (
                <>
                  <span style={{ color: 'var(--text)' }}>›</span>
                  <span style={{
                    color: '#0D7C3D', fontWeight: 700, padding: '1px 8px',
                    borderRadius: 8, background: 'rgba(13,124,61,.12)',
                  }}>{filtroSec}</span>
                </>
              )}
              {filtroUnd && (
                <>
                  <span style={{ color: 'var(--text)' }}>›</span>
                  <span style={{
                    color: '#10b981', fontWeight: 700, padding: '1px 8px',
                    borderRadius: 8, background: 'rgba(16,185,129,.1)',
                    maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{filtroUnd}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* ══════════ LOADING ══════════ */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text)', fontSize: 13 }}>
            Carregando dados...
          </div>
        )}

        {!loading && selecionadas.length === 0 && (
          <div style={{ textAlign: 'center', padding: 80, color: 'var(--text)', fontSize: 13 }}>
            Selecione ao menos uma competência
          </div>
        )}

        {!loading && selecionadas.length > 0 && (
          <>
            {/* ══════════ PERIOD CARDS ══════════ */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
              {compsOrdenadas.map((c, i) => (
                <PeriodCard
                  key={c}
                  comp={c}
                  dados={dadosGeralVis[c]}
                  prevDados={i === 0 ? null : (dadosGeralVis[compsOrdenadas[i - 1]] ?? null)}
                  cor={MES_CORES[i % MES_CORES.length]}
                  metrica={metrica}
                  detalhada={detalhada}
                />
              ))}
            </div>

            {/* ══════════ GRÁFICO ══════════ */}
            <div className="chart-card" style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div className="chart-title" style={{ fontSize: 15 }}>
                    {nivel === 'geral' || filtroUnd
                      ? `${metrica.label} · ${escopoLabel}`
                      : `${metrica.label} — top ${rankingLabel.toLowerCase()}s · ${escopoLabel}`}
                  </div>
                  <div className="chart-sub">
                    {nivel === 'geral' || filtroUnd
                      ? 'Comparativo entre os meses selecionados'
                      : `Exibindo até 8 maiores · ordenado pelo último período`}
                  </div>
                </div>
                {showRanking && (
                  <div style={{ display: 'flex', gap: 12, flexShrink: 0 }}>
                    {compsOrdenadas.map((c, i) => (
                      <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted-c)' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: MES_CORES[i % MES_CORES.length], display: 'inline-block' }} />
                        {fmtCompetencia(c)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <ResponsiveContainer width="100%" height={showRanking ? 300 : 180}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: showRanking ? 70 : 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(0, 0, 0, 0.02)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                    axisLine={false} tickLine={false}
                    angle={showRanking ? -35 : 0}
                    textAnchor={showRanking ? 'end' : 'middle'}
                    interval={0} dy={showRanking ? 6 : 0}
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.02)' }} />
                  {showRanking ? (
                    compsOrdenadas.map((c, i) => (
                      <Bar key={c} dataKey={fmtCompetencia(c)} fill={MES_CORES[i % MES_CORES.length]}
                        radius={[4, 4, 0, 0]} maxBarSize={32} />
                    ))
                  ) : (
                    <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={100}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ══════════ TABELA ══════════ */}
            <div className="table-card" style={{ overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div className="chart-title" style={{ fontSize: 15 }}>
                    {tableRows[0]?.isMetric
                      ? `Todas as métricas · ${escopoLabel}`
                      : `Ranking por ${rankingLabel.toLowerCase()} — ${metrica.label} · ${escopoLabel}`}
                  </div>
                  {!tableRows[0]?.isMetric && (
                    <div className="chart-sub">{tableRows.length} {rankingLabel.toLowerCase()}s · calor = volume relativo</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  {compsOrdenadas.length > 1 && (
                    <div style={{ fontSize: 11, color: 'var(--muted-c)', textAlign: 'right' }}>
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>▲ aumento</span>
                      {' · '}
                      <span style={{ color: '#047857', fontWeight: 700 }}>▼ redução</span>
                      {' · Δ% = 1º→último'}
                    </div>
                  )}
                  {tableRows.length > 0 && (
                    <button onClick={exportarTabela} style={{
                      padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                      background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.25)',
                      color: '#047857', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>⬇ CSV</button>
                  )}
                </div>
              </div>

              <div className="print-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 0, 0, 0.02)' }}>
                      {!tableRows[0]?.isMetric && (
                        <th style={thSt({ width: 32, textAlign: 'center' })}>#</th>
                      )}
                      <th style={thSt({ textAlign: 'left', minWidth: 160 })}>
                        {tableRows[0]?.isMetric ? 'Métrica' : rankingLabel}
                      </th>
                      {compsOrdenadas.map((c, i) => (
                        <th key={c} style={thSt({ textAlign: 'right', color: MES_CORES[i % MES_CORES.length], minWidth: 90 })}>
                          {fmtCompetencia(c)}
                        </th>
                      ))}
                      {compsOrdenadas.length > 1 && (
                        <th style={thSt({ textAlign: 'right', minWidth: 72 })}>Δ%</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, ri) => {
                      const from = row.meses[0];
                      const to   = row.meses[row.meses.length - 1];
                      const { pct: dp, color: dc, Icon: DI } = deltaInfo(from, to);

                      return (
                        <tr key={row.key}
                          style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.02)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {/* rank */}
                          {!row.isMetric && (
                            <td style={{ textAlign: 'center', padding: '9px 4px', width: 32 }}>
                              {ri < 3 ? (
                                <span style={{
                                  display: 'inline-block', width: 20, height: 20, borderRadius: '50%',
                                  fontSize: 10, fontWeight: 800, lineHeight: '20px', textAlign: 'center',
                                  background: ri === 0 ? '#ef444420' : ri === 1 ? '#f9731620' : '#a855f720',
                                  color:      ri === 0 ? '#ef4444'   : ri === 1 ? '#f97316'   : '#a855f7',
                                }}>
                                  {ri + 1}
                                </span>
                              ) : (
                                <span style={{ fontSize: 10, color: 'var(--text)' }}>{ri + 1}</span>
                              )}
                            </td>
                          )}

                          {/* nome */}
                          <td style={{ padding: '9px 10px', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {row.cor && (
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.cor, flexShrink: 0, display: 'inline-block' }} />
                              )}
                              <span style={{ color: row.cor || '#334155' }}>{row.nome}</span>
                            </div>
                          </td>

                          {/* valores */}
                          {row.meses.map((v, mi) => {
                            const intensity = colMaxes[mi] > 0 ? v / colMaxes[mi] : 0;
                            const heat      = !row.isMetric && intensity > 0.05
                              ? `rgba(239,68,68,${(0.04 + intensity * 0.22).toFixed(2)})`
                              : 'transparent';
                            return (
                              <td key={mi} style={{
                                textAlign: 'right', padding: '9px 12px',
                                fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                                color: 'var(--text)', background: heat, transition: 'background .2s',
                              }}>
                                {fmt(v)}
                              </td>
                            );
                          })}

                          {/* delta */}
                          {compsOrdenadas.length > 1 && (
                            <td style={{ textAlign: 'right', padding: '9px 12px' }}>
                              {dp === null ? (
                                <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 700 }}>novo</span>
                              ) : dp === 0 ? (
                                <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>—</span>
                              ) : (
                                <span style={{
                                  fontSize: 11, fontWeight: 700, color: dc,
                                  display: 'inline-flex', alignItems: 'center', gap: 2,
                                  padding: '2px 7px', borderRadius: 8, background: `${dc}15`,
                                }}>
                                  <DI size={10} />
                                  {dp > 0 ? '+' : ''}{dp.toFixed(1)}%
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}

                    {/* linha de total (ranking) */}
                    {!tableRows[0]?.isMetric && tableRows.length > 0 && (() => {
                      const totais = compsOrdenadas.map((_, ci) =>
                        tableRows.reduce((s, r) => s + (r.meses[ci] || 0), 0)
                      );
                      const { pct: tp, color: tc, Icon: TI } = deltaInfo(totais[0], totais[totais.length - 1]);
                      return (
                        <tr style={{ background: 'rgba(0, 0, 0, 0.02)', borderTop: '2px solid rgba(0, 0, 0, 0.06)' }}>
                          <td style={{ padding: '10px 4px' }} />
                          <td style={{ padding: '10px 10px', fontWeight: 800, color: 'var(--muted-c)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                            Total
                          </td>
                          {totais.map((t, i) => (
                            <td key={i} style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
                              {fmt(t)}
                            </td>
                          ))}
                          {compsOrdenadas.length > 1 && (
                            <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                              {tp !== null && tp !== 0 && (
                                <span style={{
                                  fontSize: 11, fontWeight: 800, color: tc,
                                  display: 'inline-flex', alignItems: 'center', gap: 2,
                                  padding: '2px 7px', borderRadius: 8, background: `${tc}15`,
                                }}>
                                  <TI size={10} />
                                  {tp > 0 ? '+' : ''}{tp.toFixed(1)}%
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })()}

                    {tableRows.length === 0 && (
                      <tr>
                        <td colSpan={compsOrdenadas.length + 3} style={{ padding: 40, textAlign: 'center', color: 'var(--text)' }}>
                          Nenhum dado encontrado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
