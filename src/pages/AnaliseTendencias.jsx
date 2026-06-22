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

const CHART_DEFAULTS = {
  backgroundColor: 'rgba(17, 24, 39, 0.95)',
  titleColor: '#f1f5f9',
  bodyColor: '#94a3b8',
  borderColor: 'rgba(59, 130, 246, 0.3)',
  borderWidth: 1,
  padding: 12,
};

export default function AnaliseTendencias() {
  const [dados, setDados] = useState([]);
  const [status, setStatus] = useState('Carregando...');

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

  // Chart: Mensal
  const chartMensalData = {
    labels: mensal.map(([m]) => {
      const [y, mo] = m.split('-');
      return new Date(+y, +mo - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    }),
    datasets: [{
      label: 'Chamados',
      data: mensal.map(([, c]) => c),
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59,130,246,.08)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: '#3b82f6',
      pointRadius: 3,
    }],
  };

  const chartMensalOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: CHART_DEFAULTS },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.04)' } },
      y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.04)' }, beginAtZero: true },
    },
  };

  // Chart: Dia da semana
  const chartSemanaData = {
    labels: semana.map((s) => s.dia),
    datasets: [{
      label: 'Chamados',
      data: semana.map((s) => s.count),
      backgroundColor: semana.map((_, i) => i === 5 ? '#ef4444' : 'rgba(59,130,246,.7)'),
      borderRadius: 4,
    }],
  };

  const chartSemanaOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: CHART_DEFAULTS },
    scales: {
      x: { ticks: { color: '#64748b', font: { size: 11 } }, grid: { display: false } },
      y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,.04)' }, beginAtZero: true },
    },
  };

  const maxSec = secE[0]?.[1] || 1;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Análise de Tendências</h1>
          <p>{status}</p>
        </div>
        <div className="topbar-right">
          <div className="badge-live"><div className="status-dot" />AO VIVO</div>
          <div className="avatar">MC</div>
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: '#3b82f6' }} />
            <div className="kpi-label">Total de Chamados</div>
            <div className="kpi-value" style={{ color: '#60a5fa' }}>{dados.length}</div>
            <div className="kpi-footer">
              <span className="kpi-tag tag-blue">Todos os períodos</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: crescimento >= 0 ? '#ef4444' : '#10b981' }} />
            <div className="kpi-label">Crescimento (trimestre)</div>
            <div className="kpi-value" style={{ color: crescimento >= 0 ? '#f87171' : '#34d399', fontSize: 28 }}>
              {crescimento >= 0 ? '+' : ''}{crescimento}%
            </div>
            <div className="kpi-footer">
              <span className={`kpi-tag ${crescimento >= 0 ? 'tag-red' : 'tag-blue'}`}>
                vs trimestre anterior
              </span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: '#f59e0b' }} />
            <div className="kpi-label">Principal Motivo</div>
            <div className="kpi-value" style={{ color: '#fbbf24', fontSize: 16, paddingTop: 10 }}>
              {motivoPrincipal?.[0] || '—'}
            </div>
            <div className="kpi-footer">
              <span className="kpi-tag tag-amber">
                {motivoPrincipal ? `${motivoPrincipal[1]} chamados` : '0 chamados'}
              </span>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="charts-row" style={{ marginBottom: 24 }}>
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Evolução Mensal</div>
                <div className="chart-sub">Volume de chamados por mês</div>
              </div>
              <div className="chart-badge">{mensal.length} meses</div>
            </div>
            <div style={{ height: 220 }}>
              {mensal.length > 0 && <Line data={chartMensalData} options={chartMensalOptions} />}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Distribuição por Dia da Semana</div>
                <div className="chart-sub">Padrão de abertura de chamados</div>
              </div>
            </div>
            <div style={{ height: 220 }}>
              {dados.length > 0 && <Bar data={chartSemanaData} options={chartSemanaOptions} />}
            </div>
          </div>
        </div>

        {/* Secretarias ranking */}
        <div className="chart-card">
          <div className="chart-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="chart-title">Ranking de Secretarias</div>
              <div className="chart-sub">Top 10 por volume de chamados</div>
            </div>
            <div className="chart-badge">{dados.length} total</div>
          </div>
          <div className="hbar-list">
            {secE.map(([l, v]) => {
              const pct = Math.round((v / maxSec) * 100);
              const cor = COR_SEC[l] || '#64748b';
              return (
                <div key={l} className="hbar-row">
                  <div className="hbar-label">{l}</div>
                  <div className="hbar-track">
                    <div className="hbar-fill" style={{ width: `${pct}%`, background: cor }} />
                  </div>
                  <div className="hbar-val">{v}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
