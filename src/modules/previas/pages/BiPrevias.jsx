import TopbarAvatar from '@/components/layout/TopbarAvatar';
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler);

const TOOLTIP_STYLE = {
  backgroundColor: 'rgba(17,24,39,.95)',
  titleColor: '#1e293b',
  bodyColor: '#64748b',
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
  const mapa = {};
  publicadas.forEach(d => {
    const k = d.secretaria_codigo;
    if (!mapa[k]) mapa[k] = { codigo: k, nome: d.secretaria_nome, periodos: [], totalOcorr: 0, totalFaltas: 0, totalAtrasos: 0 };
    mapa[k].periodos.push(d);
    mapa[k].totalOcorr   += d.total_ocorrencias || 0;
    mapa[k].totalFaltas  += d.total_faltas || 0;
    mapa[k].totalAtrasos += d.total_atrasos || 0;
  });
  const secretarias = SECRETARIAS
    .filter(s => mapa[s.codigo])
    .map(s => ({ ...mapa[s.codigo], cor: s.cor, numero: s.numero, sigla: s.sigla }));

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

  // Cards para o hero animado (DisplayCards) com dados reais
  const heroCards = [
    {
      icon: <TrendingUp className="size-4 text-amber-300" />,
      title: "Ocorrências",
      description: `${fmt(totalOcorrConsol)} acumuladas`,
      date: `${secretarias.length} secretarias ativas`,
      iconClassName: "text-amber-500",
      titleClassName: "text-amber-400",
      className: "[grid-area:stack] hover:-translate-y-10 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      icon: <XCircle className="size-4 text-red-300" />,
      title: "Faltas (171)",
      description: `${fmt(totalFaltasConsol)} registradas`,
      date: `${alertas > 0 ? `${alertas} alertas detectados` : 'Nenhum alerta'}`,
      iconClassName: "text-red-500",
      titleClassName: "text-red-400",
      className: "[grid-area:stack] translate-x-16 translate-y-10 hover:-translate-y-1 before:absolute before:w-[100%] before:outline-1 before:rounded-xl before:outline-border before:h-[100%] before:content-[''] before:bg-blend-overlay before:bg-background/50 grayscale-[100%] hover:before:opacity-0 before:transition-opacity before:duration-700 hover:grayscale-0 before:left-0 before:top-0",
    },
    {
      icon: <Timer className="size-4 text-orange-300" />,
      title: "Atrasos (335)",
      description: `${fmt(totalAtrasosConsol)} registrados`,
      date: `${publicadas.length} prévias publicadas`,
      iconClassName: "text-orange-500",
      titleClassName: "text-orange-400",
      className: "[grid-area:stack] translate-x-32 translate-y-20 hover:translate-y-10",
    },
  ];

  return (
    <>
      {/* ── Hero: DisplayCards com stats reais ── */}
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8, paddingBottom: 56 }}>
        <DisplayCards cards={heroCards} />
      </div>

      {/* ── Divider ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(0, 0, 0, 0.04)' }} />
        <span style={{ fontSize: 10, color: 'var(--muted-c)', textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap' }}>
          Selecione uma secretaria
        </span>
        <div style={{ flex: 1, height: 1, background: 'rgba(0, 0, 0, 0.04)' }} />
      </div>

      {/* ── Card consolidado ── */}
      <button
        onClick={() => onSelect('consolidado')}
        className="sec-card chart-card"
        style={{
          '--sec-color': '#0D7C3D',
          display: 'block', width: '100%', marginBottom: 14, cursor: 'pointer',
          textAlign: 'left', border: '1px solid rgba(13,124,61,.25)',
          borderLeft: '4px solid #0D7C3D', padding: '16px 20px',
          animationDelay: '0ms',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>📊</span>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#15A050' }}>Dashboard Consolidado</div>
              <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 2 }}>Todas as secretarias · {publicadas.length} prévias</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <span style={{ padding: '3px 9px', borderRadius: 6, background: 'rgba(13,124,61,.15)', color: '#15A050', fontSize: 11, fontWeight: 600 }}>
              {secretarias.length} secretarias
            </span>
            {alertas > 0 && (
              <span style={{ padding: '3px 9px', borderRadius: 6, background: 'rgba(239,68,68,.15)', color: '#dc2626', fontSize: 11, fontWeight: 600 }}>
                {alertas} alertas
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#f59e0b', fontFamily: 'monospace' }}>{fmt(totalOcorrConsol)}</span> ocorrências
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', fontFamily: 'monospace' }}>{fmt(totalFaltasConsol)}</span> faltas
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#c2410c', fontFamily: 'monospace' }}>{fmt(totalAtrasosConsol)}</span> atrasos
          </span>
        </div>
      </button>

      {/* ── Grid de secretarias com .sec-card ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 }}>
        {secretarias.map((sec, idx) => {
          const periodosSorted = [...sec.periodos].sort((a, b) => b.competencia.localeCompare(a.competencia));
          const ultimo         = periodosSorted[0];
          const total          = sec.totalFaltas + sec.totalAtrasos;
          const pctFaltas      = total > 0 ? Math.round((sec.totalFaltas / total) * 100) : 0;

          return (
            <button
              key={sec.codigo}
              onClick={() => onSelect(sec.codigo)}
              className="sec-card chart-card"
              style={{
                '--sec-color': sec.cor,
                display: 'block', cursor: 'pointer', textAlign: 'left',
                border: `1px solid ${sec.cor}20`,
                borderLeft: `4px solid ${sec.cor}`,
                padding: '14px 16px',
                animationDelay: `${(idx + 1) * 35}ms`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: sec.cor, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{sec.numero} — {sec.sigla}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted-c)', marginBottom: 8 }}>
                {sec.periodos.length} período{sec.periodos.length !== 1 ? 's' : ''}
                {ultimo ? ` · último: ${formatarCompetencia(ultimo.competencia)}` : ''}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: sec.cor, fontFamily: 'monospace', marginBottom: 4 }}>
                {fmt(sec.totalOcorr)}<span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted-c)', marginLeft: 4 }}>ocorr.</span>
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#dc2626' }}>{fmt(sec.totalFaltas)} F</span>
                <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>·</span>
                <span style={{ fontSize: 10, color: '#c2410c' }}>{fmt(sec.totalAtrasos)} A</span>
              </div>
              {total > 0 && (
                <div style={{ height: 3, borderRadius: 2, background: 'rgba(0, 0, 0, 0.05)', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ height: '100%', width: `${pctFaltas}%`, background: '#ef4444' }} />
                  <div style={{ height: '100%', flex: 1, background: '#f97316' }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BiPrevias() {
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
      const pub = await fetchBIPublicadas();
      setPublicadas(pub);
    } catch (err) {
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const secInfo = useMemo(
    () => view && view !== 'consolidado'
      ? (SECRETARIAS.find(s => s.codigo === view) || { codigo: view, numero: '?', sigla: view, cor: '#64748b' })
      : null,
    [view],
  );

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
          <button
            onClick={carregar}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(0, 0, 0, 0.04)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--muted-c)', cursor: 'pointer', fontSize: 12 }}
          >
            <RefreshCw size={12} /> Atualizar
          </button>
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
