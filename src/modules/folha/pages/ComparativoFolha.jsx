import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, CartesianGrid,
} from 'recharts';
import { X, Plus, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react';
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

const METRICAS = [
  { id: 'faltas',         label: 'Faltas',          short: 'Faltas',   cor: '#ef4444' },
  { id: 'atrasos_dia',    label: 'Atrasos ≥ 1h',    short: 'Atr ≥1h', cor: '#f97316' },
  { id: 'atrasos_fracao', label: 'Atrasos < 1h',    short: 'Atr <1h', cor: '#eab308' },
  { id: 'dsr',            label: 'DSR',              short: 'DSR',      cor: '#a855f7' },
  { id: 'hora_extra_50',  label: 'HE 50%',          short: 'HE 50%',  cor: '#3b82f6' },
  { id: 'hora_extra_100', label: 'HE 100%',         short: 'HE 100%', cor: '#10b981' },
];

const MES_CORES = ['#6366f1', '#3b82f6', '#10b981', '#f97316', '#ec4899', '#a855f7'];

const N    = (v) => Number(v || 0);
const fmt  = (n) => Math.round(n).toLocaleString('pt-BR');
const fmtK = (n) => n >= 10000 ? (n / 1000).toFixed(0) + 'k'
                   : n >= 1000  ? (n / 1000).toFixed(1) + 'k'
                   : Math.round(n).toString();

/* ─────────────────────────── helpers ───────────────────────────── */

function deltaInfo(from, to) {
  if (from === 0 && to === 0) return { pct: 0,    color: '#475569', Icon: Minus };
  if (from === 0)             return { pct: null,  color: '#f87171', Icon: TrendingUp };
  const pct = ((to - from) / from) * 100;
  return {
    pct,
    color: pct > 0 ? '#f87171' : pct < 0 ? '#34d399' : '#475569',
    Icon:  pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus,
  };
}

function thSt(extra = {}) {
  return {
    padding: '10px 10px', fontWeight: 700, fontSize: 10,
    textTransform: 'uppercase', letterSpacing: '.06em',
    borderBottom: '1px solid rgba(255,255,255,.08)',
    color: '#475569', whiteSpace: 'nowrap',
    ...extra,
  };
}

/* ─────────────────────────── sub-components ────────────────────── */

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(10,17,32,.97)', border: '1px solid rgba(255,255,255,.12)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,.6)',
    }}>
      <div style={{ fontWeight: 700, color: '#f1f5f9', marginBottom: 8, fontSize: 11, letterSpacing: '.04em' }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, padding: '2px 0' }}>
          <span style={{ color: p.fill || p.color, fontWeight: 600 }}>{p.dataKey || p.name}</span>
          <span style={{ color: '#f1f5f9', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PeriodCard({ comp, dados, prevDados, cor, metrica }) {
  const val     = N(dados?.[metrica.id]);
  const prevVal = N(prevDados?.[metrica.id]);
  const { pct, color: dColor, Icon: DIcon } = deltaInfo(prevVal, val);
  const hasDelta  = prevDados !== null;
  const secondary = METRICAS.filter(m => m.id !== metrica.id);

  return (
    <div style={{
      flex: 1, minWidth: 0,
      background: 'linear-gradient(160deg, rgba(255,255,255,.04) 0%, rgba(255,255,255,.015) 100%)',
      border: '1px solid rgba(255,255,255,.08)',
      borderTop: `3px solid ${cor}`,
      borderRadius: 14, padding: '20px 22px',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
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
        <div style={{ fontSize: 42, fontWeight: 800, color: '#f8fafc', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>
          {fmt(val)}
        </div>
        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{metrica.label}</span>
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
            <span style={{ fontSize: 10, color: '#f87171', fontWeight: 600 }}>novo</span>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '14px 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {secondary.map(m => {
          const sv  = N(dados?.[m.id]);
          const spv = N(prevDados?.[m.id]);
          const { pct: sp, color: sc } = deltaInfo(spv, sv);
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.cor, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#475569' }}>{m.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {hasDelta && sp !== null && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: sc }}>
                    {sp > 0 ? '+' : ''}{sp.toFixed(0)}%
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>
                  {fmtK(sv)}
                </span>
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,.04)' }}>
          <span style={{ fontSize: 10, color: '#334155', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            servidores c/ oc.
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#475569', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(N(dados?.servidores ?? 0))}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── main component ────────────────────── */

export default function ComparativoFolha() {
  const [todasComp,    setTodasComp]    = useState([]);
  const [selecionadas, setSelecionadas] = useState([]);
  const [nivel,        setNivel]        = useState('geral');
  const [metrica,      setMetrica]      = useState(METRICAS[0]);

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
    if (filtroSec) return dadosUnd;       // dentro de uma secretaria → mostra unidades
    if (nivel === 'secretaria') return dadosSec;
    return dadosSec;                      // default
  }, [filtroSec, nivel, dadosSec, dadosUnd]);

  const rankingLabel = filtroSec ? 'Unidade' : 'Secretaria';

  const secOptions = useMemo(
    () => Object.keys(dadosSec).sort().map(s => ({ value: s, label: s })),
    [dadosSec]
  );
  const undOptions = useMemo(
    () => Object.keys(dadosUnd).sort().map(u => ({ value: u, label: u })),
    [dadosUnd]
  );

  /* ── chart data ── */
  const chartData = useMemo(() => {
    if (nivel === 'geral') {
      return compsOrdenadas.map((c, i) => ({
        name: fmtCompetencia(c),
        value: N(dadosGeralVis[c]?.[metrica.id]),
        fill: MES_CORES[i % MES_CORES.length],
      }));
    }
    const source   = rankingSource;
    const lastComp = compsOrdenadas[compsOrdenadas.length - 1];
    return Object.entries(source)
      .sort((a, b) => N(b[1][lastComp]?.[metrica.id]) - N(a[1][lastComp]?.[metrica.id]))
      .slice(0, 8)
      .map(([nome, data]) => {
        const row = { name: nome.length > 24 ? nome.slice(0, 22) + '…' : nome };
        compsOrdenadas.forEach(c => { row[fmtCompetencia(c)] = N(data[c]?.[metrica.id]); });
        return row;
      });
  }, [nivel, dadosGeralVis, rankingSource, compsOrdenadas, metrica]);

  /* ── table rows ── */
  const tableRows = useMemo(() => {
    if (nivel === 'geral' || filtroUnd) {
      // métricas como linhas
      return METRICAS.map(m => ({
        key: m.id, nome: m.label, cor: m.cor, isMetric: true,
        meses: compsOrdenadas.map(c => N(dadosGeralVis[c]?.[m.id])),
      }));
    }
    const source  = rankingSource;
    const lastIdx = compsOrdenadas.length - 1;
    return Object.entries(source)
      .map(([nome, data]) => ({
        key: nome, nome, cor: null, isMetric: false,
        meses: compsOrdenadas.map(c => N(data[c]?.[metrica.id])),
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
        <div className="topbar-right no-print"><div className="avatar">MC</div></div>
      </div>

      <div className="content">

        {/* ══════════ FILTROS ══════════ */}
        <div className="no-print" style={{
          background: 'rgba(15,23,42,.7)', border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 14, padding: '18px 22px', marginBottom: 20,
          backdropFilter: 'blur(12px)',
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
                    background: 'rgba(255,255,255,.04)', border: '1px dashed rgba(255,255,255,.15)',
                    color: '#64748b', fontSize: 12,
                  }}>
                    <Plus size={10} /> Adicionar
                  </button>
                  {addOpen && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 30,
                      background: '#0f172a', border: '1px solid rgba(255,255,255,.12)',
                      borderRadius: 10, overflow: 'hidden',
                      boxShadow: '0 12px 40px rgba(0,0,0,.7)', minWidth: 140,
                    }}>
                      {naoSelecionadas.map(c => (
                        <div key={c}
                          onClick={() => { toggleComp(c); setAddOpen(false); }}
                          style={{ padding: '8px 14px', fontSize: 12, color: '#f1f5f9', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,.15)'; }}
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
              display: 'inline-flex', background: 'rgba(0,0,0,.3)',
              borderRadius: 10, padding: 3, gap: 2, flexShrink: 0,
            }}>
              {[
                { key: 'geral',      label: 'Geral' },
                { key: 'secretaria', label: 'Secretarias' },
              ].map(({ key, label }) => (
                <button key={key} type="button" onClick={() => setNivel(key)} style={{
                  padding: '6px 16px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, transition: 'all .15s',
                  background: nivel === key ? 'rgba(99,102,241,.35)' : 'transparent',
                  color: nivel === key ? '#a5b4fc' : '#64748b',
                }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Linha 2: métrica + secretaria + unidade */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
            {/* métricas */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '.08em', marginRight: 2 }}>
                Métrica
              </span>
              {METRICAS.map(m => (
                <button key={m.id} type="button" onClick={() => setMetrica(m)} style={{
                  padding: '5px 13px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700, transition: 'all .15s',
                  background: metrica.id === m.id ? m.cor : 'rgba(255,255,255,.05)',
                  color: metrica.id === m.id ? '#fff' : '#64748b',
                  boxShadow: metrica.id === m.id ? `0 0 12px ${m.cor}55` : 'none',
                }}>
                  {m.short}
                </button>
              ))}
            </div>

            {/* separador */}
            <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,.08)', flexShrink: 0 }} />

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
                    color: '#f87171', borderRadius: 6, padding: '4px 10px',
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
              marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b',
            }}>
              <span style={{ color: '#334155' }}>Escopo:</span>
              <span style={{ color: '#a5b4fc', fontWeight: 600 }}>Todos os meses</span>
              {filtroSec && (
                <>
                  <span style={{ color: '#334155' }}>›</span>
                  <span style={{
                    color: '#6366f1', fontWeight: 700, padding: '1px 8px',
                    borderRadius: 8, background: 'rgba(99,102,241,.12)',
                  }}>{filtroSec}</span>
                </>
              )}
              {filtroUnd && (
                <>
                  <span style={{ color: '#334155' }}>›</span>
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
          <div style={{ textAlign: 'center', padding: 80, color: '#334155', fontSize: 13 }}>
            Carregando dados...
          </div>
        )}

        {!loading && selecionadas.length === 0 && (
          <div style={{ textAlign: 'center', padding: 80, color: '#334155', fontSize: 13 }}>
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
                      <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#64748b' }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: MES_CORES[i % MES_CORES.length], display: 'inline-block' }} />
                        {fmtCompetencia(c)}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <ResponsiveContainer width="100%" height={showRanking ? 300 : 180}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: showRanking ? 70 : 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,.04)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                    axisLine={false} tickLine={false}
                    angle={showRanking ? -35 : 0}
                    textAnchor={showRanking ? 'end' : 'middle'}
                    interval={0} dy={showRanking ? 6 : 0}
                  />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} width={46} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,.03)' }} />
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
                    <div style={{ fontSize: 11, color: '#475569', textAlign: 'right' }}>
                      <span style={{ color: '#f87171', fontWeight: 700 }}>▲ aumento</span>
                      {' · '}
                      <span style={{ color: '#34d399', fontWeight: 700 }}>▼ redução</span>
                      {' · Δ% = 1º→último'}
                    </div>
                  )}
                  {tableRows.length > 0 && (
                    <button onClick={exportarTabela} style={{
                      padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                      background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.25)',
                      color: '#34d399', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
                    }}>⬇ CSV</button>
                  )}
                </div>
              </div>

              <div className="print-table-wrap" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,.03)' }}>
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
                          style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.03)'; }}
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
                                <span style={{ fontSize: 10, color: '#334155' }}>{ri + 1}</span>
                              )}
                            </td>
                          )}

                          {/* nome */}
                          <td style={{ padding: '9px 10px', fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {row.cor && (
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.cor, flexShrink: 0, display: 'inline-block' }} />
                              )}
                              <span style={{ color: row.cor || '#e2e8f0' }}>{row.nome}</span>
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
                                color: '#e2e8f0', background: heat, transition: 'background .2s',
                              }}>
                                {fmt(v)}
                              </td>
                            );
                          })}

                          {/* delta */}
                          {compsOrdenadas.length > 1 && (
                            <td style={{ textAlign: 'right', padding: '9px 12px' }}>
                              {dp === null ? (
                                <span style={{ fontSize: 11, color: '#f87171', fontWeight: 700 }}>novo</span>
                              ) : dp === 0 ? (
                                <span style={{ fontSize: 11, color: '#475569' }}>—</span>
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
                        <tr style={{ background: 'rgba(255,255,255,.04)', borderTop: '2px solid rgba(255,255,255,.1)' }}>
                          <td style={{ padding: '10px 4px' }} />
                          <td style={{ padding: '10px 10px', fontWeight: 800, color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                            Total
                          </td>
                          {totais.map((t, i) => (
                            <td key={i} style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 800, color: '#f1f5f9', fontVariantNumeric: 'tabular-nums', fontSize: 13 }}>
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
                        <td colSpan={compsOrdenadas.length + 3} style={{ padding: 40, textAlign: 'center', color: '#334155' }}>
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
