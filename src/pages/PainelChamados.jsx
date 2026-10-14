import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Wrench,
  ScanFace,
  Clock,
  UserCheck,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  X,
  Eye,
  Inbox
} from 'lucide-react';
import { IconBar, IconBarItem } from '@/components/ui/icon-bar';
import { supabase, fetchChamados } from '@/lib/supabase';
import { fmtDate, contarPor } from '@/lib/utils';
import { COR_MOT, COR_SEC, CATEGORIAS_MOTIVO } from '@/lib/constants';
import { KpiCard, KpiGrid, ChartCard, useDashboardTheme, chartTooltipStyle } from '@/components/ui/dashboard-card';
import { motion, AnimatePresence } from 'motion/react';

ChartJS.register(ArcElement, Tooltip, Legend);

const FILTROS = [
  { value: 'Todos', label: 'Todos', icon: LayoutGrid },
  { value: 'Saúde', label: 'Saúde', icon: Heart },
  { value: 'Educação', label: 'Educação', icon: GraduationCap },
  { value: 'Outros', label: 'Outros', icon: Filter },
];

function filtrarDados(dados, filtro) {
  if (filtro === 'Todos') return dados;
  if (filtro === 'Saúde') return dados.filter((d) => d.secretaria === 'SS');
  if (filtro === 'Educação') return dados.filter((d) => d.secretaria === 'SED');
  if (filtro === 'Outros') return dados.filter((d) => d.secretaria !== 'SS' && d.secretaria !== 'SED');
  return dados.filter((d) => d.secretaria === filtro);
}

const MOTIVOS_CONFIG = [
  {
    nome: 'EQUIPAMENTO',
    label: 'Equipamento',
    cor: '#ef4444',
    icon: Wrench,
    desc: 'Falha física no leitor facial: queda, suporte avariado, ausência de energia ou cabo desconectado.',
  },
  {
    nome: 'RECONHECIMENTO',
    label: 'Reconhecimento',
    cor: '#0D7C3D',
    icon: ScanFace,
    desc: 'Câmera não valida face do servidor, enquadramento vermelho ou recusa biométrica.',
  },
  {
    nome: 'ESPELHO DE PONTO',
    label: 'Espelho de Ponto',
    cor: '#f59e0b',
    icon: Clock,
    desc: 'Batida realizada com sucesso no aparelho, porém não sincronizada no sistema/espelho.',
  },
  {
    nome: 'CADASTRO',
    label: 'Cadastro & Acesso',
    cor: '#10b981',
    icon: UserCheck,
    desc: 'Servidor recém-admitido, alteração de escala, transferência de unidade ou permissão.',
  },
];

export default function PainelChamados() {
  const [dados, setDados] = useState([]);
  const [filtro, setFiltro] = useState('Todos');
  const [status, setStatus] = useState('Carregando dados...');
  const [chamadoSelecionado, setChamadoSelecionado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const hbarRef = useRef(null);
  const navigate = useNavigate();

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const handleTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    handleTheme();
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
        `Atualizado em tempo real · ${data.length} chamados registrados`
      );
    } catch (err) {
      console.error(err);
      setStatus('Erro ao carregar chamados');
    }
  }, []);

  useEffect(() => {
    carregar();
    const channel = supabase
      .channel('sic-painel-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados' }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregar]);

  // Animate hbars after render
  useEffect(() => {
    if (!hbarRef.current) return;
    const fills = hbarRef.current.querySelectorAll('.hbar-fill[data-w]');
    setTimeout(() => {
      fills.forEach((el) => {
        el.style.width = el.dataset.w + '%';
      });
    }, 60);
  });

  const arr = useMemo(() => filtrarDados(dados, filtro), [dados, filtro]);
  const total = arr.length;
  const secE = useMemo(() => contarPor(arr, 'secretaria'), [arr]);
  const motE = useMemo(() => contarPor(arr, 'motivo'), [arr]);

  // Contagem por motivo mapeado
  const motivoCounts = useMemo(() => {
    const map = {};
    motE.forEach(([m, count]) => {
      map[m] = count;
    });
    return map;
  }, [motE]);

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
        backgroundColor: labelsFinais.map((c) => COR_MOT[c] || '#0D7C3D'),
        borderColor: isDark ? '#0F1423' : '#ffffff',
        borderWidth: 2,
        hoverOffset: 6,
        hoverBorderWidth: 2,
        hoverBorderColor: isDark ? '#ffffff' : '#0D7C3D',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    spacing: 2,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: t.text,
          padding: 12,
          font: { size: 10.5, family: 'Inter', weight: '500' },
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 8,
        },
      },
      tooltip: {
        ...tooltip,
        callbacks: {
          label(ctx) {
            const tot = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = tot > 0 ? Math.round((ctx.parsed / tot) * 100) : 0;
            return `${ctx.label}: ${ctx.parsed} chamados (${pct}%)`;
          },
        },
      },
    },
    animation: { animateRotate: true, animateScale: false, duration: 600, easing: 'easeInOutQuart' },
  };

  const maxSec = secE[0]?.[1] || 1;

  const periodoTag = useMemo(() => {
    const datas = arr
      .map((d) => d.data_abertura)
      .filter(Boolean)
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d));
    if (!datas.length) return null;
    const min = new Date(Math.min(...datas));
    const max = new Date(Math.max(...datas));
    const fmt = (d) =>
      d
        .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
        .replace('.', '')
        .replace(/^\w/, (c) => c.toUpperCase());
    return min.getMonth() === max.getMonth() && min.getFullYear() === max.getFullYear()
      ? fmt(max)
      : `${fmt(min)} – ${fmt(max)}`;
  }, [arr]);

  const copiarTicket = (ticket, e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(String(ticket));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <h1>Painel de Chamados</h1>
          <p>{status}</p>
        </div>
        <div className="topbar-right">
          <button
            onClick={() => navigate('/todos-chamados')}
            className="pagination-btn"
            style={{ padding: '7px 12px', fontSize: 12 }}
          >
            Gerenciar Todos <ArrowRight size={13} />
          </button>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* Filtros por Secretaria */}
        <div className="filters">
          <span className="filter-label">Recorte:</span>
          <IconBar value={filtro} onValueChange={(v) => setFiltro(v ?? 'Todos')}>
            {FILTROS.map(({ value, label, icon }) => (
              <IconBarItem key={value} value={value} label={label} icon={icon} />
            ))}
          </IconBar>
        </div>

        {/* KPIs Executivos */}
        <KpiGrid style={{ marginBottom: 20 }}>
          <KpiCard
            label="Volume de Chamados"
            value={total}
            sub={periodoTag || 'Período Completo'}
            cor="#0D7C3D"
            icon={<ClipboardList />}
            isDark={isDark}
          />
          <KpiCard
            label="Secretaria Mais Demandada"
            value={secE[0]?.[0] || '—'}
            sub={secE[0] ? `${secE[0][1]} ocorrências registradas` : 'Sem chamados'}
            cor="#ef4444"
            icon={<AlertTriangle />}
            isDark={isDark}
          />
          <KpiCard
            label="Principal Causa Raiz"
            value={motE[0]?.[0] || '—'}
            sub={motE[0] ? `${Math.round((motE[0][1] / (total || 1)) * 100)}% de incidência` : '0%'}
            cor="#f59e0b"
            icon={<HelpCircle />}
            isDark={isDark}
          />
        </KpiGrid>

        {/* Linha dos Gráficos: Distribuição & Taxonomia Operacional */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
          {/* Gráfico Doughnut */}
          <ChartCard
            title="Distribuição por Motivo"
            subtitle="Concentração dos tipos de incidente relatados"
            badge={`${total} total`}
            isDark={isDark}
          >
            <div style={{ position: 'relative', height: 230 }}>
              {total > 0 ? (
                <Doughnut data={chartData} options={chartOptions} />
              ) : (
                <div className="chamados-empty-state" style={{ height: '100%', padding: 20 }}>
                  <Inbox size={24} className="text-slate-400 mb-2" />
                  <span style={{ fontSize: 12, color: 'var(--muted-c)' }}>Sem dados para o filtro</span>
                </div>
              )}
            </div>
          </ChartCard>

          {/* Taxonomia & Métricas por Motivo (Substituindo cards aninhados) */}
          <ChartCard
            title="Taxonomia e Frequência dos Incidentes"
            subtitle="Detalhamento operacional com percentual sobre a base"
            isDark={isDark}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {MOTIVOS_CONFIG.map(({ nome, label, cor, icon: IconComponent, desc }) => {
                const count = motivoCounts[nome] || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <div
                    key={nome}
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border-c)',
                      borderRadius: 9,
                      padding: '10px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 6,
                            background: `${cor}15`,
                            color: cor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <IconComponent size={13} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                          {label}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                          {count}
                        </span>
                        <span style={{ fontSize: 10.5, color: 'var(--sub)' }}>
                          ({pct}%)
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--muted-c)', lineHeight: 1.4 }}>
                      {desc}
                    </div>

                    {/* Barra de Proporção Sutil */}
                    <div
                      style={{
                        height: 3,
                        borderRadius: 2,
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        overflow: 'hidden',
                        marginTop: 2,
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          backgroundColor: cor,
                          borderRadius: 2,
                          transition: 'width 400ms cubic-bezier(0.23, 1, 0.32, 1)',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>

        {/* Linha Inferior: Últimas Ocorrências & Volume por Secretaria */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          {/* Tabela de últimas ocorrências */}
          <ChartCard
            title="Últimas Ocorrências"
            subtitle="Clique em um registro para abrir o inspetor lateral"
            badge="Tempo Real"
            icon={<CheckCircle2 />}
            isDark={isDark}
            actions={
              <button
                onClick={() => navigate('/todos-chamados')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#0D7C3D',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                Ver todos <ArrowRight size={12} />
              </button>
            }
          >
            <div style={{ overflowX: 'auto' }}>
              <table className="chamados-table">
                <thead>
                  <tr>
                    <th style={{ width: '90px' }}>Ticket</th>
                    <th>Unidade & Lotação</th>
                    <th style={{ width: '150px' }}>Motivo</th>
                    <th style={{ width: '120px' }}>Status</th>
                    <th style={{ width: '85px', textAlign: 'center' }}>Data</th>
                  </tr>
                </thead>
                <tbody>
                  {arr.slice(0, 8).map((r) => {
                    const st = r.status_auvo || r.status || 'Aguardando Atendimento';
                    const corSec = COR_SEC[r.secretaria] || '#64748b';

                    return (
                      <tr
                        key={r.ticket}
                        className="chamados-row"
                        onClick={() => setChamadoSelecionado(r)}
                      >
                        <td>
                          <span className="ticket-pill">#{r.ticket}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 11.5 }}>
                              {r.unidade || 'N/A'}
                            </span>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 600,
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: `${corSec}15`,
                                color: corSec,
                                alignSelf: 'flex-start',
                              }}
                            >
                              {r.secretaria || 'N/I'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 11, color: 'var(--muted-c)' }}>{r.motivo}</span>
                        </td>
                        <td>
                          <span
                            className={`status-chip ${st === 'Atendimento Encerrado' ? 'status-chip-encerrado' : 'status-chip-aberto'}`}
                            style={{ fontSize: 9.5 }}
                          >
                            <span className="status-dot-pulse" />
                            {st}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 10.5, fontVariantNumeric: 'tabular-nums', color: 'var(--muted-c)' }}>
                          {fmtDate(r.data_abertura)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </ChartCard>

          {/* Barras Horizontais: Chamados por Secretaria */}
          <ChartCard
            title="Demandas por Secretaria"
            subtitle="Volume acumulado de incidentes"
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
                    <div className="hbar-label" style={{ color: t.text }}>
                      {l}
                    </div>
                    <div
                      className="hbar-track"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                        borderRadius: 6,
                      }}
                    >
                      <div
                        className="hbar-fill"
                        style={{ width: 0, background: cor, borderRadius: 6 }}
                        data-w={pct}
                      />
                    </div>
                    <div className="hbar-val" style={{ color: t.muted, fontFamily: 'JetBrains Mono, monospace' }}>
                      {v}
                    </div>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* ── Slide-Over Detail Inspector ── */}
      <AnimatePresence>
        {chamadoSelecionado && (
          <>
            <motion.div
              className="drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setChamadoSelecionado(null)}
            />
            <motion.aside
              className="drawer-panel"
              initial={{ transform: 'translateX(100%)' }}
              animate={{ transform: 'translateX(0%)' }}
              exit={{ transform: 'translateX(100%)' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
            >
              <div className="drawer-header">
                <div>
                  <span className="ticket-pill" style={{ fontSize: 13, padding: '4px 9px', marginBottom: 6 }}>
                    #{chamadoSelecionado.ticket}
                  </span>
                  <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>
                    Aberto em {fmtDate(chamadoSelecionado.data_abertura)}
                  </div>
                </div>
                <button
                  onClick={() => setChamadoSelecionado(null)}
                  className="drawer-close-btn"
                  title="Fechar"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="drawer-body">
                <div>
                  <div className="drawer-section-title">
                    <Building2 size={13} /> Unidade e Lotação
                  </div>
                  <div
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border-c)',
                      borderRadius: 10,
                      padding: '12px 14px',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                      {chamadoSelecionado.unidade || 'N/A'}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 4,
                        background: `${COR_SEC[chamadoSelecionado.secretaria] || '#64748b'}18`,
                        color: COR_SEC[chamadoSelecionado.secretaria] || '#64748b',
                      }}
                    >
                      {chamadoSelecionado.secretaria || 'N/I'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="drawer-section-title">
                    <ClipboardList size={13} /> Parâmetros
                  </div>
                  <div className="drawer-key-val-grid">
                    <div className="drawer-key-val-card">
                      <div className="drawer-key">Motivo</div>
                      <div className="drawer-val">{chamadoSelecionado.motivo}</div>
                    </div>
                    <div className="drawer-key-val-card">
                      <div className="drawer-key">Status</div>
                      <div className="drawer-val">{chamadoSelecionado.status || 'Aguardando Atendimento'}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="drawer-section-title">
                    <Inbox size={13} /> Descrição do Problema
                  </div>
                  <div className="drawer-description-box">
                    {chamadoSelecionado.problema || 'Sem descrição informada.'}
                  </div>
                </div>
              </div>

              <div className="drawer-footer">
                <button
                  onClick={() => {
                    const ch = chamadoSelecionado;
                    setChamadoSelecionado(null);
                    navigate('/chamado-detalhe', { state: { chamado: ch } });
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: '#0D7C3D',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  Abrir página completa do chamado <ExternalLink size={13} />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
