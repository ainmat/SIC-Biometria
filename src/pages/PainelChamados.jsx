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
} from 'lucide-react';
import { IconBar, IconBarItem } from '@/components/ui/icon-bar';
import { supabase, fetchChamados } from '@/lib/supabase';
import { fmtDate, contarPor } from '@/lib/utils';
import { COR_MOT, COR_SEC, CATEGORIAS_MOTIVO, CHART_DEFAULTS } from '@/lib/constants';

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

  const carregar = useCallback(async () => {
    try {
      const data = await fetchChamados();
      setDados(data);
      setStatus(
        `Atualizado em ${new Date().toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
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
        borderColor: '#0d1424',
        borderWidth: 2,
        hoverOffset: 8,
        hoverBorderWidth: 3,
        hoverBorderColor: '#3b82f6',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    spacing: 3,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#f1f5f9',
          padding: 15,
          font: { size: 11, family: 'Inter', weight: '500' },
          usePointStyle: true,
          pointStyle: 'circle',
          boxWidth: 10,
        },
      },
      tooltip: {
        ...CHART_DEFAULTS,
        displayColors: true,
        usePointStyle: true,
        callbacks: {
          label(ctx) {
            const t = ctx.dataset.data.reduce((a, b) => a + b, 0);
            const pct = Math.round((ctx.parsed / t) * 100);
            return `${ctx.label}: ${ctx.parsed} chamados (${pct}%)`;
          },
        },
      },
    },
    animation: { animateRotate: true, animateScale: false, duration: 800, easing: 'easeInOutQuart' },
  };

  const maxSec = secE[0]?.[1] || 1;

  // Período: do mês do primeiro chamado ao mês do mais recente
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
        {/* Filters – IconBar animado */}
        <div className="filters">
          <span className="filter-label">Filtrar por</span>
          <IconBar
            value={filtro}
            onValueChange={(v) => setFiltro(v ?? 'Todos')}
          >
            {FILTROS.map(({ value, label, icon }) => (
              <IconBarItem key={value} value={value} label={label} icon={icon} />
            ))}
          </IconBar>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: '#3b82f6' }} />
            <div className="kpi-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
              </svg>
              Total de chamados
            </div>
            <div className="kpi-value" style={{ color: '#60a5fa' }}>{total}</div>
            <div className="kpi-footer">
              {periodoTag && <span className="kpi-tag tag-blue">{periodoTag}</span>}
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: '#ef4444' }} />
            <div className="kpi-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              Secretaria crítica
            </div>
            <div className="kpi-value" style={{ color: '#f87171', fontSize: 22, paddingTop: 6 }}>
              {secE[0]?.[0] || '—'}
            </div>
            <div className="kpi-footer">
              <span className="kpi-tag tag-red">{secE[0] ? `${secE[0][1]} chamados` : '0 chamados'}</span>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: '#f59e0b' }} />
            <div className="kpi-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Principal Motivo
            </div>
            <div className="kpi-value" style={{ color: '#fbbf24', fontSize: 16, paddingTop: 10 }}>
              {motE[0]?.[0] || '—'}
            </div>
            <div className="kpi-footer">
              <span className="kpi-tag tag-amber">
                {motE[0] ? `${Math.round(motE[0][1] / total * 100)}% do total` : '0%'}
              </span>
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="charts-row">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Distribuição por motivo</div>
                <div className="chart-sub">Categorias de incidente</div>
              </div>
              <div className="chart-badge">{total} total</div>
            </div>
            <div style={{ position: 'relative', height: 200 }}>
              {total > 0 && <Doughnut data={chartData} options={chartOptions} />}
            </div>
          </div>

          <div className="chart-card">
            <div className="chart-header">
              <div>
                <div className="chart-title">Legendas dos Motivos</div>
                <div className="chart-sub">Descrição detalhada das categorias</div>
              </div>
            </div>
            <div className="motivos-compact-grid">
              {[
                { cor: '#ef4444', nome: 'EQUIPAMENTO', desc: 'Problema físico no aparelho: quebrado, solto, caiu, não liga, suporte frouxo/quebrado.' },
                { cor: '#3b82f6', nome: 'RECONHECIMENTO', desc: 'Equipamento não reconhece rosto, enquadramento vermelho, não registra ponto.' },
                { cor: '#f59e0b', nome: 'ESPELHO DE PONTO', desc: 'O ponto foi registrado mas não apareceu no sistema, espelho de ponto ou integração.' },
                { cor: '#10b981', nome: 'CADASTRO', desc: 'Servidor não cadastrado, problema de horário, regra de ponto, permissão ou configuração.' },
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
          </div>
        </div>

        {/* Bottom Row */}
        <div className="bottom-row">
          <div className="table-card">
            <div className="chart-header" style={{ marginBottom: 16 }}>
              <div>
                <div className="chart-title">Últimas ocorrências</div>
                <div className="chart-sub">Registros mais recentes</div>
              </div>
            </div>
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
                      <td style={{ color: '#f1f5f9', fontSize: 11, fontWeight: 500 }}>
                        {r.unidade?.split(' ').slice(0, 4).join(' ') || 'N/A'}
                      </td>
                      <td style={{ fontSize: 11 }}>{r.secretaria}</td>
                      <td style={{ fontSize: 11 }}>{r.motivo}</td>
                      <td>
                        <span className={`badge ${st === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto'}`} style={{ fontSize: 9 }}>
                          {st}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#60a5fa' }}>
                        #{r.ticket}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="chart-card">
            <div className="chart-header" style={{ marginBottom: 16 }}>
              <div>
                <div className="chart-title">Chamados por secretaria</div>
                <div className="chart-sub">Volume de incidentes</div>
              </div>
              <div className="chart-badge">{total} total</div>
            </div>
            <div className="hbar-list" ref={hbarRef}>
              {secE.map(([l, v]) => {
                const pct = Math.round((v / maxSec) * 100);
                const cor = COR_SEC[l] || '#64748b';
                return (
                  <div key={l} className="hbar-row">
                    <div className="hbar-label">{l}</div>
                    <div className="hbar-track">
                      <div className="hbar-fill" style={{ width: 0, background: cor }} data-w={pct} />
                    </div>
                    <div className="hbar-val">{v}</div>
                  </div>
                );
              })}
            </div>
          </div>
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
                style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', color: '#60a5fa', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
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
