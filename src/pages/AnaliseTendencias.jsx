import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement, BarElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { supabase } from '@/lib/supabase';
import { COR_MOT, COR_SEC } from '@/lib/constants';
import { contarPor } from '@/lib/utils';
import { TrendingUp, BarChart2, Building2, AlertTriangle, Layers, Activity } from 'lucide-react';
import { KpiCard, ChartCard, useDashboardTheme, chartTooltipStyle, chartScaleOpts } from '@/components/ui/dashboard-card';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

function agruparPorMes(dados) {
  const meses = {};
  dados.forEach((d) => {
    if (!d.data_abertura) return;
    const dt = new Date(d.data_abertura + 'T00:00:00');
    const chave = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    meses[chave] = (meses[chave] || 0) + 1;
  });
  return Object.entries(meses).sort((a, b) => a[0].localeCompare(b[0]));
}

function agruparPorDiaSemana(dados) {
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const contagem = new Array(7).fill(0);
  dados.forEach((d) => {
    if (!d.data_abertura) return;
    contagem[new Date(d.data_abertura + 'T00:00:00').getDay()]++;
  });
  return dias.map((dia, i) => ({ dia, count: contagem[i] }));
}

export default function AnaliseTendencias() {
  const [dados, setDados] = useState([]);
  const [status, setStatus] = useState('Carregando...');

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const handleTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    window.addEventListener('themechange', handleTheme);
    return () => window.removeEventListener('themechange', handleTheme);
  }, []);

  const t = useDashboardTheme(isDark);

  const carregar = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('chamados')
        .select('*')
        .order('data_abertura', { ascending: true });
      if (error) throw error;
      setDados(data || []);
      setStatus(
        `Atualizado em ${new Date().toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'long', year: 'numeric',
        })} · ${(data || []).length} registros`
      );
    } catch (err) {
      console.error(err);
      setStatus('Erro ao carregar dados');
    }
  }, []);

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel('tendencias-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados' }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [carregar]);

  const mensal = agruparPorMes(dados);
  const mesesAtuais = mensal.slice(-3);
  const mesesAnteriores = mensal.slice(-6, -3);
  const totalAtual = mesesAtuais.reduce((sum, [, c]) => sum + c, 0);
  const totalAnterior = mesesAnteriores.reduce((sum, [, c]) => sum + c, 0);
  const crescimento = totalAnterior > 0 ? Math.round(((totalAtual - totalAnterior) / totalAnterior) * 100) : 0;

  const motivos = contarPor(dados, 'motivo');
  const motivoPrincipal = motivos[0];
  const secE = contarPor(dados, 'secretaria').slice(0, 10);
  const semana = agruparPorDiaSemana(dados);
  const maxSec = secE[0]?.[1] || 1;

  const tooltip = chartTooltipStyle(isDark);
  const scales  = chartScaleOpts(isDark);

  // Chart: Mensal
  const chartMensalData = {
    labels: mensal.map(([m]) => {
      const [y, mo] = m.split('-');
      return new Date(+y, +mo - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    }),
    datasets: [{
      label: 'Chamados',
      data: mensal.map(([, c]) => c),
      borderColor: '#0D7C3D',
      backgroundColor: isDark ? 'rgba(13,124,61,0.15)' : 'rgba(13,124,61,0.08)',
      fill: true,
      tension: 0.45,
      pointBackgroundColor: '#0D7C3D',
      pointBorderColor: isDark ? '#0f172a' : '#fff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
    }],
  };

  const chartMensalOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip },
    scales,
  };

  // Chart: Dia da semana
  const chartSemanaData = {
    labels: semana.map((s) => s.dia),
    datasets: [{
      label: 'Chamados',
      data: semana.map((s) => s.count),
      backgroundColor: semana.map((_, i) =>
        i === 5 ? 'rgba(239,68,68,0.75)' : (isDark ? 'rgba(13,124,61,0.75)' : 'rgba(13,124,61,0.65)')
      ),
      borderColor: semana.map((_, i) => i === 5 ? '#ef4444' : '#0D7C3D'),
      borderWidth: 1,
      borderRadius: 6,
      borderSkipped: false,
    }],
  };

  const chartSemanaOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip },
    scales: {
      ...scales,
      x: { ...scales.x, grid: { display: false } },
    },
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Análise de Tendências</h1>
          <p>{status}</p>
        </div>
        <div className="topbar-right">
          <div className="badge-live"><div className="status-dot" />AO VIVO</div>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* KPIs — novo estilo Efferd */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard
            label="Total de Chamados"
            value={dados.length.toLocaleString('pt-BR')}
            sub="Todos os períodos"
            cor="#0D7C3D"
            icon={<Activity />}
            isDark={isDark}
          />
          <KpiCard
            label="Crescimento Trimestral"
            value={`${crescimento >= 0 ? '+' : ''}${crescimento}%`}
            sub="vs trimestre anterior"
            cor={crescimento >= 0 ? '#ef4444' : '#10b981'}
            icon={crescimento >= 0 ? <AlertTriangle /> : <TrendingUp />}
            trend={crescimento >= 0 ? 'up' : 'down'}
            trendLabel={`${Math.abs(crescimento)}%`}
            isDark={isDark}
          />
          <KpiCard
            label="Principal Motivo"
            value={motivoPrincipal?.[0] || '—'}
            sub={motivoPrincipal ? `${motivoPrincipal[1]} chamados` : '0 chamados'}
            cor="#f59e0b"
            icon={<Layers />}
            isDark={isDark}
          />
        </div>

        {/* Charts */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <ChartCard
            title="Evolução Mensal"
            subtitle="Volume de chamados por mês"
            badge={`${mensal.length} meses`}
            icon={<TrendingUp />}
            isDark={isDark}
          >
            <div style={{ height: 240 }}>
              {mensal.length > 0 && <Line data={chartMensalData} options={chartMensalOptions} />}
            </div>
          </ChartCard>

          <ChartCard
            title="Distribuição por Dia da Semana"
            subtitle="Padrão de abertura de chamados"
            icon={<BarChart2 />}
            isDark={isDark}
          >
            <div style={{ height: 240 }}>
              {dados.length > 0 && <Bar data={chartSemanaData} options={chartSemanaOptions} />}
            </div>
          </ChartCard>
        </div>

        {/* Ranking de Secretarias */}
        <ChartCard
          title="Ranking de Secretarias"
          subtitle="Top 10 por volume de chamados"
          badge={`${dados.length} total`}
          icon={<Building2 />}
          isDark={isDark}
        >
          <div className="hbar-list">
            {secE.map(([l, v]) => {
              const pct = Math.round((v / maxSec) * 100);
              const cor = COR_SEC[l] || '#64748b';
              return (
                <div key={l} className="hbar-row" style={{ alignItems: 'center' }}>
                  <div className="hbar-label" style={{ color: t.text }}>{l}</div>
                  <div
                    className="hbar-track"
                    style={{
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      borderRadius: 6, overflow: 'hidden',
                    }}
                  >
                    <div
                      className="hbar-fill"
                      style={{ width: `${pct}%`, background: cor, borderRadius: 6 }}
                    />
                  </div>
                  <div className="hbar-val" style={{ color: t.muted, fontFamily: 'monospace' }}>{v}</div>
                </div>
              );
            })}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
