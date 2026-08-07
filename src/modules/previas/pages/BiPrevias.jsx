import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { RefreshCw, ArrowLeft, TrendingUp, XCircle, Timer, Activity, AlertTriangle, Clock, Users } from 'lucide-react';
import DisplayCards from '@/components/ui/display-cards';
import {
  SECRETARIAS, formatarCompetencia, getCorSecretaria, getNomeSecretaria,
} from '@/modules/previas/constants';
import { fetchBIPublicadas, fetchTopMatriculas } from '@/modules/previas/services/previasService';
import { KpiCard, ChartCard, useDashboardTheme, chartTooltipStyle, chartScaleOpts } from '@/components/ui/dashboard-card';
import { supabase, fetchAllSupabase } from '@/lib/supabase';

function isExactSecretariaMatch(secCandidate, userSecretaria) {
  if (!userSecretaria || !secCandidate) return false;
  const target = String(userSecretaria).toUpperCase().trim();
  const candidate = String(secCandidate).toUpperCase().trim();

  if (candidate === target) return true;

  const secMeta = SECRETARIAS.find(s => 
    s.sigla.toUpperCase() === target || 
    s.codigo.toUpperCase() === target || 
    s.numero === target
  );

  if (secMeta) {
    if (candidate === secMeta.sigla.toUpperCase()) return true;
    if (candidate === secMeta.codigo.toUpperCase()) return true;
    if (candidate === secMeta.numero) return true;
    if (candidate === secMeta.nome.toUpperCase()) return true;
  }
  return false;
}

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(17,24,39,.95)',
  titleColor: '#f8fafc',
  bodyColor: '#cbd5e1',
  borderColor: 'rgba(13,124,61,.3)',
  borderWidth: 1,
  padding: 10,
};

const SCALE_OPTS = {
  x: { ticks: { color: 'var(--muted-c)', font: { size: 10 } }, grid: { color: 'rgba(0, 0, 0, 0.02)' } },
  y: { ticks: { color: 'var(--muted-c)', font: { size: 10 } }, grid: { color: 'rgba(0, 0, 0, 0.02)' } },
};

function fmt(n) { return (n || 0).toLocaleString('pt-BR'); }

// ─── Shared sub-components ───────────────────────────────────────────────────

// KpiCard is now imported from @/components/ui/dashboard-card

function TopMatList({ topMat, loading }) {
  if (loading) return <div style={{ color: 'var(--muted-c)', fontSize: 13, padding: '20px 0' }}>Carregando...</div>;
  if (!topMat.length) return <div style={{ color: 'var(--muted-c)', fontSize: 13, padding: '20px 0' }}>Sem dados</div>;
  const maxOcorr = topMat[0]?.ocorrencias || 1;
  return (
    <div className="hbar-list">
      {topMat.map((m, i) => {
        const pct = Math.round((m.ocorrencias / maxOcorr) * 100);
        const cor = i === 0 ? '#ef4444' : i < 3 ? '#f59e0b' : '#0D7C3D';
        return (
          <div key={m.matricula} className="hbar-row">
            <div className="hbar-label" style={{ fontFamily: 'monospace', fontSize: 11 }}>{m.matricula}</div>
            <div className="hbar-track">
              <div className="hbar-fill" style={{ width: `${pct}%`, background: cor, transition: 'width .6s ease' }} />
            </div>
            <div className="hbar-val">{m.ocorrencias}</div>
          </div>
        );
      })}
    </div>
  );
}

function Heatmap({ publicadas }) {
  if (!publicadas.length) return null;
  const periods = [...new Set(publicadas.map(d => d.competencia))].sort().slice(-12);
  const secs    = [...new Set(publicadas.map(d => d.secretaria_codigo))];
  const lookup  = {};
  publicadas.forEach(d => { lookup[`${d.secretaria_codigo}|${d.competencia}`] = d.total_ocorrencias || 0; });
  const maxVal = Math.max(...publicadas.map(d => d.total_ocorrencias || 0), 1);
  const heatColor = (v) => {
    const i = v / maxVal;
    if (i === 0)     return 'rgba(13,124,61,.05)';
    if (i < 0.25)    return 'rgba(13,124,61,.2)';
    if (i < 0.5)     return 'rgba(245,158,11,.4)';
    if (i < 0.75)    return 'rgba(239,68,68,.6)';
    return 'rgba(239,68,68,.85)';
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 10, whiteSpace: 'nowrap' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', color: 'var(--muted-c)', fontSize: 10, paddingRight: 12, fontWeight: 400 }}>Secretaria</th>
            {periods.map(p => (
              <th key={p} style={{ color: 'var(--muted-c)', fontWeight: 400, minWidth: 38, textAlign: 'center' }}>
                {formatarCompetencia(p)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {secs.map(sec => (
            <tr key={sec}>
              <td style={{ color: 'var(--muted-c)', paddingRight: 12, fontWeight: 500 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: getCorSecretaria(sec) }} />
                  {getNomeSecretaria(sec)}
                </span>
              </td>
              {periods.map(p => {
                const v = lookup[`${sec}|${p}`] || 0;
                return (
                  <td key={p}
                    title={`${getNomeSecretaria(sec)} · ${formatarCompetencia(p)}: ${v} ocorrências`}
                    style={{ textAlign: 'center', padding: '4px 6px', borderRadius: 4, background: heatColor(v), color: v ? '#1e293b' : 'transparent', cursor: 'default', fontFamily: 'monospace' }}>
                    {v || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center', fontSize: 10, color: 'var(--muted-c)' }}>
        <span>Intensidade:</span>
        {[['Nenhuma','rgba(13,124,61,.05)'],['Baixa','rgba(13,124,61,.2)'],['Média','rgba(245,158,11,.4)'],['Alta','rgba(239,68,68,.6)'],['Crítica','rgba(239,68,68,.85)']].map(([l, c]) => (
          <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 12, height: 12, borderRadius: 2, background: c }} />{l}
          </span>
        ))}
      </div>
    </div>
  );
}

function BackButton({ onVoltar }) {
  return (
    <button
      onClick={onVoltar}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(0, 0, 0, 0.04)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--muted-c)', cursor: 'pointer', fontSize: 12 }}
    >
      <ArrowLeft size={13} /> Voltar
    </button>
  );
}

// ─── Dashboard por secretaria ────────────────────────────────────────────────

function DashboardSecretaria({ publicadas, topMat, loadingTop, secInfo, onVoltar }) {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const handleTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    handleTheme(); // Força a sincronização na montagem
    window.addEventListener('themechange', handleTheme);
    return () => window.removeEventListener('themechange', handleTheme);
  }, []);

  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.02)';

  const sorted       = useMemo(() => [...publicadas].sort((a, b) => a.competencia.localeCompare(b.competencia)), [publicadas]);
  const labels       = sorted.map(d => formatarCompetencia(d.competencia));
  const totalOcorr   = publicadas.reduce((s, d) => s + (d.total_ocorrencias || 0), 0);
  const totalFaltas  = publicadas.reduce((s, d) => s + (d.total_faltas || 0), 0);
  const totalAtrasos = publicadas.reduce((s, d) => s + (d.total_atrasos || 0), 0);
  const totalServid  = publicadas.reduce((s, d) => s + (d.servidores_impactados || 0), 0);

  const lineData = {
    labels,
    datasets: [
      {
        label: 'Ocorrências',
        data: sorted.map(d => d.total_ocorrencias || 0),
        borderColor: '#15A050', backgroundColor: 'rgba(96,165,250,.1)',
        borderWidth: 2, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#15A050',
      },
      {
        label: 'Faltas',
        data: sorted.map(d => d.total_faltas || 0),
        borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.07)',
        borderWidth: 2, fill: false, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#ef4444',
      },
      {
        label: 'Atrasos',
        data: sorted.map(d => d.total_atrasos || 0),
        borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.07)',
        borderWidth: 2, fill: false, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#f97316',
      },
    ],
  };

  const barData = {
    labels,
    datasets: [
      { label: 'Faltas',  data: sorted.map(d => d.total_faltas || 0),  backgroundColor: 'rgba(239,68,68,.7)',  borderColor: '#ef4444', borderWidth: 1, borderRadius: 4 },
      { label: 'Atrasos', data: sorted.map(d => d.total_atrasos || 0), backgroundColor: 'rgba(249,115,22,.7)', borderColor: '#f97316', borderWidth: 1, borderRadius: 4 },
    ],
  };

  const dynamicScaleOpts = {
    x: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: gridColor } },
    y: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: gridColor } },
  };

  const baseOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: mutedColor, font: { size: 11 } } }, tooltip: TOOLTIP_STYLE },
    scales: dynamicScaleOpts,
  };

  const stackedOpts = {
    ...baseOpts,
    scales: {
      x: { ...dynamicScaleOpts.x, stacked: true },
      y: { ...dynamicScaleOpts.y, stacked: true },
    },
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <BackButton onVoltar={onVoltar} />
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: secInfo.cor }} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{secInfo.numero} — {secInfo.sigla}</span>
        <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{publicadas.length} período{publicadas.length !== 1 ? 's' : ''} publicado{publicadas.length !== 1 ? 's' : ''}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
        <KpiCard label="Prévias publicadas" value={fmt(publicadas.length)} sub="períodos"   cor="#0D7C3D" icon={<Activity />} isDark={isDark} />
        <KpiCard label="Ocorrências"         value={fmt(totalOcorr)}        sub="acumulado" cor="#15A050" icon={<TrendingUp />} isDark={isDark} />
        <KpiCard label="Faltas (171)"         value={fmt(totalFaltas)}       sub="acumulado" cor="#ef4444" icon={<XCircle />} isDark={isDark} />
        <KpiCard label="Atrasos (335)"        value={fmt(totalAtrasos)}      sub="acumulado" cor="#f97316" icon={<Clock />} isDark={isDark} />
        <KpiCard label="Servidores"           value={fmt(totalServid)}       sub="acumulado" cor="#10b981" icon={<Users />} isDark={isDark} />
      </div>

      <ChartCard title="Evolução Mensal" subtitle="Ocorrências, faltas e atrasos por competência" icon={<TrendingUp />} isDark={isDark} style={{ marginBottom: 20 }}>
        <div style={{ height: 240, position: 'relative' }}>
          {sorted.length > 0
            ? <Line data={lineData} options={baseOpts} />
            : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados</div>
          }
        </div>
      </ChartCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <ChartCard title="Faltas × Atrasos por Período" subtitle="Composição mensal acumulada" isDark={isDark}>
          <div style={{ height: 220, position: 'relative' }}>
            {sorted.length > 0
              ? <Bar data={barData} options={stackedOpts} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados</div>
            }
          </div>
        </ChartCard>

        <ChartCard title="Top 10 Matrículas" subtitle="Maior número de ocorrências nesta secretaria" isDark={isDark}>
          <TopMatList topMat={topMat} loading={loadingTop} />
        </ChartCard>
      </div>
    </>
  );
}

// ─── Dashboard consolidado ───────────────────────────────────────────────────

function DashboardConsolidado({ publicadas, topMat, loadingTop, onVoltar }) {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const handleTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    window.addEventListener('themechange', handleTheme);
    return () => window.removeEventListener('themechange', handleTheme);
  }, []);

  const textColor = isDark ? '#f1f5f9' : '#1e293b';
  const mutedColor = isDark ? '#94a3b8' : '#64748b';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.02)';

  const totalPrevias     = publicadas.length;
  const totalOcorrencias = publicadas.reduce((s, d) => s + (d.total_ocorrencias || 0), 0);
  const totalFaltas      = publicadas.reduce((s, d) => s + (d.total_faltas || 0), 0);
  const totalAtrasos     = publicadas.reduce((s, d) => s + (d.total_atrasos || 0), 0);
  const totalServidores  = publicadas.reduce((s, d) => s + (d.servidores_impactados || 0), 0);

  // Evolução: agrega por competência
  const evolByComp = {};
  publicadas.forEach(d => {
    const k = d.competencia;
    if (!evolByComp[k]) evolByComp[k] = { ocorrencias: 0, servidores: 0 };
    evolByComp[k].ocorrencias += d.total_ocorrencias || 0;
    evolByComp[k].servidores  += d.servidores_impactados || 0;
  });
  const evolSorted = Object.entries(evolByComp).sort(([a], [b]) => a.localeCompare(b)).slice(-12);

  const evolData = {
    labels: evolSorted.map(([p]) => formatarCompetencia(p)),
    datasets: [
      { label: 'Ocorrências',        data: evolSorted.map(([, v]) => v.ocorrencias), borderColor: '#0D7C3D', backgroundColor: 'rgba(13,124,61,.12)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 4, pointBackgroundColor: '#0D7C3D' },
      { label: 'Servidores afetados', data: evolSorted.map(([, v]) => v.servidores),  borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.07)',  borderWidth: 1.5, fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#f59e0b' },
    ],
  };

  // Por secretaria
  const secMap = {};
  publicadas.forEach(d => {
    secMap[d.secretaria_codigo] = (secMap[d.secretaria_codigo] || 0) + (d.total_ocorrencias || 0);
  });
  const secEntries = Object.entries(secMap).sort(([, a], [, b]) => b - a);
  const secTop     = secEntries[0];
  const secLabels  = secEntries.slice(0, 8).map(([c]) => c);

  const donutData = {
    labels: secLabels.map(getNomeSecretaria),
    datasets: [{ data: secLabels.map(c => secMap[c]), backgroundColor: secLabels.map(c => getCorSecretaria(c) + 'cc'), borderColor: isDark ? '#0F1423' : '#ffffff', borderWidth: 2 }],
  };

  const barData = {
    labels: secLabels.map(getNomeSecretaria),
    datasets: [{ label: 'Ocorrências', data: secLabels.map(c => secMap[c]), backgroundColor: secLabels.map(c => getCorSecretaria(c) + 'cc'), borderColor: secLabels.map(c => getCorSecretaria(c)), borderWidth: 1, borderRadius: 4 }],
  };

  const dynamicScaleOpts = {
    x: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: gridColor } },
    y: { ticks: { color: mutedColor, font: { size: 10 } }, grid: { color: gridColor } },
  };

  const baseOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: mutedColor, font: { size: 11 } } }, tooltip: TOOLTIP_STYLE },
    scales: dynamicScaleOpts,
  };

  const donutOpts = {
    responsive: true, maintainAspectRatio: false, cutout: '60%',
    plugins: { legend: { position: 'bottom', labels: { color: textColor, font: { size: 11 }, padding: 12, usePointStyle: true } }, tooltip: TOOLTIP_STYLE },
  };

  const barOnlyOpts = { ...baseOpts, plugins: { ...baseOpts.plugins, legend: { display: false } } };

  const secretariasAtivas = new Set(publicadas.map(d => d.secretaria_codigo)).size;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <BackButton onVoltar={onVoltar} />
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Dashboard Consolidado</span>
        <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{secretariasAtivas} secretarias · {totalPrevias} prévias</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14, marginBottom: 20 }}>
        <KpiCard label="Prévias publicadas"   value={fmt(totalPrevias)}     sub="total"     cor="#0D7C3D" icon={<Activity />} isDark={isDark} />
        <KpiCard label="Ocorrências"           value={fmt(totalOcorrencias)} sub="acumulado" cor="#ef4444" icon={<TrendingUp />} isDark={isDark} />
        <KpiCard label="Faltas (171)"          value={fmt(totalFaltas)}      sub="acumulado" cor="#dc2626" icon={<XCircle />} isDark={isDark} />
        <KpiCard label="Atrasos (335)"         value={fmt(totalAtrasos)}     sub="acumulado" cor="#f97316" icon={<Clock />} isDark={isDark} />
        <KpiCard label="Servidores Impactados" value={fmt(totalServidores)}  sub="acumulado" cor="#f59e0b" icon={<Users />} isDark={isDark} />
        <KpiCard label="Maior Ocorrência"      value={secTop ? getNomeSecretaria(secTop[0]) : '—'} sub={secTop ? `${fmt(secTop[1])} ocorrências` : ''} cor="#0D7C3D" icon={<AlertTriangle />} isDark={isDark} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="Evolução Mensal" subtitle="Ocorrências e servidores nos últimos 12 meses" icon={<TrendingUp />} isDark={isDark}>
          <div style={{ height: 220, position: 'relative' }}>
            {evolSorted.length > 0
              ? <Line data={evolData} options={baseOpts} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados</div>
            }
          </div>
        </ChartCard>
        <ChartCard title="Distribuição" subtitle="Por secretaria" isDark={isDark}>
          <div style={{ height: 220, position: 'relative' }}>
            {secLabels.length > 0
              ? <Doughnut data={donutData} options={donutOpts} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados</div>
            }
          </div>
        </ChartCard>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <ChartCard title="Ocorrências por Secretaria" subtitle="Volume acumulado" isDark={isDark}>
          <div style={{ height: 220, position: 'relative' }}>
            {secLabels.length > 0
              ? <Bar data={barData} options={barOnlyOpts} />
              : <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-c)', fontSize: 13 }}>Sem dados</div>
            }
          </div>
        </ChartCard>
        <ChartCard title="Top 10 Matrículas" subtitle="Global, maior número de ocorrências" isDark={isDark}>
          <TopMatList topMat={topMat} loading={loadingTop} />
        </ChartCard>
      </div>

      <ChartCard title="Heatmap · Secretaria × Período" subtitle="Volume de ocorrências por secretaria e mês" isDark={isDark}>
        <Heatmap publicadas={publicadas} />
      </ChartCard>
    </>
  );
}

// ─── Selection grid ──────────────────────────────────────────────────────────

function SelectionGrid({ publicadas, onSelect }) {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const handleTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    handleTheme();
    window.addEventListener('themechange', handleTheme);
    return () => window.removeEventListener('themechange', handleTheme);
  }, []);

  const mapa = {};
  publicadas.forEach(d => {
    const k = d.secretaria_codigo;
    if (!mapa[k]) mapa[k] = { codigo: k, nome: d.secretaria_nome, periodos: [], totalOcorr: 0, totalFaltas: 0, totalAtrasos: 0 };
    mapa[k].periodos.push(d);
    mapa[k].totalOcorr   += d.total_ocorrencias || 0;
    mapa[k].totalFaltas  += d.total_faltas || 0;
    mapa[k].totalAtrasos += d.total_atrasos || 0;
  });
  const secretarias = Object.values(mapa).map((m, i) => {
    const s = SECRETARIAS.find(sec => sec.codigo === m.codigo);
    if (s) return { ...m, cor: s.cor, numero: s.numero, sigla: s.sigla };
    
    // Fallback para quando o código é uma unidade (Apoio restrito)
    const color = i % 2 === 0 ? '#10b981' : '#3b82f6';
    const shortName = m.nome.split('-').pop().substring(0, 30).trim();
    return { ...m, cor: color, numero: `U${i + 1}`, sigla: shortName };
  });

  const totalOcorrConsol  = publicadas.reduce((s, d) => s + (d.total_ocorrencias || 0), 0);
  const totalFaltasConsol = publicadas.reduce((s, d) => s + (d.total_faltas || 0), 0);
  const totalAtrasosConsol= publicadas.reduce((s, d) => s + (d.total_atrasos || 0), 0);
  const alertas           = publicadas.filter(d => ['anomalia_critica', 'atencao'].includes(d.classificacao_alerta)).length;

  if (!publicadas.length) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--muted-c)' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Nenhuma prévia publicada</div>
        <div style={{ fontSize: 13 }}>Publique prévias pelo Simulador para visualizar os indicadores aqui.</div>
      </div>
    );
  }

  return (
    <>
      {/* ── KPIs Superiores ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
        <KpiCard label="Prévias" value={publicadas.length} sub={`${secretarias.length} secretarias ativas`} cor="#0D7C3D" icon={<Activity />} isDark={isDark} />
        <KpiCard label="Ocorrências" value={fmt(totalOcorrConsol)} sub="acumuladas" cor="#f59e0b" icon={<TrendingUp />} isDark={isDark} />
        <KpiCard label="Faltas" value={fmt(totalFaltasConsol)} sub={alertas > 0 ? `${alertas} alertas detectados` : 'Nenhum alerta'} cor="#ef4444" icon={<XCircle />} isDark={isDark} />
        <KpiCard label="Atrasos" value={fmt(totalAtrasosConsol)} sub="registrados" cor="#ea580c" icon={<Timer />} isDark={isDark} />
      </div>

      {/* ── Banner Consolidado ── */}
      <button
        onClick={() => onSelect('consolidado')}
        style={{
          display: 'block', width: '100%', marginBottom: 32, cursor: 'pointer', textAlign: 'left',
          background: 'linear-gradient(135deg, rgba(13,124,61,0.95), rgba(13,124,61,0.75))',
          borderRadius: 20, padding: '24px 32px', color: '#fff',
          boxShadow: '0 12px 32px rgba(13,124,61,0.25)',
          border: '1px solid rgba(255,255,255,0.1)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          position: 'relative', overflow: 'hidden'
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 16px 40px rgba(13,124,61,0.35)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(13,124,61,0.25)'; }}
      >
        <div style={{ position: 'absolute', top: -100, right: -50, width: 300, height: 300, background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: 14, borderRadius: 16, backdropFilter: 'blur(10px)' }}>
              <TrendingUp size={28} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>Dashboard Consolidado</div>
              <div style={{ fontSize: 14, opacity: 0.9, fontWeight: 500 }}>Visão geral e análises avançadas de todas as secretarias</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {alertas > 0 && (
              <span style={{ padding: '6px 12px', borderRadius: 99, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', fontSize: 13, fontWeight: 600, color: '#fca5a5' }}>
                {alertas} Alertas
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#0D7C3D', padding: '10px 20px', borderRadius: 99, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
              Ver Análise <ArrowLeft size={16} style={{ transform: 'rotate(180deg)' }} />
            </span>
          </div>
        </div>
      </button>

      {/* ── Grid de Secretarias ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 16 }}>
        {secretarias.map((sec, idx) => {
          const periodosSorted = [...sec.periodos].sort((a, b) => b.competencia.localeCompare(a.competencia));
          const ultimo         = periodosSorted[0];
          const total          = sec.totalFaltas + sec.totalAtrasos;
          const pctFaltas      = total > 0 ? Math.round((sec.totalFaltas / total) * 100) : 0;

          return (
            <button
              key={sec.codigo}
              onClick={() => onSelect(sec.codigo)}
              style={{
                display: 'flex', flexDirection: 'column', cursor: 'pointer', textAlign: 'left',
                background: 'var(--surface)', border: '1px solid var(--border-c)',
                borderRadius: 16, padding: '18px 20px',
                animationDelay: `${(idx + 1) * 35}ms`,
                transition: 'all 0.2s',
                position: 'relative', overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = sec.cor; e.currentTarget.style.boxShadow = `0 8px 24px ${sec.cor}25`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-c)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.02)'; e.currentTarget.style.transform = 'none'; }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: sec.cor }} />
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ width: 34, height: 34, borderRadius: '50%', background: `${sec.cor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sec.cor, fontSize: 12, fontWeight: 800 }}>
                  {sec.numero}
                </span>
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{sec.sigla}</span>
              </div>
              
              <div style={{ fontSize: 24, fontWeight: 800, color: sec.cor, fontFamily: 'monospace', marginBottom: 4, lineHeight: 1, letterSpacing: '-0.02em' }}>
                {fmt(sec.totalOcorr)}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-c)', marginLeft: 6, fontFamily: 'Inter' }}>ocorr.</span>
              </div>
              
              <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>{fmt(sec.totalFaltas)} F</span>
                <span style={{ fontSize: 11, color: '#ea580c', fontWeight: 600 }}>{fmt(sec.totalAtrasos)} A</span>
              </div>
              
              {total > 0 && (
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(0, 0, 0, 0.05)', overflow: 'hidden', display: 'flex', marginBottom: 14 }}>
                  <div style={{ height: '100%', width: `${pctFaltas}%`, background: '#ef4444' }} />
                  <div style={{ height: '100%', flex: 1, background: '#f97316' }} />
                </div>
              )}

              <div style={{ fontSize: 11, color: 'var(--muted-c)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', fontWeight: 500 }}>
                <span>{sec.periodos.length} per.</span>
                <span>{ultimo ? formatarCompetencia(ultimo.competencia) : ''}</span>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BiPrevias() {
  const { sessao, isApoio } = useAuth();
  const [publicadas, setPublicadas] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [erro, setErro]             = useState(null);
  const [view, setView]             = useState(null); // null=grid | 'consolidado' | secretariaCodigo
  const [topMat, setTopMat]         = useState([]);
  const [loadingTop, setLoadingTop] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      let pub = await fetchBIPublicadas();
      if (isApoio && sessao?.secretaria) {
        pub = pub.filter(d => 
          isExactSecretariaMatch(d.secretaria_codigo, sessao.secretaria) ||
          isExactSecretariaMatch(d.secretaria_sigla, sessao.secretaria) ||
          isExactSecretariaMatch(d.secretaria_nome, sessao.secretaria)
        );

        if (sessao?.unidades && !sessao.unidades.includes('*') && sessao.unidades.length > 0) {
          const sec = sessao.secretaria || 'SS';
          let query = supabase
            .from('folha_previas')
            .select('competencia, secretaria_sigla, secretaria, unidade, faltas, atrasos_fracao, atrasos_dia, matricula');

          const orConditions = sessao.unidades.map(u => {
            const words = u.split(' ').filter(w => w.length > 2);
            if (words.length > 0) return `unidade.ilike.%${words[0]}%`;
            return `unidade.ilike.%${u}%`;
          }).join(',');

          if (orConditions) {
            query = query.or(orConditions);
          }

          let folhaRows = [];
          let folhaErr = null;
          try {
             folhaRows = await fetchAllSupabase(query);
          } catch(e) {
             folhaErr = e;
          }

          if (!folhaErr && folhaRows && folhaRows.length > 0) {
            const userUndsUpper = sessao.unidades.map(u => String(u).toUpperCase().trim());
            const filteredRows = folhaRows.filter(r => {
              if (!r.unidade) return false;
              const ru = String(r.unidade).toUpperCase().trim();
              return userUndsUpper.some(u => ru === u || ru.includes(u) || u.includes(ru));
            });

            if (filteredRows.length > 0) {
              const porComp = {};
              filteredRows.forEach(r => {
                const c = r.competencia;
                const u = r.unidade;
                const k = `${c}|${u}`;
                if (!porComp[k]) {
                  porComp[k] = {
                    id: `custom_${c}_${u}`,
                    competencia: c,
                    secretaria_codigo: u,
                    secretaria_sigla: u,
                    secretaria_nome: u,
                    total_ocorrencias: 0,
                    total_faltas: 0,
                    total_atrasos: 0,
                    servidores_impactados: 0,
                    total_desconto_acumulado: 0,
                    matriculasSet: new Set(),
                  };
                }
                const f = Number(r.faltas || 0);
                const af = Number(r.atrasos_fracao || 0);
                const ad = Number(r.atrasos_dia || 0);

                porComp[k].total_faltas += f;
                porComp[k].total_atrasos += (af + ad);
                porComp[k].total_ocorrencias += (f + af + ad);
                if (r.matricula) porComp[k].matriculasSet.add(r.matricula);
              });

              pub = Object.values(porComp).map(item => ({
                ...item,
                servidores_impactados: item.matriculasSet.size || item.servidores_impactados,
              })).sort((a, b) => b.competencia.localeCompare(a.competencia)); // descending order
            }
          }
        }
      }
      setPublicadas(pub);
      
      const isApoioRestrito = isApoio && sessao?.unidades && !sessao.unidades.includes('*') && sessao.unidades.length > 0;
      if (isApoio && sessao?.secretaria && !isApoioRestrito) {
        setView(sessao.secretaria);
      }
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }, [isApoio, sessao]);

  useEffect(() => { carregar(); }, [carregar]);

  const handleSelect = async (v) => {
    setView(v);
    setTopMat([]);
    setLoadingTop(true);
    try {
      const top = await fetchTopMatriculas(10, v === 'consolidado' ? null : v);
      setTopMat(top);
    } catch {
      setTopMat([]);
    } finally {
      setLoadingTop(false);
    }
  };

  const voltar = () => { setView(null); setTopMat([]); };

  const filteredPublicadas = useMemo(
    () => view && view !== 'consolidado'
      ? publicadas.filter(d => d.secretaria_codigo === view)
      : publicadas,
    [publicadas, view],
  );

  const secInfo = useMemo(() => {
    if (!view || view === 'consolidado') return null;
    const info = SECRETARIAS.find(s => s.codigo === view);
    if (info) return info;

    // Se não encontrou, assumimos que é uma unidade específica
    const shortName = view.split('-').pop().substring(0, 30).trim();
    return {
      codigo: view,
      numero: 'UN',
      sigla: shortName,
      nome: view,
      cor: '#3b82f6',
    };
  }, [view]);

  const topbarSub = !view
    ? `${new Set(publicadas.map(d => d.secretaria_codigo)).size} secretarias com dados`
    : view === 'consolidado'
      ? `${publicadas.length} prévias publicadas`
      : `${filteredPublicadas.length} período${filteredPublicadas.length !== 1 ? 's' : ''}`;

  if (loading) {
    return (
      <div>
        <div className="topbar"><div className="topbar-left"><h1>BI · Prévias</h1><p>Carregando...</p></div></div>
        <div className="content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <div style={{ color: 'var(--muted-c)' }}>Carregando indicadores...</div>
        </div>
      </div>
    );
  }

  if (erro) {
    return (
      <div>
        <div className="topbar"><div className="topbar-left"><h1>BI · Prévias</h1></div></div>
        <div className="content">
          <div style={{ padding: 20, color: '#dc2626', fontSize: 13 }}>
            Erro ao carregar dados: {erro}
            <div style={{ marginTop: 8, color: 'var(--muted-c)', fontSize: 12 }}>
              Verifique se as tabelas <code>previas_publicadas</code> e <code>previas_frequencia</code> existem no Supabase.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>BI · Prévias de Frequência</h1>
          <p>{topbarSub}</p>
        </div>
        <div className="topbar-right">
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {!view && (
          <SelectionGrid publicadas={publicadas} onSelect={handleSelect} />
        )}
        {view === 'consolidado' && (
          <DashboardConsolidado
            publicadas={publicadas}
            topMat={topMat}
            loadingTop={loadingTop}
            onVoltar={voltar}
          />
        )}
        {view && view !== 'consolidado' && secInfo && (
          <DashboardSecretaria
            publicadas={filteredPublicadas}
            topMat={topMat}
            loadingTop={loadingTop}
            secInfo={secInfo}
            onVoltar={voltar}
          />
        )}
      </div>
    </div>
  );
}
