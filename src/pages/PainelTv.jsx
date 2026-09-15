import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  TrendingUp,
  Activity,
  Layers,
  AlertTriangle,
  Building2,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  ExternalLink,
  Calendar,
  Sparkles,
  Flame,
  Settings,
  X,
  Check,
  RotateCcw,
} from 'lucide-react';
import logoDarh from '../../img/logo-darh.png';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

import { supabase, fetchChamados } from '@/lib/supabase';
import { contarPor } from '@/lib/utils';
import { fetchProtocolos } from '@/modules/protocolo/services/protocoloService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const OPCOES_TEMPO = [10, 15, 20, 25, 30, 45, 60, 90, 120];

// Cores e utilitários
const CORES = {
  primary: '#10B981',
  primaryDark: '#059669',
  blue: '#3B82F6',
  amber: '#F59E0B',
  rose: '#F43F5E',
  purple: '#8B5CF6',
  cardBg: 'rgba(17, 24, 39, 0.85)',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
};

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

function calcularDiasEmAberto(dataAbertura) {
  if (!dataAbertura) return null;
  const abertura = new Date(dataAbertura + 'T00:00:00');
  const hoje = new Date();
  const diffTime = hoje - abertura;
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

export default function PainelTv({ standalone = false }) {
  const navigate = useNavigate();
  const [slideAtual, setSlideAtual] = useState(0); // 0: Tendências, 1: Protocolos
  const [pausado, setPausado] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [modalConfig, setModalConfig] = useState(false);

  // Configurações personalizáveis com persistência local
  const [duracaoSegundos, setDuracaoSegundos] = useState(() => {
    const s = localStorage.getItem('sic_tv_duracao');
    return s ? Number(s) : 25;
  });

  const [telasAtivas, setTelasAtivas] = useState(() => {
    const s = localStorage.getItem('sic_tv_telas');
    return s ? JSON.parse(s) : [0, 1];
  });

  // Relógio
  const [horaAtual, setHoraAtual] = useState(new Date());

  // Dados
  const [chamados, setChamados] = useState([]);
  const [protocolos, setProtocolos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(new Date());

  // Atualização do Relógio (a cada 1s)
  useEffect(() => {
    const timer = setInterval(() => {
      setHoraAtual(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Monitorar Fullscreen
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Carregar dados de Chamados e Protocolos
  const carregarDados = useCallback(async () => {
    try {
      const [resChamados, resProtocolos] = await Promise.allSettled([
        fetchChamados(),
        fetchProtocolos(),
      ]);

      if (resChamados.status === 'fulfilled' && resChamados.value) {
        setChamados(resChamados.value);
      }
      if (resProtocolos.status === 'fulfilled' && resProtocolos.value?.data) {
        setProtocolos(resProtocolos.value.data);
      }
      setUltimaAtualizacao(new Date());
    } catch (err) {
      console.error('Erro ao atualizar dados do painel TV:', err);
    } finally {
      setCarregando(false);
    }
  }, []);

  // Carga inicial e auto-refresh de 60 segundos
  useEffect(() => {
    carregarDados();
    const refreshInterval = setInterval(carregarDados, 60000);
    return () => clearInterval(refreshInterval);
  }, [carregarDados]);

  // Alternância Automática de Slides baseada nas configurações
  useEffect(() => {
    if (pausado || telasAtivas.length <= 1) return;

    const timer = setInterval(() => {
      setSlideAtual((curr) => {
        const nextIndex = (telasAtivas.indexOf(curr) + 1) % telasAtivas.length;
        return telasAtivas[nextIndex];
      });
    }, duracaoSegundos * 1000);

    return () => clearInterval(timer);
  }, [pausado, slideAtual, duracaoSegundos, telasAtivas]);

  // Barra de Progresso sincronizada com precisão de tempo real
  useEffect(() => {
    if (pausado || telasAtivas.length <= 1) {
      setProgresso(0);
      return;
    }
    setProgresso(0);

    const startTime = Date.now();
    const duration = duracaoSegundos * 1000;

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgresso(pct);
    }, 100);

    return () => clearInterval(progressInterval);
  }, [pausado, slideAtual, duracaoSegundos, telasAtivas]);

  // Troca manual
  const mudarSlide = (index) => {
    setSlideAtual(index);
    setProgresso(0);
  };

  // Alterar duração
  const atualizarDuracao = (seg) => {
    setDuracaoSegundos(seg);
    localStorage.setItem('sic_tv_duracao', String(seg));
    setProgresso(0);
  };

  // Alternar tela ativa no ciclo
  const toggleTelaAtiva = (index) => {
    setTelasAtivas((prev) => {
      let next;
      if (prev.includes(index)) {
        if (prev.length === 1) return prev; // Não permite desmarcar todas
        next = prev.filter((i) => i !== index);
      } else {
        next = [...prev, index].sort();
      }
      localStorage.setItem('sic_tv_telas', JSON.stringify(next));
      if (!next.includes(slideAtual)) {
        setSlideAtual(next[0]);
      }
      setProgresso(0);
      return next;
    });
  };

  // ==========================================
  // PROCESSAMENTO DE DADOS: TENDÊNCIAS
  // ==========================================
  const totalChamados = chamados.length;
  const mensal = agruparPorMes(chamados);
  const mesesAtuais = mensal.slice(-3);
  const mesesAnteriores = mensal.slice(-6, -3);
  const totalAtual = mesesAtuais.reduce((sum, [, c]) => sum + c, 0);
  const totalAnterior = mesesAnteriores.reduce((sum, [, c]) => sum + c, 0);
  const crescimento =
    totalAnterior > 0
      ? Math.round(((totalAtual - totalAnterior) / totalAnterior) * 100)
      : 0;

  const motivos = contarPor(chamados, 'motivo');
  const motivoPrincipal = motivos[0];
  const secE = contarPor(chamados, 'secretaria').slice(0, 6);
  const maxSec = secE[0]?.[1] || 1;
  const semana = agruparPorDiaSemana(chamados);

  // Top Unidades Críticas / Reincidentes (desconsiderando ADVANCIS e Não Identificado)
  const unidadesMapa = {};
  chamados.forEach((c) => {
    const und = c.unidade?.trim();
    const sec = c.secretaria?.trim();
    if (
      !und ||
      und.toUpperCase() === 'NÃO IDENTIFICADO' ||
      und.toUpperCase() === 'NAO IDENTIFICADO' ||
      und.toUpperCase() === 'N/I' ||
      und.toUpperCase() === 'ADVANCIS' ||
      sec?.toUpperCase() === 'ADVANCIS'
    )
      return;
    if (!unidadesMapa[und]) {
      unidadesMapa[und] = { count: 0, secretaria: c.secretaria };
    }
    unidadesMapa[und].count++;
  });

  const topUnidadesCriticas = Object.entries(unidadesMapa)
    .map(([unidade, info]) => ({
      unidade,
      count: info.count,
      secretaria: info.secretaria,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const maxUnidadeCount = topUnidadesCriticas[0]?.count || 1;

  // 5 Chamados mais antigos ainda em aberto
  const chamadosAbertos = chamados.filter(
    (c) =>
      c.status !== 'Atendimento Encerrado' &&
      c.status !== 'Atendimento Cancelado' &&
      c.status !== 'Concluído'
  );
  const chamadosMaisAntigos = [...chamadosAbertos]
    .filter((c) => c.data_abertura)
    .sort((a, b) => new Date(a.data_abertura) - new Date(b.data_abertura))
    .slice(0, 5);

  // Gráfico Mensal (Chart.js)
  const chartMensalData = {
    labels: mensal.slice(-9).map(([m]) => {
      const [y, mo] = m.split('-');
      return new Date(+y, +mo - 1).toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      });
    }),
    datasets: [
      {
        label: 'Chamados',
        data: mensal.slice(-9).map(([, c]) => c),
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.18)',
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10B981',
        pointBorderColor: '#0B0F19',
        pointBorderWidth: 2,
        pointRadius: 6,
      },
    ],
  };

  const chartMensalOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B',
        titleFont: { size: 14, weight: '600' },
        bodyFont: { size: 14 },
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94A3B8', font: { size: 13, weight: '500' } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94A3B8', font: { size: 13, weight: '500' } },
      },
    },
  };

  // Gráfico Dia da Semana (Chart.js)
  const chartSemanaData = {
    labels: semana.map((s) => s.dia),
    datasets: [
      {
        label: 'Chamados',
        data: semana.map((s) => s.count),
        backgroundColor: semana.map((_, i) =>
          i === 5 ? 'rgba(244, 63, 94, 0.85)' : 'rgba(59, 130, 246, 0.85)'
        ),
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const chartSemanaOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B',
        titleFont: { size: 14, weight: '600' },
        bodyFont: { size: 14 },
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#94A3B8', font: { size: 13, weight: '600' } },
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.05)' },
        ticks: { color: '#94A3B8', font: { size: 13, weight: '500' } },
      },
    },
  };

  // ==========================================
  // PROCESSAMENTO DE DADOS: PROTOCOLO DIGITAL
  // ==========================================
  const totalProtocolos = protocolos.length;
  const abertos = protocolos.filter((d) => d.status === 'Aberto').length;
  const emAnalise = protocolos.filter((d) => d.status === 'Em Análise').length;
  const aguardandoRetorno = protocolos.filter(
    (d) => d.status === 'Aguardando Retorno'
  ).length;
  const concluidos = protocolos.filter((d) => d.status === 'Concluído').length;
  const taxaConclusao =
    totalProtocolos > 0
      ? Math.round((concluidos / totalProtocolos) * 100)
      : 0;

  // Normalização das Secretarias para evitar duplicidades (ex: Educação x Secretaria de Educação)
  const normalizarSecProt = (nome) => {
    if (!nome) return 'Não Informada';
    const n = nome.trim();
    if (n.includes('Educação') || n === 'SED') return 'Educação (SED)';
    if (n.includes('Saúde') || n === 'SS') return 'Saúde (SS)';
    if (n.includes('Assistência Social') || n === 'SAS') return 'Assistência Social (SAS)';
    if (n.includes('Segurança') || n === 'SECONTRU') return 'Segurança (SECONTRU)';
    if (n.includes('Administração') || n === 'SA') return 'Administração (SA)';
    if (n.includes('Finanças') || n === 'SF') return 'Finanças (SF)';
    if (n.includes('Cultura') || n === 'SCULT') return 'Cultura (SCULT)';
    if (n.includes('Esporte') || n === 'SEREL') return 'Esportes (SEREL)';
    if (n.includes('Habitação') || n === 'SEHAB') return 'Habitação (SEHAB)';
    if (n.includes('Planejamento') || n === 'SEPLAG') return 'Planejamento (SEPLAG)';
    if (n.includes('Obras') || n === 'SO') return 'Obras (SO)';
    if (n.includes('Comunicação') || n === 'SECOM') return 'Comunicação (SECOM)';
    return n;
  };

  const protNormalizados = protocolos.map((p) => ({
    ...p,
    secNorm: normalizarSecProt(p.secretaria),
  }));

  const protSec = contarPor(protNormalizados, 'secNorm').slice(0, 5);
  const maxProtSec = protSec[0]?.[1] || 1;
  const protTipos = contarPor(protocolos, 'tipo_solicitacao').slice(0, 5);

  // Gráfico Pizza/Donut Protocolo Status
  const chartStatusData = {
    labels: ['Concluído', 'Aberto / Triagem', 'Em Análise', 'Aguardando Retorno'],
    datasets: [
      {
        data: [concluidos, abertos, emAnalise, aguardandoRetorno],
        backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#8B5CF6'],
        borderColor: '#0B0F19',
        borderWidth: 3,
        hoverOffset: 6,
      },
    ],
  };

  const chartStatusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '64%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#CBD5E1',
          font: { size: 12, weight: '600' },
          padding: 12,
          usePointStyle: true,
          pointStyle: 'circle',
        },
      },
      tooltip: {
        backgroundColor: '#1E293B',
        titleFont: { size: 14, weight: '600' },
        bodyFont: { size: 14 },
        padding: 12,
        cornerRadius: 8,
      },
    },
  };

  return (
    <div
      style={{
        width: '100%',
        minHeight: standalone ? '100vh' : 'calc(100vh - 40px)',
        height: standalone ? '100vh' : 'auto',
        backgroundColor: '#0A0E1A',
        color: '#F8FAFC',
        fontFamily: "'Inter', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        overflow: standalone ? 'hidden' : 'auto',
        position: 'relative',
        boxSizing: 'border-box',
        padding: standalone ? '20px 28px' : '16px 20px',
      }}
    >
      {/* ========================================================
          BARRA SUPERIOR (HEADER NOC)
          ======================================================== */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: '12px 24px',
          marginBottom: 18,
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.35)',
          gap: 16,
          flexShrink: 0,
        }}
      >
        {/* Identificação & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: 5,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
            }}
          >
            <img
              src={logoDarh}
              alt="DARH"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: '#FFFFFF',
                }}
              >
                SIC-BIOMETRIA · PAINEL
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#10B981',
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: '#10B981',
                    boxShadow: '0 0 8px #10B981',
                  }}
                />
                Operacional
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#94A3B8',
                marginTop: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>Prefeitura de Osasco</span>
              <span>•</span>
              <span>
                Atualizado:{' '}
                {ultimaAtualizacao.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Seletor de Telas & Controles do Carrossel */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(30, 41, 59, 0.6)',
            padding: '6px 14px',
            borderRadius: 30,
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          <button
            onClick={() => mudarSlide(0)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background:
                slideAtual === 0
                  ? 'linear-gradient(135deg, #10B981, #059669)'
                  : 'transparent',
              color: slideAtual === 0 ? '#FFFFFF' : '#94A3B8',
              boxShadow:
                slideAtual === 0 ? '0 2px 10px rgba(16, 185, 129, 0.35)' : 'none',
            }}
          >
            1. Tendências & Chamados
          </button>
          <button
            onClick={() => mudarSlide(1)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background:
                slideAtual === 1
                  ? 'linear-gradient(135deg, #3B82F6, #1D4ED8)'
                  : 'transparent',
              color: slideAtual === 1 ? '#FFFFFF' : '#94A3B8',
              boxShadow:
                slideAtual === 1 ? '0 2px 10px rgba(59, 130, 246, 0.35)' : 'none',
            }}
          >
            2. Protocolo Digital
          </button>

          {/* Botão Pausar / Play */}
          <button
            onClick={() => setPausado(!pausado)}
            title={pausado ? 'Retomar rotação' : 'Pausar rotação'}
            style={{
              background: pausado ? '#F59E0B' : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: pausado ? '#000000' : '#FFFFFF',
              transition: 'all 0.2s',
            }}
          >
            {pausado ? <Play size={15} fill="#000" /> : <Pause size={15} />}
          </button>
        </div>

        {/* Relógio Digital & Ações de Tela */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 900,
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {horaAtual.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </div>
            <div
              style={{
                fontSize: 12,
                color: '#94A3B8',
                marginTop: 3,
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {horaAtual.toLocaleDateString('pt-BR', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Se estiver no modo embutido, botão para abrir /tv em nova aba */}
            {!standalone && (
              <button
                onClick={() => window.open('/tv', '_blank')}
                title="Abrir Modo TV em Nova Guia (Tela Cheia)"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'linear-gradient(135deg, #10B981 0%, #0D9488 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                }}
              >
                <ExternalLink size={14} />
                Aba Exclusiva TV
              </button>
            )}

            {/* Botão Configurações */}
            <button
              onClick={() => setModalConfig(true)}
              title="Configurações de Exibição"
              style={{
                background: modalConfig ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                border: modalConfig ? '1px solid #10B981' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 10,
                width: 38,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: modalConfig ? '#10B981' : '#CBD5E1',
                transition: 'all 0.2s',
              }}
            >
              <Settings size={18} />
            </button>

            {/* Botão Tela Cheia (F11 / API) */}
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Sair da Tela Cheia' : 'Entrar em Tela Cheia'}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 10,
                width: 38,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#CBD5E1',
                transition: 'all 0.2s',
              }}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Barra de Progresso do Carrossel */}
      <div
        style={{
          width: '100%',
          height: 3,
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 2,
          overflow: 'hidden',
          marginBottom: 16,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progresso}%`,
            background:
              slideAtual === 0
                ? 'linear-gradient(90deg, #10B981, #34D399)'
                : 'linear-gradient(90deg, #3B82F6, #60A5FA)',
            transition: pausado ? 'none' : 'width 0.2s linear',
          }}
        />
      </div>

      {/* ========================================================
          CONTEÚDO PRINCIPAL (SLIDES COM TRANSIÇÃO SUAVE)
          ======================================================== */}
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          minHeight: 0,
        }}
      >
        <AnimatePresence mode="wait">
          {slideAtual === 0 ? (
            /* ----------------------------------------------------
               SLIDE 1: TENDÊNCIAS EM EQUIPAMENTOS E CHAMADOS
               ---------------------------------------------------- */
            <motion.div
              key="slide-tendencias"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                gap: 16,
              }}
            >
              {/* LINHA DE BIG NUMBERS / KPIS */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 16,
                  flexShrink: 0,
                }}
              >
                {/* KPI 1 */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: `4px solid ${CORES.primary}`,
                    borderRadius: 16,
                    padding: '16px 20px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Total de Chamados
                    </span>
                    <Activity size={18} color={CORES.primary} />
                  </div>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 900,
                      color: '#FFFFFF',
                      lineHeight: 1,
                    }}
                  >
                    {totalChamados.toLocaleString('pt-BR')}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginTop: 6,
                      fontWeight: 500,
                    }}
                  >
                    Histórico completo acumulado
                  </div>
                </div>

                {/* KPI 2 */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: `4px solid ${
                      crescimento >= 0 ? CORES.rose : CORES.primary
                    }`,
                    borderRadius: 16,
                    padding: '16px 20px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Tendência Trimestral
                    </span>
                    <TrendingUp
                      size={18}
                      color={crescimento >= 0 ? CORES.rose : CORES.primary}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 900,
                      color: crescimento >= 0 ? '#F43F5E' : '#10B981',
                      lineHeight: 1,
                    }}
                  >
                    {crescimento >= 0 ? `+${crescimento}%` : `${crescimento}%`}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginTop: 6,
                      fontWeight: 500,
                    }}
                  >
                    vs. trimestre anterior
                  </div>
                </div>

                {/* KPI 3 */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: `4px solid ${CORES.amber}`,
                    borderRadius: 16,
                    padding: '16px 20px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Principal Motivo
                    </span>
                    <Layers size={18} color={CORES.amber} />
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      color: '#FFFFFF',
                      lineHeight: 1.1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={motivoPrincipal?.[0] || '—'}
                  >
                    {motivoPrincipal?.[0] || '—'}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginTop: 6,
                      fontWeight: 500,
                    }}
                  >
                    {motivoPrincipal
                      ? `${motivoPrincipal[1]} ocorrências registradas`
                      : 'N/A'}
                  </div>
                </div>

                {/* KPI 4 */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: `4px solid ${CORES.blue}`,
                    borderRadius: 16,
                    padding: '16px 20px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Secretaria c/ Maior Volume
                    </span>
                    <Building2 size={18} color={CORES.blue} />
                  </div>
                  <div
                    style={{
                      fontSize: 26,
                      fontWeight: 900,
                      color: '#FFFFFF',
                      lineHeight: 1.1,
                    }}
                  >
                    {secE[0]?.[0] || '—'}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginTop: 6,
                      fontWeight: 500,
                    }}
                  >
                    {secE[0]
                      ? `${secE[0][1]} chamados (${Math.round(
                          (secE[0][1] / (totalChamados || 1)) * 100
                        )}% do total)`
                      : 'N/A'}
                  </div>
                </div>
              </div>

              {/* ÁREA DE GRÁFICOS (3 COLUNAS / DIVISÃO DE ALTO IMPACTO) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.25fr 1fr 1.35fr',
                  gap: 16,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* Gráfico 1: Evolução Mensal */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderRadius: 16,
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TrendingUp size={18} color={CORES.primary} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>
                        Evolução Mensal de Chamados
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        background: 'rgba(255,255,255,0.06)',
                        padding: '3px 8px',
                        borderRadius: 6,
                        color: '#94A3B8',
                      }}
                    >
                      Últimos 9 meses
                    </span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                    <Line data={chartMensalData} options={chartMensalOptions} />
                  </div>
                </div>

                {/* Cartão Central: Top Unidades Críticas / Reincidentes */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: '4px solid #F59E0B',
                    borderRadius: 16,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={18} color="#F59E0B" />
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>
                        Unidades c/ Mais Ocorrências
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        color: '#FBBF24',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontWeight: 700,
                      }}
                    >
                      Reincidentes
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      gap: 8,
                      minHeight: 0,
                    }}
                  >
                    {topUnidadesCriticas.map((u, i) => {
                      const pct = Math.round((u.count / maxUnidadeCount) * 100);
                      return (
                        <div
                          key={u.unidade}
                          style={{
                            flex: 1,
                            minHeight: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            background: 'rgba(255, 255, 255, 0.035)',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            borderRadius: 10,
                            padding: '8px 14px',
                            gap: 4,
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                maxWidth: '75%',
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  color: i === 0 ? '#F59E0B' : '#94A3B8',
                                  width: 18,
                                }}
                              >
                                #{i + 1}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: '#F8FAFC',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                                title={u.unidade}
                              >
                                {u.unidade}
                              </span>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  background: 'rgba(59, 130, 246, 0.2)',
                                  color: '#60A5FA',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  textTransform: 'uppercase',
                                }}
                              >
                                {u.secretaria || 'SED'}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  color: '#FBBF24',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {u.count} {u.count === 1 ? 'chamado' : 'chamados'}
                              </span>
                            </div>
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: 5,
                              background: 'rgba(255, 255, 255, 0.06)',
                              borderRadius: 4,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background:
                                  i === 0
                                    ? 'linear-gradient(90deg, #F59E0B, #EF4444)'
                                    : 'linear-gradient(90deg, #3B82F6, #60A5FA)',
                                borderRadius: 4,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 5 Chamados Mais Antigos em Aberto */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: `4px solid ${CORES.rose}`,
                    borderRadius: 16,
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <AlertTriangle size={18} color={CORES.rose} />
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>
                        Chamados Mais Antigos em Aberto
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        background: 'rgba(244, 63, 94, 0.15)',
                        border: '1px solid rgba(244, 63, 94, 0.3)',
                        color: '#FB7185',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontWeight: 700,
                      }}
                    >
                      {chamadosAbertos.length} em aberto
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      gap: 8,
                      minHeight: 0,
                    }}
                  >
                    {chamadosMaisAntigos.length === 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          color: '#94A3B8',
                          fontSize: 14,
                        }}
                      >
                        Nenhum chamado pendente no momento 🎉
                      </div>
                    ) : (
                      chamadosMaisAntigos.map((c) => {
                        const dias = calcularDiasEmAberto(c.data_abertura);
                        const dataFmt = c.data_abertura
                          ? new Date(c.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                            })
                          : '—';

                        const ehPausado = c.status === 'Atendimento Pausado';

                        return (
                          <div
                            key={c.ticket}
                            style={{
                              flex: 1,
                              minHeight: 0,
                              background: 'rgba(255, 255, 255, 0.035)',
                              border: '1px solid rgba(255, 255, 255, 0.07)',
                              borderLeft: `4px solid ${ehPausado ? '#F59E0B' : '#F43F5E'}`,
                              borderRadius: 10,
                              padding: '8px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              gap: 4,
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    fontSize: 13,
                                    fontWeight: 900,
                                    color: '#FFFFFF',
                                    fontVariantNumeric: 'tabular-nums',
                                  }}
                                >
                                  #{c.ticket}
                                </span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    background: 'rgba(59, 130, 246, 0.2)',
                                    color: '#60A5FA',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {c.secretaria || 'N/A'}
                                </span>
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    background: 'rgba(245, 158, 11, 0.15)',
                                    color: '#FBBF24',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                  }}
                                >
                                  {c.motivo || 'EQUIPAMENTO'}
                                </span>
                                {c.status && (
                                  <span
                                    style={{
                                      fontSize: 10,
                                      fontWeight: 600,
                                      background: ehPausado ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                                      color: ehPausado ? '#FCD34D' : '#94A3B8',
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                    }}
                                  >
                                    {c.status}
                                  </span>
                                )}
                              </div>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 900,
                                  color: dias > 30 ? '#F43F5E' : '#F59E0B',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                {dias !== null ? (dias === 0 ? 'Hoje' : `Há ${dias} dias`) : dataFmt}
                              </span>
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: '#F8FAFC',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '70%',
                                }}
                                title={c.unidade}
                              >
                                {c.unidade || 'Unidade não identificada'}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: '#64748B',
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                              >
                                Aberto em {dataFmt}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            /* ----------------------------------------------------
               SLIDE 2: PAINEL DO PROTOCOLO DIGITAL
               ---------------------------------------------------- */
            <motion.div
              key="slide-protocolos"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.4 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                gap: 16,
              }}
            >
              {/* LINHA DE BIG NUMBERS / KPIS - Ordem: Total -> Concluídos -> Abertos -> Em Análise -> Taxa */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: 16,
                  flexShrink: 0,
                }}
              >
                {/* 1. Total Protocolos */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: '4px solid #8B5CF6',
                    borderRadius: 16,
                    padding: '16px 20px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Total Protocolos
                    </span>
                    <FileText size={18} color="#8B5CF6" />
                  </div>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 900,
                      color: '#FFFFFF',
                      lineHeight: 1,
                    }}
                  >
                    {totalProtocolos.toLocaleString('pt-BR')}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginTop: 6,
                      fontWeight: 500,
                    }}
                  >
                    Demandas protocoladas
                  </div>
                </div>

                {/* 2. Concluídos */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: `4px solid ${CORES.primary}`,
                    borderRadius: 16,
                    padding: '16px 20px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Concluídos
                    </span>
                    <CheckCircle2 size={18} color={CORES.primary} />
                  </div>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 900,
                      color: '#10B981',
                      lineHeight: 1,
                    }}
                  >
                    {concluidos.toLocaleString('pt-BR')}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginTop: 6,
                      fontWeight: 500,
                    }}
                  >
                    Demandas finalizadas
                  </div>
                </div>

                {/* 3. Abertos / Triagem */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: `4px solid ${CORES.blue}`,
                    borderRadius: 16,
                    padding: '16px 20px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Abertos / Triagem
                    </span>
                    <Clock size={18} color={CORES.blue} />
                  </div>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 900,
                      color: '#3B82F6',
                      lineHeight: 1,
                    }}
                  >
                    {abertos}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginTop: 6,
                      fontWeight: 500,
                    }}
                  >
                    Aguardando análise inicial
                  </div>
                </div>

                {/* 4. Em Análise */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: `4px solid ${CORES.amber}`,
                    borderRadius: 16,
                    padding: '16px 20px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Em Análise
                    </span>
                    <AlertCircle size={18} color={CORES.amber} />
                  </div>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 900,
                      color: '#F59E0B',
                      lineHeight: 1,
                    }}
                  >
                    {emAnalise}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginTop: 6,
                      fontWeight: 500,
                    }}
                  >
                    Com técnicos / analistas
                  </div>
                </div>

                {/* 5. Taxa de Resolução */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderTop: '4px solid #14B8A6',
                    borderRadius: 16,
                    padding: '16px 20px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#94A3B8',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      Taxa de Resolução
                    </span>
                    <Sparkles size={18} color="#14B8A6" />
                  </div>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 900,
                      color: '#2DD4BF',
                      lineHeight: 1,
                    }}
                  >
                    {taxaConclusao}%
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: '#64748B',
                      marginTop: 6,
                      fontWeight: 500,
                    }}
                  >
                    Índice de resolução geral
                  </div>
                </div>
              </div>

              {/* ÁREA DE GRÁFICOS PROTOCOLO */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.15fr 1.25fr',
                  gap: 16,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* Gráfico 1: Status Donut */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderRadius: 16,
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>
                      Status das Tramitações
                    </span>
                  </div>
                  <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
                    <Doughnut data={chartStatusData} options={chartStatusOptions} />
                  </div>
                </div>

                {/* Gráfico 2: Demandas por Secretaria (com fit proporcional) */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderRadius: 16,
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Building2 size={18} color="#8B5CF6" />
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>
                        Protocolos por Secretaria
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      gap: 8,
                      minHeight: 0,
                    }}
                  >
                    {protSec.map(([nome, count], i) => {
                      const pct = Math.round((count / maxProtSec) * 100);
                      return (
                        <div
                          key={nome}
                          style={{
                            flex: 1,
                            minHeight: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.04)',
                            borderRadius: 8,
                            padding: '6px 12px',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              fontSize: 13,
                              fontWeight: 600,
                              marginBottom: 4,
                            }}
                          >
                            <span style={{ color: '#E2E8F0' }}>{nome}</span>
                            <span style={{ color: '#C084FC', fontWeight: 700 }}>
                              {count.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div
                            style={{
                              width: '100%',
                              height: 6,
                              background: 'rgba(255,255,255,0.06)',
                              borderRadius: 4,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background:
                                  'linear-gradient(90deg, #8B5CF6, #C084FC)',
                                borderRadius: 4,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Gráfico 3: Tipos de Solicitação (com fit proporcional) */}
                <div
                  style={{
                    background: CORES.cardBg,
                    border: `1px solid ${CORES.cardBorder}`,
                    borderRadius: 16,
                    padding: '18px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <FileText size={18} color="#10B981" />
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9' }}>
                        Principais Tipos de Solicitação
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      flex: 1,
                      gap: 8,
                      minHeight: 0,
                    }}
                  >
                    {protTipos.map(([tipo, count], i) => (
                      <div
                        key={tipo}
                        style={{
                          flex: 1,
                          minHeight: 0,
                          background: 'rgba(255, 255, 255, 0.035)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: 10,
                          padding: '8px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
                            color: '#E2E8F0',
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '75%',
                          }}
                          title={tipo}
                        >
                          {tipo}
                        </span>
                        <span
                          style={{
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34D399',
                            padding: '3px 10px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 800,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {count.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* MODAL DE CONFIGURAÇÕES DE EXIBIÇÃO */}
      <AnimatePresence>
        {modalConfig && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 20,
            }}
            onClick={() => setModalConfig(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 480,
                background: '#111827',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 20,
                padding: '24px 28px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                color: '#F8FAFC',
              }}
            >
              {/* Header Modal */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 20,
                  paddingBottom: 14,
                  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#10B981',
                    }}
                  >
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#FFFFFF' }}>
                      Configurações do Monitor
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                      Personalize o comportamento na televisão
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setModalConfig(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: 'none',
                    borderRadius: 8,
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#94A3B8',
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Opção 1: Tempo de Rotação */}
              <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0' }}>
                    Tempo por Tela
                  </label>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#10B981' }}>
                    {duracaoSegundos} segundos
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {OPCOES_TEMPO.map((seg) => (
                    <button
                      key={seg}
                      onClick={() => atualizarDuracao(seg)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        border:
                          duracaoSegundos === seg
                            ? '1px solid #10B981'
                            : '1px solid rgba(255, 255, 255, 0.08)',
                        background:
                          duracaoSegundos === seg
                            ? 'rgba(16, 185, 129, 0.2)'
                            : 'rgba(255, 255, 255, 0.04)',
                        color: duracaoSegundos === seg ? '#34D399' : '#94A3B8',
                      }}
                    >
                      {seg}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Opção 2: Telas Ativas no Ciclo */}
              <div style={{ marginBottom: 22 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', display: 'block', marginBottom: 10 }}>
                  Telas Habilitadas no Carrossel
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { id: 0, label: '1. Tendências & Chamados' },
                    { id: 1, label: '2. Protocolo Digital' },
                  ].map((tela) => {
                    const ativa = telasAtivas.includes(tela.id);
                    return (
                      <div
                        key={tela.id}
                        onClick={() => toggleTelaAtiva(tela.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: ativa ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                          border: ativa ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: 10,
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, color: ativa ? '#FFFFFF' : '#64748B' }}>
                          {tela.label}
                        </span>
                        <div
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            background: ativa ? '#10B981' : 'transparent',
                            border: ativa ? 'none' : '1px solid #64748B',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {ativa && <Check size={14} color="#FFFFFF" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botão Fechar / Salvar */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  onClick={() => setModalConfig(false)}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
                  }}
                >
                  Concluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
