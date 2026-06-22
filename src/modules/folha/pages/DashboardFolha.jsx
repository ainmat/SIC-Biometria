import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from 'chart.js';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { baixarCSV } from '@/lib/exportar';
import {
  fetchCompetencias,
  fetchFolhaRanking,
  fetchSecretariasDaCompetencia,
  fetchUnidadesDaCompetencia,
  fetchServidoresDaUnidade,
} from '@/modules/folha/services/folhaService';
import { fmtCompetencia, COR_SEC_FOLHA } from '@/modules/folha/constants';
import { SearchSelect } from '@/components/ui/search-select';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(17,24,39,.95)',
  titleColor: '#f1f5f9',
  bodyColor: '#94a3b8',
  borderColor: 'rgba(99,102,241,.3)',
  borderWidth: 1,
  padding: 10,
};

const METRICAS = [
  { key: 'faltas',         label: 'Faltas',        valor: r => r.faltas,                             cor: '#ef4444' },
  { key: 'atrasos_total',  label: 'Atrasos Total', valor: r => r.atrasos_fracao + r.atrasos_dia,     cor: '#f59e0b' },
  { key: 'atrasos_fracao', label: 'Atr. <1h',      valor: r => r.atrasos_fracao,                     cor: '#fbbf24' },
  { key: 'atrasos_dia',    label: 'Atr. ≥1h',      valor: r => r.atrasos_dia,                        cor: '#f87171' },
  { key: 'he_total',       label: 'HE Total',      valor: r => r.hora_extra_50 + r.hora_extra_100,   cor: '#10b981' },
  { key: 'he50',           label: 'HE 50%',        valor: r => r.hora_extra_50,                      cor: '#34d399' },
  { key: 'he100',          label: 'HE 100%',       valor: r => r.hora_extra_100,                     cor: '#6ee7b7' },
];

const CHART_OPTS = {
  indexAxis: 'y',
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: TOOLTIP_STYLE,
  },
  scales: {
    x: {
      ticks: { color: '#64748b', font: { size: 10 } },
      grid: { color: 'rgba(255,255,255,.04)' },
    },
    y: {
      ticks: { color: '#94a3b8', font: { size: 11 }, mirror: false },
      grid: { display: false },
    },
  },
};

function Th({ label, col, sort, onSort }) {
  const active = sort.col === col;
  return (
    <th onClick={() => onSort(col)} style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {label}
        {active
          ? sort.dir === 'asc'
            ? <ChevronUp size={11} color="#60a5fa" />
            : <ChevronDown size={11} color="#60a5fa" />
          : <ChevronDown size={11} color="rgba(107,114,128,.3)" />}
      </span>
    </th>
  );
}

function ModalDetalhe({ unidade, rows, loading, onClose }) {
  const [vista, setVista] = useState('detalhado');
  if (!unidade) return null;

  return (
    <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 900, maxHeight: '85vh', overflow: 'auto' }}>
        <div className="chamado-modal-header">
          <div>
            <div className="chamado-modal-title">{unidade}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {loading ? 'Carregando...' : `${rows.length} servidores com ocorrências`}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Toggle detalhado/resumido */}
            <div style={{ display: 'flex', gap: 3, padding: '3px', borderRadius: 7, background: 'rgba(255,255,255,.05)' }}>
              {['detalhado', 'resumido'].map(v => (
                <button
                  key={v}
                  onClick={() => setVista(v)}
                  style={{
                    padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                    background: vista === v ? 'rgba(99,102,241,.25)' : 'transparent',
                    color: vista === v ? '#a5b4fc' : '#64748b',
                    transition: 'all .15s',
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
            <button className="chamado-modal-close" onClick={onClose}>×</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#475569' }}>Carregando servidores...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {vista === 'detalhado' ? (
              <table>
                <thead>
                  <tr>
                    <th>Matrícula</th>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th style={{ textAlign: 'center' }}>Faltas</th>
                    <th style={{ textAlign: 'center' }}>Atr. &lt;1h</th>
                    <th style={{ textAlign: 'center' }}>Atr. ≥1h</th>
                    <th style={{ textAlign: 'center' }}>DSR</th>
                    <th style={{ textAlign: 'center' }}>HE 50%</th>
                    <th style={{ textAlign: 'center' }}>HE 100%</th>
                    <th style={{ textAlign: 'center' }}>Ad. Not.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.matricula}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>{r.matricula}</td>
                      <td style={{ fontSize: 11, color: '#f1f5f9', fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome || '—'}</td>
                      <td style={{ fontSize: 10, color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cargo || '—'}</td>
                      {[r.faltas, r.atrasos_fracao, r.atrasos_dia, r.dsr, r.hora_extra_50, r.hora_extra_100, r.adicional_noturno].map((v, i) => (
                        <td key={i} style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: v > 0 ? '#fbbf24' : '#374151' }}>{v ?? 0}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Matrícula</th>
                    <th>Nome</th>
                    <th>Cargo</th>
                    <th style={{ textAlign: 'center' }}>Faltas</th>
                    <th style={{ textAlign: 'center' }}>Total Atrasos</th>
                    <th style={{ textAlign: 'center' }}>DSR</th>
                    <th style={{ textAlign: 'center' }}>Total HE</th>
                    <th style={{ textAlign: 'center' }}>Ad. Not.</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const totalAtrasos = (r.atrasos_dia || 0) + ((r.atrasos_fracao || 0) * 0.333);
                    const totalHE      = (r.hora_extra_50 || 0) + (r.hora_extra_100 || 0);
                    return (
                      <tr key={r.matricula}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>{r.matricula}</td>
                        <td style={{ fontSize: 11, color: '#f1f5f9', fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome || '—'}</td>
                        <td style={{ fontSize: 10, color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cargo || '—'}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.faltas > 0 ? '#fbbf24' : '#374151' }}>{r.faltas ?? 0}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: totalAtrasos > 0 ? '#fbbf24' : '#374151' }}>
                          {totalAtrasos > 0 ? totalAtrasos.toFixed(3).replace('.', ',') : '0'}
                        </td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.dsr > 0 ? '#fbbf24' : '#374151' }}>{r.dsr ?? 0}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: totalHE > 0 ? '#34d399' : '#374151' }}>{totalHE > 0 ? `${totalHE}h` : '0'}</td>
                        <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.adicional_noturno > 0 ? '#a78bfa' : '#374151' }}>{r.adicional_noturno ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardFolha() {
  const [competencias,  setCompetencias]  = useState([]);
  const [secretarias,   setSecretarias]   = useState([]);
  const [unidades,      setUnidades]      = useState([]);
  const [ranking,       setRanking]       = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [statusMsg,     setStatusMsg]     = useState('Selecione uma competência para começar');

  const [filtroComp,    setFiltroComp]    = useState('');
  const [filtroSec,     setFiltroSec]     = useState('');
  const [filtroUnd,     setFiltroUnd]     = useState('');
  const [sort,          setSort]          = useState({ col: 'faltas', dir: 'desc' });
  const [pagina,        setPagina]        = useState(1);
  const [vistaKpi,      setVistaKpi]      = useState('detalhado');
  const [metricaKey,    setMetricaKey]    = useState('faltas');

  const [inlineRows,    setInlineRows]    = useState([]);
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineVista,   setInlineVista]   = useState('detalhado');
  const [inlineSearch,  setInlineSearch]  = useState('');
  const [inlineSort,    setInlineSort]    = useState({ col: 'faltas', dir: 'desc' });

  const [modalUnidade,  setModalUnidade]  = useState(null);
  const [modalRows,     setModalRows]     = useState([]);
  const [modalLoading,  setModalLoading]  = useState(false);
  const POR_PAG = 20;

  useEffect(() => {
    fetchCompetencias().then(setCompetencias).catch(console.error);
  }, []);

  useEffect(() => {
    if (!filtroComp) { setSecretarias([]); setUnidades([]); setRanking([]); return; }
    fetchSecretariasDaCompetencia(filtroComp).then(setSecretarias).catch(console.error);
    setFiltroSec('');
    setFiltroUnd('');
    setUnidades([]);
  }, [filtroComp]);

  useEffect(() => {
    if (!filtroComp) return;
    fetchUnidadesDaCompetencia(filtroComp, filtroSec || null).then(setUnidades).catch(console.error);
    setFiltroUnd('');
  }, [filtroComp, filtroSec]);

  const carregar = useCallback(async () => {
    if (!filtroComp) return;
    setLoading(true);
    try {
      const data = await fetchFolhaRanking({
        competencia: filtroComp,
        secretaria: filtroSec || null,
        unidade: filtroUnd || null,
      });
      setRanking(data);
      const totalServ = data.reduce((s, r) => s + r.servidores, 0);
      setStatusMsg(`${totalServ.toLocaleString('pt-BR')} servidores — ${fmtCompetencia(filtroComp)}`);
    } catch (e) {
      console.error(e);
      setStatusMsg('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [filtroComp, filtroSec, filtroUnd]);

  useEffect(() => {
    carregar();
    setPagina(1);
  }, [carregar]);

  useEffect(() => {
    if (!filtroUnd || !filtroComp) { setInlineRows([]); return; }
    setInlineLoading(true);
    fetchServidoresDaUnidade(filtroComp, filtroUnd)
      .then(setInlineRows)
      .catch(console.error)
      .finally(() => setInlineLoading(false));
  }, [filtroUnd, filtroComp]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') setModalUnidade(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  async function abrirModal(unidade) {
    setModalUnidade(unidade);
    setModalRows([]);
    setModalLoading(true);
    try {
      const rows = await fetchServidoresDaUnidade(filtroComp, unidade);
      setModalRows(rows);
    } catch (e) {
      console.error(e);
    } finally {
      setModalLoading(false);
    }
  }

  // KPIs — soma das unidades já agregadas
  const kpis = useMemo(() => ({
    servidores:  ranking.reduce((s, r) => s + r.servidores, 0),
    faltas:      ranking.reduce((s, r) => s + r.faltas, 0),
    atrFracoes:  ranking.reduce((s, r) => s + r.atrasos_fracao, 0),
    atrDias:     ranking.reduce((s, r) => s + r.atrasos_dia, 0),
    dsr:         ranking.reduce((s, r) => s + r.dsr, 0),
    he50:        ranking.reduce((s, r) => s + r.hora_extra_50, 0),
    he100:       ranking.reduce((s, r) => s + r.hora_extra_100, 0),
  }), [ranking]);

  const metrica = METRICAS.find(m => m.key === metricaKey) || METRICAS[0];

  // Quando nenhuma secretaria selecionada: agrupa por secretaria
  // Quando secretaria selecionada: top 10 unidades
  const chartItems = useMemo(() => {
    if (filtroSec) {
      return [...ranking]
        .sort((a, b) => metrica.valor(b) - metrica.valor(a))
        .slice(0, 10);
    }
    const map = {};
    ranking.forEach(r => {
      const key = r.secretaria_sigla || 'N/I';
      if (!map[key]) map[key] = {
        secretaria_sigla: key,
        servidores: 0, faltas: 0,
        atrasos_fracao: 0, atrasos_dia: 0,
        dsr: 0, hora_extra_50: 0, hora_extra_100: 0,
      };
      map[key].servidores     += r.servidores || 0;
      map[key].faltas         += r.faltas || 0;
      map[key].atrasos_fracao += r.atrasos_fracao || 0;
      map[key].atrasos_dia    += r.atrasos_dia || 0;
      map[key].dsr            += r.dsr || 0;
      map[key].hora_extra_50  += r.hora_extra_50 || 0;
      map[key].hora_extra_100 += r.hora_extra_100 || 0;
    });
    return Object.values(map).sort((a, b) => metrica.valor(b) - metrica.valor(a)).slice(0, 5);
  }, [ranking, filtroSec, metrica]);

  const chartData = useMemo(() => ({
    labels: chartItems.map(r => {
      const nome = filtroSec ? (r.unidade || 'N/I') : (r.secretaria_sigla || 'N/I');
      return nome.length > 38 ? nome.slice(0, 36) + '…' : nome;
    }),
    datasets: [{
      label: metrica.label,
      data: chartItems.map(r => metrica.valor(r)),
      backgroundColor: chartItems.map(r => (COR_SEC_FOLHA[r.secretaria_sigla] || '#6366f1') + 'bb'),
      borderColor:     chartItems.map(r => (COR_SEC_FOLHA[r.secretaria_sigla] || '#6366f1')),
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
    }],
  }), [chartItems, metrica, filtroSec]);

  const inlineFiltered = useMemo(() => {
    const q = inlineSearch.toLowerCase();
    const rows = q
      ? inlineRows.filter(r =>
          (r.nome || '').toLowerCase().includes(q) ||
          String(r.matricula || '').toLowerCase().includes(q)
        )
      : inlineRows;
    return [...rows].sort((a, b) => {
      const col = inlineSort.col;
      const va = col === 'atrasos_total' ? (a.atrasos_fracao + a.atrasos_dia) : col === 'he_total' ? (a.hora_extra_50 + a.hora_extra_100) : (a[col] ?? 0);
      const vb = col === 'atrasos_total' ? (b.atrasos_fracao + b.atrasos_dia) : col === 'he_total' ? (b.hora_extra_50 + b.hora_extra_100) : (b[col] ?? 0);
      return inlineSort.dir === 'asc' ? va - vb : vb - va;
    });
  }, [inlineRows, inlineSearch, inlineSort]);

  const toggleInlineSort = (col) =>
    setInlineSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });

  // Ordenação do ranking
  const sortedRanking = useMemo(() => {
    const s = [...ranking];
    s.sort((a, b) => {
      const va = a[sort.col] ?? 0;
      const vb = b[sort.col] ?? 0;
      return sort.dir === 'asc'
        ? (typeof va === 'string' ? va.localeCompare(vb) : va - vb)
        : (typeof va === 'string' ? vb.localeCompare(va) : vb - va);
    });
    return s;
  }, [ranking, sort]);

  const totalPags = Math.ceil(sortedRanking.length / POR_PAG);
  const paginaAtual = sortedRanking.slice((pagina - 1) * POR_PAG, pagina * POR_PAG);

  const toggleSort = (col) => {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
    setPagina(1);
  };

  function exportarServidores() {
    if (!inlineFiltered.length) return;
    baixarCSV(
      `servidores_${filtroUnd.slice(0, 40).replace(/[^a-z0-9]/gi, '_')}_${fmtCompetencia(filtroComp).replace('/', '-')}.csv`,
      ['Matrícula', 'Nome', 'Cargo', 'Faltas', 'Atr. <1h', 'Atr. ≥1h', 'DSR', 'HE 50%', 'HE 100%', 'Ad. Not.'],
      inlineFiltered.map(r => [r.matricula, r.nome || '', r.cargo || '', r.faltas ?? 0, r.atrasos_fracao ?? 0, r.atrasos_dia ?? 0, r.dsr ?? 0, r.hora_extra_50 ?? 0, r.hora_extra_100 ?? 0, r.adicional_noturno ?? 0])
    );
  }

  function exportarRanking() {
    if (!sortedRanking.length) return;
    baixarCSV(
      `ranking_${fmtCompetencia(filtroComp).replace('/', '-')}${filtroSec ? `_${filtroSec}` : ''}.csv`,
      ['Unidade', 'Secretaria', 'Servidores', 'Faltas', 'Atr. <1h', 'Atr. ≥1h', 'DSR', 'HE 50%', 'HE 100%'],
      sortedRanking.map(r => [r.unidade, r.secretaria_sigla, r.servidores, r.faltas, r.atrasos_fracao, r.atrasos_dia, r.dsr, r.hora_extra_50, r.hora_extra_100])
    );
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Prévia da Folha</h1>
          <p>{loading ? 'Carregando...' : statusMsg}</p>
        </div>
        <div className="topbar-right">
          <div className="avatar">MC</div>
        </div>
      </div>

      <div className="content">
        {/* Filtros — ocultos na impressão */}
        <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-end' }}>
          <div>
            <div className="filter-label" style={{ marginBottom: 5 }}>Competência*</div>
            <select
              value={filtroComp}
              onChange={e => setFiltroComp(e.target.value)}
              className="sel-dark"
              style={{ minWidth: 140, borderRadius: 6, border: '1px solid rgba(255,255,255,.1)', color: filtroComp ? '#f1f5f9' : '#64748b', fontSize: 13 }}
            >
              <option value="">Selecione...</option>
              {competencias.map(c => <option key={c} value={c}>{fmtCompetencia(c)}</option>)}
            </select>
          </div>
          <SearchSelect
            label="Secretaria"
            value={filtroSec}
            onChange={setFiltroSec}
            disabled={!filtroComp}
            placeholder="Todas"
            minWidth={140}
            options={secretarias.map(s => ({ value: s.sigla, label: `${s.sigla}${s.nome ? ` — ${s.nome}` : ''}` }))}
          />
          <SearchSelect
            label="Unidade"
            value={filtroUnd}
            onChange={setFiltroUnd}
            disabled={!filtroComp}
            placeholder="Todas"
            minWidth={280}
            options={unidades.map(u => ({ value: u, label: u }))}
          />
        </div>

        {!filtroComp && (
          <div className="chart-card" style={{ textAlign: 'center', padding: 60, color: '#475569' }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Selecione uma competência</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Os dados serão carregados após a seleção</div>
          </div>
        )}

        {filtroComp && !loading && (
          <>
            {/* KPIs — toggle detalhado/resumido */}
            <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 3, padding: '3px', borderRadius: 7, background: 'rgba(255,255,255,.05)' }}>
                {['detalhado', 'resumido'].map(v => (
                  <button
                    key={v}
                    onClick={() => setVistaKpi(v)}
                    style={{
                      padding: '3px 12px', borderRadius: 5, border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                      background: vistaKpi === v ? 'rgba(99,102,241,.25)' : 'transparent',
                      color: vistaKpi === v ? '#a5b4fc' : '#64748b',
                      transition: 'all .15s',
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {vistaKpi === 'detalhado' ? (
              <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
                {[
                  { label: 'Servidores',  value: kpis.servidores,  color: '#60a5fa', bg: '#3b82f6' },
                  { label: 'Faltas',      value: kpis.faltas,      color: '#f87171', bg: '#ef4444' },
                  { label: 'Atrasos <1h', value: kpis.atrFracoes,  color: '#fbbf24', bg: '#f59e0b' },
                  { label: 'Atrasos ≥1h', value: kpis.atrDias,    color: '#f87171', bg: '#ef4444' },
                  { label: 'DSR',         value: kpis.dsr,         color: '#a78bfa', bg: '#8b5cf6' },
                  { label: 'HE 50%',      value: kpis.he50,        color: '#34d399', bg: '#10b981' },
                  { label: 'HE 100%',     value: kpis.he100,       color: '#34d399', bg: '#10b981' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="kpi-card">
                    <div className="kpi-accent" style={{ background: bg }} />
                    <div className="kpi-label">{label}</div>
                    <div className="kpi-value" style={{ color, fontSize: 28, paddingLeft: 10 }}>
                      {value.toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(5,1fr)', marginBottom: 20 }}>
                {[
                  { label: 'Servidores',     value: kpis.servidores,                   color: '#60a5fa', bg: '#3b82f6' },
                  { label: 'Faltas',         value: kpis.faltas,                       color: '#f87171', bg: '#ef4444' },
                  { label: 'Total Atrasos',  value: kpis.atrFracoes + kpis.atrDias,    color: '#fbbf24', bg: '#f59e0b' },
                  { label: 'DSR',            value: kpis.dsr,                          color: '#a78bfa', bg: '#8b5cf6' },
                  { label: 'Total HE',       value: kpis.he50 + kpis.he100,            color: '#34d399', bg: '#10b981' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} className="kpi-card">
                    <div className="kpi-accent" style={{ background: bg }} />
                    <div className="kpi-label">{label}</div>
                    <div className="kpi-value" style={{ color, fontSize: 28, paddingLeft: 10 }}>
                      {value.toLocaleString('pt-BR')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Servidores inline quando unidade selecionada */}
            {filtroUnd && (
              <div className="table-card" style={{ marginBottom: 20 }}>
                <div className="chart-header" style={{ marginBottom: 16 }}>
                  <div>
                    <div className="chart-title">Servidores da Unidade</div>
                    <div className="chart-sub">
                      {inlineLoading ? 'Carregando...' : `${inlineRows.length} servidor${inlineRows.length !== 1 ? 'es' : ''} com ocorrências`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {inlineFiltered.length > 0 && (
                      <button onClick={exportarServidores} style={{
                        padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                        background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.25)',
                        color: '#34d399', fontSize: 11, fontWeight: 600,
                      }}>⬇ CSV</button>
                    )}
                  <div style={{ display: 'flex', gap: 3, padding: '3px', borderRadius: 7, background: 'rgba(255,255,255,.05)' }}>
                    {['detalhado', 'resumido'].map(v => (
                      <button key={v} onClick={() => setInlineVista(v)} style={{
                        padding: '3px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                        fontSize: 11, fontWeight: 600, textTransform: 'capitalize',
                        background: inlineVista === v ? 'rgba(99,102,241,.25)' : 'transparent',
                        color: inlineVista === v ? '#a5b4fc' : '#64748b', transition: 'all .15s',
                      }}>{v}</button>
                    ))}
                  </div>
                  </div>
                </div>

                {inlineLoading ? (
                  <div style={{ textAlign: 'center', padding: 32, color: '#475569' }}>Carregando servidores...</div>
                ) : (
                  <>
                    {/* Busca — oculta na impressão */}
                    <div className="no-print" style={{ marginBottom: 10 }}>
                      <input
                        value={inlineSearch}
                        onChange={e => setInlineSearch(e.target.value)}
                        placeholder="Buscar por nome ou matrícula..."
                        style={{
                          width: '100%', maxWidth: 340, background: 'rgba(255,255,255,.05)',
                          border: '1px solid rgba(255,255,255,.1)', borderRadius: 6,
                          padding: '6px 10px', color: '#f1f5f9', fontSize: 12, outline: 'none',
                        }}
                      />
                      {inlineSearch && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#64748b' }}>
                          {inlineFiltered.length} resultado{inlineFiltered.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="print-table-wrap" style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                      {inlineVista === 'detalhado' ? (
                        <table>
                          <thead>
                            <tr>
                              <th>Matrícula</th><th>Nome</th><th>Cargo</th>
                              <Th label="Faltas"    col="faltas"         sort={inlineSort} onSort={toggleInlineSort} />
                              <Th label="Atr. <1h"  col="atrasos_fracao" sort={inlineSort} onSort={toggleInlineSort} />
                              <Th label="Atr. ≥1h"  col="atrasos_dia"    sort={inlineSort} onSort={toggleInlineSort} />
                              <Th label="DSR"       col="dsr"            sort={inlineSort} onSort={toggleInlineSort} />
                              <Th label="HE 50%"    col="hora_extra_50"  sort={inlineSort} onSort={toggleInlineSort} />
                              <Th label="HE 100%"   col="hora_extra_100" sort={inlineSort} onSort={toggleInlineSort} />
                              <Th label="Ad. Not."  col="adicional_noturno" sort={inlineSort} onSort={toggleInlineSort} />
                            </tr>
                          </thead>
                          <tbody>
                            {inlineFiltered.map(r => (
                              <tr key={r.matricula}>
                                <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>{r.matricula}</td>
                                <td style={{ fontSize: 11, color: '#f1f5f9', fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome || '—'}</td>
                                <td style={{ fontSize: 10, color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cargo || '—'}</td>
                                {[r.faltas, r.atrasos_fracao, r.atrasos_dia, r.dsr, r.hora_extra_50, r.hora_extra_100, r.adicional_noturno].map((v, i) => (
                                  <td key={i} style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: v > 0 ? '#fbbf24' : '#374151' }}>{v ?? 0}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <table>
                          <thead>
                            <tr>
                              <th>Matrícula</th><th>Nome</th><th>Cargo</th>
                              <Th label="Faltas"        col="faltas"        sort={inlineSort} onSort={toggleInlineSort} />
                              <Th label="Total Atrasos" col="atrasos_total"  sort={inlineSort} onSort={toggleInlineSort} />
                              <Th label="DSR"           col="dsr"           sort={inlineSort} onSort={toggleInlineSort} />
                              <Th label="Total HE"      col="he_total"      sort={inlineSort} onSort={toggleInlineSort} />
                              <Th label="Ad. Not."      col="adicional_noturno" sort={inlineSort} onSort={toggleInlineSort} />
                            </tr>
                          </thead>
                          <tbody>
                            {inlineFiltered.map(r => {
                              const totalAtrasos = (r.atrasos_dia || 0) + ((r.atrasos_fracao || 0) * 0.333);
                              const totalHE = (r.hora_extra_50 || 0) + (r.hora_extra_100 || 0);
                              return (
                                <tr key={r.matricula}>
                                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#60a5fa', fontWeight: 600 }}>{r.matricula}</td>
                                  <td style={{ fontSize: 11, color: '#f1f5f9', fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome || '—'}</td>
                                  <td style={{ fontSize: 10, color: '#64748b', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.cargo || '—'}</td>
                                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.faltas > 0 ? '#fbbf24' : '#374151' }}>{r.faltas ?? 0}</td>
                                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: totalAtrasos > 0 ? '#fbbf24' : '#374151' }}>
                                    {totalAtrasos > 0 ? totalAtrasos.toFixed(3).replace('.', ',') : '0'}
                                  </td>
                                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.dsr > 0 ? '#fbbf24' : '#374151' }}>{r.dsr ?? 0}</td>
                                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: totalHE > 0 ? '#34d399' : '#374151' }}>{totalHE > 0 ? `${totalHE}h` : '0'}</td>
                                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: r.adicional_noturno > 0 ? '#a78bfa' : '#374151' }}>{r.adicional_noturno ?? 0}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Gráfico — secretarias ou top 10 unidades */}
            {!filtroUnd && chartItems.length > 0 ? (
              <div className="chart-card" style={{ marginBottom: 20 }}>
                <div className="chart-header" style={{ marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div className="chart-title">
                      {filtroSec ? `Top 10 unidades` : `Secretarias`} — {metrica.label}
                    </div>
                    <div className="chart-sub">{fmtCompetencia(filtroComp)}{filtroSec ? ` · ${filtroSec}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {METRICAS.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setMetricaKey(m.key)}
                        style={{
                          padding: '4px 10px', borderRadius: 6, border: `1px solid ${metricaKey === m.key ? m.cor + '60' : 'rgba(255,255,255,.08)'}`,
                          background: metricaKey === m.key ? m.cor + '20' : 'rgba(255,255,255,.03)',
                          color: metricaKey === m.key ? m.cor : '#64748b',
                          fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ height: 320 }}>
                  <Bar data={chartData} options={CHART_OPTS} />
                </div>
              </div>
            ) : null}

            {/* Ranking unidades — oculto quando unidade selecionada */}
            {!filtroUnd && <div className="table-card">
              <div className="chart-header" style={{ marginBottom: 16 }}>
                <div>
                  <div className="chart-title">Ranking de Unidades</div>
                  <div className="chart-sub">Clique na unidade para ver os servidores</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{sortedRanking.length} unidades</span>
                  {sortedRanking.length > 0 && (
                    <button onClick={exportarRanking} style={{
                      padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                      background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.25)',
                      color: '#34d399', fontSize: 11, fontWeight: 600,
                    }}>⬇ CSV</button>
                  )}
                </div>
              </div>
              <div className="print-table-wrap" style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <Th label="Unidade"    col="unidade"    sort={sort} onSort={toggleSort} />
                      <Th label="Sec."       col="secretaria_sigla" sort={sort} onSort={toggleSort} />
                      <Th label="Serv."      col="servidores" sort={sort} onSort={toggleSort} />
                      <Th label="Faltas"     col="faltas"     sort={sort} onSort={toggleSort} />
                      <Th label="Atr. <1h"   col="atrasos_fracao" sort={sort} onSort={toggleSort} />
                      <Th label="Atr. ≥1h"   col="atrasos_dia"   sort={sort} onSort={toggleSort} />
                      <Th label="DSR"        col="dsr"        sort={sort} onSort={toggleSort} />
                      <Th label="HE 50%"     col="hora_extra_50"  sort={sort} onSort={toggleSort} />
                      <Th label="HE 100%"    col="hora_extra_100" sort={sort} onSort={toggleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {paginaAtual.map(r => {
                      const cor = COR_SEC_FOLHA[r.secretaria_sigla] || '#64748b';
                      return (
                        <tr key={r.unidade} className="clickable-row" onClick={() => abrirModal(r.unidade)}>
                          <td style={{ fontSize: 11, color: '#f1f5f9', fontWeight: 500, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.unidade}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: `${cor}20`, color: cor, fontWeight: 700, textTransform: 'uppercase' }}>
                              {r.secretaria_sigla}
                            </span>
                          </td>
                          {[r.servidores, r.faltas, r.atrasos_fracao, r.atrasos_dia, r.dsr, r.hora_extra_50, r.hora_extra_100].map((v, i) => (
                            <td key={i} style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 11, color: v > 0 ? '#e2e8f0' : '#374151' }}>{v}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPags > 1 && (
                <div className="no-print" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
                  <button
                    disabled={pagina === 1}
                    onClick={() => setPagina(p => p - 1)}
                    style={{ padding: '5px 12px', borderRadius: 5, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#94a3b8', cursor: pagina === 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}
                  >← Ant.</button>
                  <span style={{ fontSize: 12, color: '#64748b' }}>{pagina} / {totalPags}</span>
                  <button
                    disabled={pagina === totalPags}
                    onClick={() => setPagina(p => p + 1)}
                    style={{ padding: '5px 12px', borderRadius: 5, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.08)', color: '#94a3b8', cursor: pagina === totalPags ? 'not-allowed' : 'pointer', fontSize: 12 }}
                  >Próx. →</button>
                </div>
              )}
            </div>}
          </>
        )}
      </div>

      <ModalDetalhe
        unidade={modalUnidade}
        rows={modalRows}
        loading={modalLoading}
        onClose={() => setModalUnidade(null)}
      />
    </div>
  );
}
