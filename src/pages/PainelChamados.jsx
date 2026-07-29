import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  LayoutGrid,
  Heart,
  GraduationCap,
  Filter,
  ClipboardList,
  AlertTriangle,
  HelpCircle,
  Building2,
  CheckCircle2,
} from 'lucide-react';
import { IconBar, IconBarItem } from '@/components/ui/icon-bar';
import { supabase, fetchChamados } from '@/lib/supabase';
import { fmtDate, contarPor } from '@/lib/utils';
import { COR_MOT, COR_SEC, CATEGORIAS_MOTIVO } from '@/lib/constants';
import { KpiCard, ChartCard, useDashboardTheme, chartTooltipStyle } from '@/components/ui/dashboard-card';

ChartJS.register(ArcElement, Tooltip, Legend);

const FILTROS = [
  { value: 'Todos',    label: 'Todos',    icon: LayoutGrid },
  { value: 'Saúde',   label: 'Saúde',    icon: Heart },
  { value: 'Educação',label: 'Educação', icon: GraduationCap },
  { value: 'Outros',  label: 'Outros',   icon: Filter },
];

function filtrarDados(dados, filtro) {
  if (filtro === 'Todos') return dados;
  if (filtro === 'Saúde') return dados.filter((d) => d.secretaria === 'SS');
  if (filtro === 'Educação') return dados.filter((d) => d.secretaria === 'SED');
  if (filtro === 'Outros') return dados.filter((d) => d.secretaria !== 'SS' && d.secretaria !== 'SED');
  return dados.filter((d) => d.secretaria === filtro);
}

export default function PainelChamados() {
  const [dados, setDados] = useState([]);
  const [filtro, setFiltro] = useState('Todos');
  const [status, setStatus] = useState('Carregando...');
  const [modal, setModal] = useState(null);
  const hbarRef = useRef(null);

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const handleTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    window.addEventListener('themechange', handleTheme);
    return () => window.removeEventListener('themechange', handleTheme);
  }, []);

  const t = useDashboardTheme(isDark);
  const tooltip = chartTooltipStyle(isDark);

  const carregar = useCallback(async () => {
    try {
      const data = await fetchChamados();
      setDados(data);
      setStatus(
        `Atualizado em ${new Date().toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'long', year: 'numeric',
        })} · ${data.length} registros`
      );
    } catch (err) {
      console.error(err);
      setStatus('Erro ao carregar dados');
    }
  }, []);

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel('sic-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados' }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [carregar]);

  // Animate hbars after render
  useEffect(() => {
    if (!hbarRef.current) return;
    const fills = hbarRef.current.querySelectorAll('.hbar-fill[data-w]');
    setTimeout(() => {
      fills.forEach((el) => { el.style.width = el.dataset.w + '%'; });
    }, 60);
  });

  const arr = filtrarDados(dados, filtro);
  const total = arr.length;
  const secE = contarPor(arr, 'secretaria');
  const motE = contarPor(arr, 'motivo');

  // Donut chart data
  const labelsFinais = CATEGORIAS_MOTIVO;
  const valoresFinais = CATEGORIAS_MOTIVO.map((cat) => {
    const found = motE.find(([l]) => l === cat);
    return found ? found[1] : 0;
  });

  const chartData = {
    labels: labelsFinais,
    datasets: [
      {
        data: valoresFinais,
        backgroundColor: labelsFinais.map((c) => COR_MOT[c]),
        borderColor: isDark ? '#0F1423' : '#ffffff',
        borderWidth: 2,
        hoverOffset: 8,
        hoverBorderWidth: 3,
        hoverBorderColor: '#0D7C3D',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    spacing: 3,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: t.text,
          padding: 14,
          font: { size: 11, family: 'Inter', weight: '500' },
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 10,
        },
      },
      tooltip: {
        ...tooltip,
        callbacks: {
          label(ctx) {
            const tot = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = Math.round((ctx.parsed / tot) * 100);
            return `${ctx.label}: ${ctx.parsed} chamados (${pct}%)`;
          },
        },
      },
    },
    animation: { animateRotate: true, animateScale: false, duration: 800, easing: 'easeInOutQuart' },
  };

  const maxSec = secE[0]?.[1] || 1;

  const periodoTag = (() => {
    const datas = arr
      .map(d => d.data_abertura)
      .filter(Boolean)
      .map(d => new Date(d))
      .filter(d => !isNaN(d));
    if (!datas.length) return null;
    const min = new Date(Math.min(...datas));
    const max = new Date(Math.max(...datas));
    const fmt = (d) => d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
      .replace('.', '').replace(/^\w/, c => c.toUpperCase());
    return min.getMonth() === max.getMonth() && min.getFullYear() === max.getFullYear()
      ? fmt(max)
      : `${fmt(min)} – ${fmt(max)}`;
  })();

  const navigate = useNavigate();
  const abrirModal = (r) => setModal(r);
  const fecharModal = () => setModal(null);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Painel de Chamados</h1>
          <p>{status}</p>
        </div>
        <div className="topbar-right">
          <div className="badge-live">
            <div className="status-dot" />
            AO VIVO
          </div>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* Filters */}
        <div className="filters">
          <span className="filter-label">Filtrar por</span>
          <IconBar value={filtro} onValueChange={(v) => setFiltro(v ?? 'Todos')}>
            {FILTROS.map(({ value, label, icon }) => (
              <IconBarItem key={value} value={value} label={label} icon={icon} />
            ))}
          </IconBar>
        </div>

        {/* KPIs — estilo Efferd */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 16, marginBottom: 24 }}>
          <KpiCard
            label="Total de Chamados"
            value={total.toLocaleString('pt-BR')}
            sub={periodoTag || 'Todos os períodos'}
            cor="#0D7C3D"
            icon={<ClipboardList />}
            isDark={isDark}
          />
          <KpiCard
            label="Secretaria Crítica"
            value={secE[0]?.[0] || '—'}
            sub={secE[0] ? `${secE[0][1]} chamados` : '0 chamados'}
            cor="#ef4444"
            icon={<AlertTriangle />}
            isDark={isDark}
          />
          <KpiCard
            label="Principal Motivo"
            value={motE[0]?.[0] || '—'}
            sub={motE[0] ? `${Math.round(motE[0][1] / (total || 1) * 100)}% do total` : '0%'}
            cor="#f59e0b"
            icon={<HelpCircle />}
            isDark={isDark}
          />
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          <ChartCard
            title="Distribuição por Motivo"
            subtitle="Categorias de incidente"
            badge={`${total} total`}
            isDark={isDark}
          >
            <div style={{ position: 'relative', height: 220 }}>
              {total > 0 && <Doughnut data={chartData} options={chartOptions} />}
            </div>
          </ChartCard>

          <ChartCard
            title="Legendas dos Motivos"
            subtitle="Descrição detalhada das categorias"
            isDark={isDark}
          >
            <div className="motivos-compact-grid">
              {[
                { cor: '#ef4444', nome: 'EQUIPAMENTO',    desc: 'Problema físico no aparelho: quebrado, solto, caiu, não liga, suporte frouxo/quebrado.' },
                { cor: '#0D7C3D', nome: 'RECONHECIMENTO', desc: 'Equipamento não reconhece rosto, enquadramento vermelho, não registra ponto.' },
                { cor: '#f59e0b', nome: 'ESPELHO DE PONTO',desc: 'O ponto foi registrado mas não apareceu no sistema, espelho de ponto ou integração.' },
                { cor: '#10b981', nome: 'CADASTRO',        desc: 'Servidor não cadastrado, problema de horário, regra de ponto, permissão ou configuração.' },
              ].map(({ cor, nome, desc }) => (
                <div key={nome} className="motivo-compact-card">
                  <div className="motivo-compact-header">
                    <div className="motivo-compact-icon" style={{ background: cor }} />
                    <div className="motivo-compact-title">{nome}</div>
                  </div>
                  <div className="motivo-compact-desc">{desc}</div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* Bottom Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          {/* Tabela de últimas ocorrências */}
          <ChartCard
            title="Últimas Ocorrências"
            subtitle="Registros mais recentes"
            icon={<CheckCircle2 />}
            isDark={isDark}
          >
            <table>
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Unidade</th>
                  <th style={{ width: '16%' }}>Secretaria</th>
                  <th style={{ width: '28%' }}>Motivo</th>
                  <th style={{ width: '14%' }}>Status</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {arr.slice(0, 10).map((r) => {
                  const st = r.status || 'Aguardando Atendimento';
                  return (
                    <tr key={r.ticket} className="clickable-row" onClick={() => abrirModal(r)}>
                      <td style={{ color: t.text, fontSize: 11, fontWeight: 500 }}>
                        {r.unidade?.split(' ').slice(0, 4).join(' ') || 'N/A'}
                      </td>
                      <td style={{ fontSize: 11 }}>{r.secretaria}</td>
                      <td style={{ fontSize: 11 }}>{r.motivo}</td>
                      <td>
                        <span className={`badge ${st === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto'}`} style={{ fontSize: 9 }}>
                          {st}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#15A050' }}>
                        #{r.ticket}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ChartCard>

          {/* HBar por secretaria */}
          <ChartCard
            title="Chamados por Secretaria"
            subtitle="Volume de incidentes"
            badge={`${total} total`}
            icon={<Building2 />}
            isDark={isDark}
          >
            <div className="hbar-list" ref={hbarRef}>
              {secE.map(([l, v]) => {
                const pct = Math.round((v / maxSec) * 100);
                const cor = COR_SEC[l] || '#64748b';
                return (
                  <div key={l} className="hbar-row">
                    <div className="hbar-label" style={{ color: t.text }}>{l}</div>
                    <div className="hbar-track" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 6 }}>
                      <div className="hbar-fill" style={{ width: 0, background: cor, borderRadius: 6 }} data-w={pct} />
                    </div>
                    <div className="hbar-val" style={{ color: t.muted, fontFamily: 'monospace' }}>{v}</div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div
          className="modal-overlay show"
          onClick={(e) => { if (e.target === e.currentTarget) fecharModal(); }}
        >
          <div className="chamado-modal" role="dialog" aria-modal="true">
            <div className="chamado-modal-header">
              <div className="chamado-modal-title">Detalhes do Chamado</div>
              <button className="chamado-modal-close" onClick={fecharModal} aria-label="Fechar">×</button>
            </div>
            <div className="chamado-modal-grid">
              {[
                ['Ticket', `#${modal.ticket}`],
                ['Status', modal.status || 'Aguardando Atendimento'],
                ['Unidade', modal.unidade],
                ['Secretaria', modal.secretaria],
                ['Motivo', modal.motivo],
                ['Data de Abertura', fmtDate(modal.data_abertura)],
              ].map(([label, value]) => (
                <div key={label} className="chamado-modal-item">
                  <div className="chamado-modal-label">{label}</div>
                  <div className="chamado-modal-value">{value || '—'}</div>
                </div>
              ))}
            </div>
            <div className="chamado-modal-item">
              <div className="chamado-modal-label">Descrição</div>
              <div className="chamado-modal-desc">{modal.problema || '—'}</div>
            </div>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { fecharModal(); navigate('/chamado-detalhe', { state: { chamado: modal } }); }}
                style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(13,124,61,.12)', border: '1px solid rgba(13,124,61,.25)', color: '#15A050', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
              >
                Ver página completa →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
