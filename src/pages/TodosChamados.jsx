import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchChamados } from '@/lib/supabase';
import { fmtDate } from '@/lib/utils';
import { COR_SEC } from '@/lib/constants';
import {
  Upload, Download, Search, X, Filter, SlidersHorizontal,
  AlertTriangle, CheckCircle2, Clock, ChevronRight, ChevronLeft,
  ChevronsLeft, ChevronsRight, Copy, Check, ExternalLink,
  Building2, Wrench, ScanFace, UserCheck, HelpCircle,
  RefreshCw, Inbox, AlertCircle, Eye, ArrowUpDown, ChevronDown
} from 'lucide-react';
import ModalImportacaoChamados from '@/components/ModalImportacaoChamados';
import ChamadoAtividades from '@/components/chamados/ChamadoAtividades';
import { MultiSelectDropdown } from '@/components/ui/multi-select-dropdown';
import { DateRangeFilterDropdown } from '@/components/ui/DateRangeFilterDropdown';
import { getNome, getCor } from '@/lib/secretarias';
import { motion, AnimatePresence } from 'motion/react';

// Constantes de Filtro
const FILTROS_MOT = ['Todos', 'EQUIPAMENTO', 'RECONHECIMENTO', 'ESPELHO DE PONTO', 'CADASTRO'];
const FILTROS_ST = ['Todos', 'Aguardando Atendimento', 'Atendimento Encerrado'];
const FILTROS_FONTE = ['Todos', 'Com Divergência (Auvo ≠ Asana)', 'Apenas AUVO', 'Apenas ASANA'];

function isDivergente(chamado) {
  if (!chamado) return false;
  const auvo = chamado.status_auvo || chamado.status;
  const asana = chamado.status_asana;
  return Boolean(auvo && asana && auvo !== asana);
}

function getMotivoIcon(motivo) {
  switch (motivo) {
    case 'EQUIPAMENTO':
      return <Wrench size={12} className="text-rose-500 shrink-0" />;
    case 'RECONHECIMENTO':
      return <ScanFace size={12} className="text-emerald-500 shrink-0" />;
    case 'ESPELHO DE PONTO':
      return <Clock size={12} className="text-amber-500 shrink-0" />;
    case 'CADASTRO':
      return <UserCheck size={12} className="text-teal-500 shrink-0" />;
    default:
      return <HelpCircle size={12} className="text-slate-400 shrink-0" />;
  }
}

// ─── Drawer Inspector (Slide-Over Sheet) ───────────────────────────────────────
function ChamadoDrawer({ chamado, onClose, onNavigateNext, onNavigatePrev, onChamadoUpdated }) {
  const navigate = useNavigate();
  const [copiado, setCopiado] = useState(false);
  const [copiadoTexto, setCopiadoTexto] = useState(false);

  // Trava o scroll da página de fundo (lista de chamados) enquanto o drawer estiver aberto
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    const originalBodyPaddingRight = document.body.style.paddingRight;

    // Compensar largura da scrollbar para evitar pulo no layout
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      document.body.style.paddingRight = originalBodyPaddingRight;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown' && onNavigateNext) {
        e.preventDefault();
        onNavigateNext();
      }
      if (e.key === 'ArrowUp' && onNavigatePrev) {
        e.preventDefault();
        onNavigatePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigateNext, onNavigatePrev]);

  if (!chamado) return null;

  const stAuvo = chamado.status_auvo || chamado.status || 'Aguardando Atendimento';
  const stAsana = chamado.status_asana;
  const divergente = isDivergente(chamado);
  const corSec = COR_SEC[chamado.secretaria] || '#64748b';

  const copiarTicket = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(String(chamado.ticket));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const copiarResumo = () => {
    const resumo = `📋 Chamado #${chamado.ticket}
• Unidade: ${chamado.unidade || 'N/A'} (${chamado.secretaria || 'N/A'})
• Motivo: ${chamado.motivo || 'N/A'}
• Status AUVO: ${stAuvo}
• Status ASANA: ${stAsana || 'Não registrado'}
• Data Abertura: ${fmtDate(chamado.data_abertura)}
• Problema: ${chamado.problema || 'Sem descrição'}`;
    navigator.clipboard.writeText(resumo);
    setCopiadoTexto(true);
    setTimeout(() => setCopiadoTexto(false), 2200);
  };

  return (
    <>
      <motion.div
        className="drawer-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        onClick={onClose}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onTouchMove={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      />
      <motion.aside
        className="drawer-panel"
        initial={{ transform: 'translateX(100%)' }}
        animate={{ transform: 'translateX(0%)' }}
        exit={{ transform: 'translateX(100%)' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320, mass: 0.8 }}
        aria-label="Detalhes do Chamado"
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span className="ticket-pill" style={{ fontSize: 13, padding: '4px 9px' }}>
                #{chamado.ticket}
                <button
                  onClick={copiarTicket}
                  className="ticket-copy-btn"
                  title="Copiar número do ticket"
                  style={{ opacity: 1, marginLeft: 2 }}
                >
                  {copiado ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                </button>
              </span>

              <span
                className={`status-chip ${stAuvo === 'Atendimento Encerrado' ? 'status-chip-encerrado' : 'status-chip-aberto'}`}
              >
                <span className="status-dot-pulse" />
                {stAuvo}
              </span>

              {divergente && (
                <span className="divergence-pill">
                  <AlertTriangle size={11} /> Descompasso Auvo/Asana
                </span>
              )}
            </div>

            <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>
              Aberto em {fmtDate(chamado.data_abertura)}
            </div>
          </div>

          <button
            onClick={onClose}
            className="drawer-close-btn"
            title="Fechar (Esc)"
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="drawer-body">
          {/* Card de Alerta se houver Divergência */}
          {divergente && (
            <div
              style={{
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={18} className="text-amber-500 shrink-0" style={{ marginTop: 2 }} />
              <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>
                <strong style={{ color: '#D97706', display: 'block', marginBottom: 2 }}>
                  Divergência de Sincronização Detectada
                </strong>
                No <strong>Auvo</strong> consta como{' '}
                <span style={{ textDecoration: 'underline' }}>{stAuvo}</span>, enquanto no{' '}
                <strong>Asana</strong> está como{' '}
                <span style={{ textDecoration: 'underline' }}>{stAsana}</span>
                {chamado.secao_asana ? ` na seção "${chamado.secao_asana}"` : ''}.
              </div>
            </div>
          )}

          {/* Unidade e Secretaria */}
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
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                {chamado.unidade || 'Unidade não identificada'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `${corSec}18`,
                    color: corSec,
                  }}
                >
                  {chamado.secretaria || 'N/I'}
                </span>
                <span style={{ fontSize: 11, color: 'var(--sub)' }}>
                  Secretaria responsável pelo ponto
                </span>
              </div>
            </div>
          </div>

          {/* Dados Técnicos */}
          <div>
            <div className="drawer-section-title">
              <SlidersHorizontal size={13} /> Parâmetros do Incidente
            </div>
            <div className="drawer-key-val-grid">
              <div className="drawer-key-val-card">
                <div className="drawer-key">Categoria / Motivo</div>
                <div className="drawer-val" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {getMotivoIcon(chamado.motivo)}
                  {chamado.motivo || '—'}
                </div>
              </div>

              <div className="drawer-key-val-card">
                <div className="drawer-key">Técnico / Responsável</div>
                <div className="drawer-val">
                  {chamado.responsavel || 'Não atribuído'}
                </div>
              </div>

              <div className="drawer-key-val-card">
                <div className="drawer-key">Status Auvo</div>
                <div className="drawer-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: stAuvo === 'Atendimento Encerrado' ? '#10B981' : '#F59E0B',
                    }}
                  />
                  {stAuvo}
                </div>
              </div>

              <div className="drawer-key-val-card">
                <div className="drawer-key">Status Asana</div>
                <div className="drawer-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: stAsana === 'Atendimento Encerrado' ? '#10B981' : stAsana ? '#F59E0B' : '#94A3B8',
                    }}
                  />
                  {stAsana || 'Não integrado'}
                </div>
              </div>
            </div>
          </div>

          {/* Descrição do Problema */}
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <div className="drawer-section-title" style={{ margin: 0 }}>
                <Inbox size={13} /> Relato do Chamado
              </div>
            </div>
            <div className="drawer-description-box">
              {chamado.problema || 'Nenhuma descrição detalhada informada.'}
            </div>
          </div>

          {/* Todas as atividades e Comentários */}
          <ChamadoAtividades
            chamado={chamado}
            onChamadoUpdated={onChamadoUpdated}
          />
        </div>

        {/* Drawer Footer */}
        <div className="drawer-footer">
          <button
            onClick={copiarResumo}
            className="pagination-btn"
            style={{ padding: '8px 14px' }}
          >
            {copiadoTexto ? (
              <>
                <Check size={14} className="text-emerald-500" /> Resumo Copiado!
              </>
            ) : (
              <>
                <Copy size={14} /> Copiar Resumo
              </>
            )}
          </button>

          <button
            onClick={() => {
              onClose();
              navigate('/chamado-detalhe', { state: { chamado } });
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
              transition: 'opacity 140ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Ver página completa <ExternalLink size={13} />
          </button>
        </div>
      </motion.aside>
    </>
  );
}

// ─── Componente Principal ───────────────────────────────────────────────────────
export default function TodosChamados() {
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [statusText, setStatusText] = useState('Carregando registros...');
  const [drawerChamado, setDrawerChamado] = useState(null);
  const [modalImportacaoAberta, setModalImportacaoAberta] = useState(false);

  // Filtros
  const [busca, setBusca] = useState('');
  const [quickView, setQuickView] = useState('todos'); // 'todos' | 'abertos' | 'divergencias' | 'encerrados'
  const [filtroData, setFiltroData] = useState({ preset: 'todos', dataInicio: '', dataFim: '' });
  const [selectedSecs, setSelectedSecs] = useState([]);
  const [selectedUnis, setSelectedUnis] = useState([]);
  const [filtroMot, setFiltroMot] = useState('Todos');
  const [filtroFonte, setFiltroFonte] = useState('Todos');
  const [filtroStatus, setFiltroStatus] = useState('Todos');

  // Paginação
  const [pagina, setPagina] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(25);

  const searchInputRef = useRef(null);

  // Carregar dados Supabase
  const carregar = useCallback(async () => {
    try {
      setCarregando(true);
      const data = await fetchChamados();
      setDados(data);
      setStatusText(
        `Atualizado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${data.length} registros`
      );
    } catch (err) {
      console.error(err);
      setStatusText('Erro ao carregar registros do Supabase');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel('todos-rt-stream')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados' }, carregar)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [carregar]);

  // Tecla de atalho para busca (/)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Métricas Computadas
  const metricas = useMemo(() => {
    const total = dados.length;
    let abertos = 0;
    let divergentes = 0;
    let encerrados = 0;

    for (let i = 0; i < dados.length; i++) {
      const d = dados[i];
      const st = d.status_auvo || d.status || 'Aguardando Atendimento';
      if (st === 'Aguardando Atendimento') abertos++;
      if (st === 'Atendimento Encerrado') encerrados++;
      if (isDivergente(d)) divergentes++;
    }

    return { total, abertos, divergentes, encerrados };
  }, [dados]);

  // Opções para Filtro Multi-Select de Secretarias (com pesquisa estilo Excel e contadores)
  const secretariasOpcoes = useMemo(() => {
    const map = new Map();
    for (const d of dados) {
      const sec = (d.secretaria || 'N/I').trim();
      if (!sec) continue;
      map.set(sec, (map.get(sec) || 0) + 1);
    }
    const lista = Array.from(map.entries()).map(([sigla, count]) => {
      const nomeCompleto = getNome(sigla);
      return {
        value: sigla,
        label: nomeCompleto && nomeCompleto !== sigla ? `${sigla} - ${nomeCompleto}` : sigla,
        color: getCor(sigla),
        count,
      };
    });
    lista.sort((a, b) => a.label.localeCompare(b.label));
    return lista;
  }, [dados]);

  const secretariasCounts = useMemo(() => {
    const c = {};
    for (const opt of secretariasOpcoes) {
      c[opt.value] = opt.count;
    }
    return c;
  }, [secretariasOpcoes]);

  // Opções para Filtro Multi-Select de Unidades (com pesquisa estilo Excel e contadores)
  const unidadesOpcoes = useMemo(() => {
    const map = new Map();
    for (const d of dados) {
      if (selectedSecs.length > 0 && !selectedSecs.includes(d.secretaria)) {
        continue;
      }
      const uni = (d.unidade || '').trim();
      if (!uni) continue;
      map.set(uni, (map.get(uni) || 0) + 1);
    }
    for (const sel of selectedUnis) {
      if (!map.has(sel)) {
        map.set(sel, 0);
      }
    }
    const lista = Array.from(map.entries()).map(([unidade, count]) => ({
      value: unidade,
      label: unidade,
      count,
    }));
    lista.sort((a, b) => a.label.localeCompare(b.label));
    return lista;
  }, [dados, selectedSecs, selectedUnis]);

  const unidadesCounts = useMemo(() => {
    const c = {};
    for (const opt of unidadesOpcoes) {
      c[opt.value] = opt.count;
    }
    return c;
  }, [unidadesOpcoes]);

  // Filtragem dos dados
  const dadosFiltrados = useMemo(() => {
    let r = dados;

    // Quick View (Segmented Control)
    if (quickView === 'abertos') {
      r = r.filter((d) => (d.status_auvo || d.status || 'Aguardando Atendimento') === 'Aguardando Atendimento');
    } else if (quickView === 'divergencias') {
      r = r.filter(isDivergente);
    } else if (quickView === 'encerrados') {
      r = r.filter((d) => (d.status_auvo || d.status) === 'Atendimento Encerrado');
    }

    // Busca textual ampla
    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      r = r.filter((d) => {
        const tMatch = String(d.ticket || '').toLowerCase().includes(q);
        const uMatch = String(d.unidade || '').toLowerCase().includes(q);
        const pMatch = String(d.problema || '').toLowerCase().includes(q);
        const sMatch = String(d.secretaria || '').toLowerCase().includes(q);
        const rMatch = String(d.responsavel || '').toLowerCase().includes(q);
        return tMatch || uMatch || pMatch || sMatch || rMatch;
      });
    }

    // Filtro por Data de Abertura
    if (filtroData && filtroData.preset !== 'todos') {
      const { dataInicio, dataFim } = filtroData;
      r = r.filter((d) => {
        if (!d.data_abertura) return false;
        const dStr = String(d.data_abertura).split('T')[0].trim();
        if (dataInicio && dStr < dataInicio) return false;
        if (dataFim && dStr > dataFim) return false;
        return true;
      });
    }

    // Filtro por Secretaria (Múltipla Seleção)
    if (selectedSecs.length > 0) {
      r = r.filter((d) => selectedSecs.includes(d.secretaria || 'N/I'));
    }

    // Filtro por Unidade (Múltipla Seleção)
    if (selectedUnis.length > 0) {
      r = r.filter((d) => selectedUnis.includes(d.unidade));
    }

    // Motivo
    if (filtroMot !== 'Todos') {
      r = r.filter((d) => d.motivo === filtroMot);
    }

    // Status Auvo
    if (filtroStatus !== 'Todos') {
      r = r.filter((d) => (d.status_auvo || d.status || 'Aguardando Atendimento') === filtroStatus);
    }

    // Fonte / Divergência específica
    if (filtroFonte !== 'Todos') {
      if (filtroFonte === 'Com Divergência (Auvo ≠ Asana)') {
        r = r.filter(isDivergente);
      } else if (filtroFonte === 'Apenas AUVO') {
        r = r.filter((d) => (d.status_auvo || d.status) && !d.status_asana);
      } else if (filtroFonte === 'Apenas ASANA') {
        r = r.filter((d) => d.status_asana && !d.status_auvo);
      }
    }

    return r;
  }, [dados, quickView, busca, filtroData, selectedSecs, selectedUnis, filtroMot, filtroStatus, filtroFonte]);

  // Resetar página quando filtros mudam
  useEffect(() => {
    setPagina(1);
  }, [quickView, busca, filtroData, selectedSecs, selectedUnis, filtroMot, filtroStatus, filtroFonte, itensPorPagina]);

  // Contagem de filtros ativos para botão Limpar
  const totalFiltrosAtivos = useMemo(() => {
    let count = 0;
    if (quickView !== 'todos') count++;
    if (busca.trim()) count++;
    if (filtroData && filtroData.preset !== 'todos') count++;
    if (selectedSecs.length > 0) count++;
    if (selectedUnis.length > 0) count++;
    if (filtroMot !== 'Todos') count++;
    if (filtroFonte !== 'Todos') count++;
    if (filtroStatus !== 'Todos') count++;
    return count;
  }, [quickView, busca, filtroData, selectedSecs, selectedUnis, filtroMot, filtroFonte, filtroStatus]);

  const limparFiltros = () => {
    setQuickView('todos');
    setBusca('');
    setFiltroData({ preset: 'todos', dataInicio: '', dataFim: '' });
    setSelectedSecs([]);
    setSelectedUnis([]);
    setFiltroMot('Todos');
    setFiltroFonte('Todos');
    setFiltroStatus('Todos');
    setPagina(1);
  };

  // Paginação
  const totalPaginas = Math.ceil(dadosFiltrados.length / itensPorPagina) || 1;
  const dadosPaginados = useMemo(() => {
    const inicio = (pagina - 1) * itensPorPagina;
    return dadosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [dadosFiltrados, pagina, itensPorPagina]);

  // Navegação no Drawer (Próximo / Anterior)
  const navegarDrawer = (delta) => {
    if (!drawerChamado) return;
    const idx = dadosFiltrados.findIndex((d) => d.ticket === drawerChamado.ticket);
    if (idx === -1) return;
    const novoIdx = idx + delta;
    if (novoIdx >= 0 && novoIdx < dadosFiltrados.length) {
      setDrawerChamado(dadosFiltrados[novoIdx]);
    }
  };

  // Exportar CSV
  const exportarCSV = () => {
    if (!dadosFiltrados.length) return;
    const colunas = [
      'Ticket',
      'Unidade',
      'Secretaria',
      'Motivo',
      'Data Abertura',
      'Status AUVO',
      'Status ASANA',
      'Divergente',
      'Problema',
    ];
    const linhas = dadosFiltrados.map((d) => [
      `"${d.ticket || ''}"`,
      `"${(d.unidade || '').replace(/"/g, '""')}"`,
      `"${d.secretaria || ''}"`,
      `"${d.motivo || ''}"`,
      `"${d.data_abertura || ''}"`,
      `"${d.status_auvo || d.status || ''}"`,
      `"${d.status_asana || ''}"`,
      isDivergente(d) ? 'SIM' : 'NAO',
      `"${(d.problema || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [colunas.join(','), ...linhas.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `chamados_sic_biometria_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-left">
          <h1>Central de Chamados</h1>
          <p>{statusText}</p>
        </div>
        <div className="topbar-right">
          <button
            onClick={exportarCSV}
            className="pagination-btn"
            style={{ padding: '7px 12px', fontSize: 12 }}
            title="Exportar dados filtrados em planilha CSV"
          >
            <Download size={14} /> Exportar CSV
          </button>

          <button
            onClick={() => setModalImportacaoAberta(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#0D7C3D',
              color: '#ffffff',
              border: 'none',
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 140ms ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            <Upload size={14} /> Importar Planilha
          </button>

          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* ── Operational Status Strip (Deck de Métricas) ── */}
        <div className="chamados-metrics-strip">
          {/* Card 1: Total */}
          <div
            className={`chamados-metric-cell ${quickView === 'todos' ? 'active-metric' : ''}`}
            onClick={() => setQuickView('todos')}
          >
            <div className="chamados-metric-header">
              <span className="chamados-metric-label">Total Monitorado</span>
              <span className="chamados-metric-badge" style={{ background: 'rgba(100,116,139,0.1)', color: 'var(--muted-c)' }}>
                Base Geral
              </span>
            </div>
            <div className="chamados-metric-val">{metricas.total}</div>
            <div className="chamados-metric-sub">
              <span>Registros sincronizados</span>
            </div>
          </div>

          {/* Card 2: Em Aberto */}
          <div
            className={`chamados-metric-cell ${quickView === 'abertos' ? 'active-metric' : ''}`}
            onClick={() => setQuickView('abertos')}
          >
            <div className="chamados-metric-header">
              <span className="chamados-metric-label">Em Aberto / Fila</span>
              <span className="chamados-metric-badge" style={{ background: 'rgba(245,158,11,0.12)', color: '#D97706' }}>
                <span className="status-dot-pulse" /> Atendimento
              </span>
            </div>
            <div className="chamados-metric-val" style={{ color: '#D97706' }}>
              {metricas.abertos}
            </div>
            <div className="chamados-metric-sub">
              <span>Aguardando resolução técnica</span>
            </div>
          </div>

          {/* Card 3: Divergências de Conciliação */}
          <div
            className={`chamados-metric-cell ${quickView === 'divergencias' ? 'active-metric' : ''}`}
            onClick={() => setQuickView('divergencias')}
            style={metricas.divergentes > 0 ? { borderColor: 'rgba(234, 179, 8, 0.4)' } : undefined}
          >
            <div className="chamados-metric-header">
              <span className="chamados-metric-label">Divergências Auvo ⇄ Asana</span>
              <span className="chamados-metric-badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#B45309' }}>
                <AlertTriangle size={11} /> Auditoria
              </span>
            </div>
            <div className="chamados-metric-val" style={{ color: metricas.divergentes > 0 ? '#B45309' : 'inherit' }}>
              {metricas.divergentes}
            </div>
            <div className="chamados-metric-sub">
              <span>{metricas.divergentes > 0 ? 'Requer conciliação manual' : 'Status 100% alinhados'}</span>
            </div>
          </div>

          {/* Card 4: Encerrados */}
          <div
            className={`chamados-metric-cell ${quickView === 'encerrados' ? 'active-metric' : ''}`}
            onClick={() => setQuickView('encerrados')}
          >
            <div className="chamados-metric-header">
              <span className="chamados-metric-label">Encerrados</span>
              <span className="chamados-metric-badge" style={{ background: 'rgba(16,185,129,0.12)', color: '#059669' }}>
                <CheckCircle2 size={11} /> Concluídos
              </span>
            </div>
            <div className="chamados-metric-val" style={{ color: '#059669' }}>
              {metricas.encerrados}
            </div>
            <div className="chamados-metric-sub">
              <span>
                {metricas.total > 0 ? `${Math.round((metricas.encerrados / metricas.total) * 100)}% de resolução` : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Command & Control Bar (Busca + Segmented Views + Filtros) ── */}
        <div className="chamados-control-bar">
          <div className="chamados-control-top">
            {/* Segmented Quick Views */}
            <div className="segmented-views">
              {[
                { id: 'todos', label: 'Todos', count: metricas.total },
                { id: 'abertos', label: 'Em Aberto', count: metricas.abertos },
                { id: 'divergencias', label: 'Divergências', count: metricas.divergentes, icon: <AlertTriangle size={12} className="text-amber-500" /> },
                { id: 'encerrados', label: 'Encerrados', count: metricas.encerrados },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setQuickView(tab.id)}
                  className={`segmented-tab-btn ${quickView === tab.id ? 'active' : ''}`}
                >
                  {quickView === tab.id && (
                    <motion.div
                      layoutId="segmentedActiveTab"
                      className="segmented-indicator"
                      transition={{ type: 'spring', bounce: 0.15, duration: 0.25 }}
                    />
                  )}
                  <span>
                    {tab.icon}
                    {tab.label}
                  </span>
                  <span className="segmented-count-badge">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Input de Busca */}
            <div className="chamados-search-wrapper">
              <Search size={14} className="chamados-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por ticket, unidade, problema... (pressione /)"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="chamados-search-input"
              />
              {busca && (
                <button onClick={() => setBusca('')} className="chamados-search-clear" title="Limpar busca">
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Segunda linha: Filtros específicos */}
          <div className="chamados-control-bottom">
            <div className="chamados-pills-row">
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-c)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Filtrar:
              </span>

              {/* Período de Abertura */}
              <DateRangeFilterDropdown
                filtroData={filtroData}
                onChange={setFiltroData}
              />

              {/* Secretarias (Seleção múltipla com busca estilo Excel) */}
              <MultiSelectDropdown
                placeholder="Todas as Secretarias"
                searchPlaceholder="Pesquisar secretaria..."
                options={secretariasOpcoes}
                values={selectedSecs}
                onChange={setSelectedSecs}
                counts={secretariasCounts}
                minWidth={175}
                maxWidth={270}
                feminine={true}
              />

              {/* Unidades (Seleção múltipla com busca estilo Excel) */}
              <MultiSelectDropdown
                placeholder="Todas as Unidades"
                searchPlaceholder="Pesquisar escola, posto, setor..."
                options={unidadesOpcoes}
                values={selectedUnis}
                onChange={setSelectedUnis}
                counts={unidadesCounts}
                minWidth={175}
                maxWidth={270}
                feminine={true}
              />

              {/* Motivo */}
              <select
                value={filtroMot}
                onChange={(e) => setFiltroMot(e.target.value)}
                className={`chamados-select-pill ${filtroMot !== 'Todos' ? 'has-value' : ''}`}
              >
                <option value="Todos">Todos os Motivos</option>
                {FILTROS_MOT.filter((m) => m !== 'Todos').map((m) => (
                  <option key={m} value={m}>
                    Motivo: {m}
                  </option>
                ))}
              </select>

              {/* Status Auvo */}
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className={`chamados-select-pill ${filtroStatus !== 'Todos' ? 'has-value' : ''}`}
              >
                <option value="Todos">Status AUVO: Todos</option>
                {FILTROS_ST.filter((st) => st !== 'Todos').map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              {/* Fonte */}
              <select
                value={filtroFonte}
                onChange={(e) => setFiltroFonte(e.target.value)}
                className={`chamados-select-pill ${filtroFonte !== 'Todos' ? 'has-value' : ''}`}
              >
                <option value="Todos">Origem: Todas</option>
                {FILTROS_FONTE.filter((f) => f !== 'Todos').map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {totalFiltrosAtivos > 0 && (
                <button onClick={limparFiltros} className="chamados-reset-btn">
                  <X size={12} /> Limpar {totalFiltrosAtivos} {totalFiltrosAtivos === 1 ? 'filtro' : 'filtros'}
                </button>
              )}
              <span style={{ fontSize: 11.5, color: 'var(--sub)' }}>
                {dadosFiltrados.length} de {metricas.total} chamados
              </span>
            </div>
          </div>
        </div>

        {/* ── Tabela de Chamados ── */}
        <div className="chamados-grid-card">
          <div style={{ overflowX: 'auto' }}>
            <table className="chamados-table">
              <thead>
                <tr>
                  <th style={{ width: '110px' }}>Ticket</th>
                  <th>Unidade & Lotação</th>
                  <th style={{ width: '160px' }}>Categoria / Motivo</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Abertura</th>
                  <th style={{ width: '140px' }}>Status AUVO</th>
                  <th style={{ width: '150px' }}>Status ASANA</th>
                  <th style={{ width: '240px' }}>Problema Relatado</th>
                  <th style={{ width: '70px', textAlign: 'right' }}></th>
                </tr>
              </thead>
              <tbody>
                {dadosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="chamados-empty-state">
                        <div className="chamados-empty-icon">
                          <Inbox size={22} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                          Nenhum chamado encontrado
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--muted-c)', maxWidth: 360, marginBottom: 16 }}>
                          Não encontramos registros correspondentes aos filtros ou termo de busca selecionados.
                        </div>
                        {totalFiltrosAtivos > 0 && (
                          <button onClick={limparFiltros} className="pagination-btn">
                            Limpar filtros aplicados
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  dadosPaginados.map((r, i) => {
                    const stAuvo = r.status_auvo || r.status || 'Aguardando Atendimento';
                    const stAsana = r.status_asana;
                    const divergente = isDivergente(r);
                    const corSec = COR_SEC[r.secretaria] || '#64748b';
                    const isSelected = drawerChamado?.ticket === r.ticket;

                    return (
                      <tr
                        key={r.ticket}
                        onClick={() => setDrawerChamado(r)}
                        className={`chamados-row ${isSelected ? 'selected-row' : ''}`}
                      >
                        {/* Ticket */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span className="ticket-pill">#{r.ticket}</span>
                            {divergente && (
                              <span className="divergence-pill" style={{ fontSize: 9 }}>
                                ⚠️ Descompasso
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Unidade */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12 }}>
                              {r.unidade || 'Não identificada'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 600,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: `${corSec}15`,
                                  color: corSec,
                                }}
                              >
                                {r.secretaria || 'N/I'}
                              </span>
                              {r.responsavel && (
                                <span style={{ fontSize: 10, color: 'var(--sub)' }}>
                                  · Resp: {r.responsavel}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Motivo */}
                        <td>
                          <div className="category-chip">
                            {getMotivoIcon(r.motivo)}
                            <span>{r.motivo || 'OUTROS'}</span>
                          </div>
                        </td>

                        {/* Abertura */}
                        <td style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontSize: 11, color: 'var(--muted-c)' }}>
                          {fmtDate(r.data_abertura)}
                        </td>

                        {/* Status Auvo */}
                        <td>
                          <span
                            className={`status-chip ${stAuvo === 'Atendimento Encerrado' ? 'status-chip-encerrado' : 'status-chip-aberto'}`}
                          >
                            <span className="status-dot-pulse" />
                            {stAuvo}
                          </span>
                        </td>

                        {/* Status Asana */}
                        <td>
                          {stAsana ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span
                                className={`status-chip ${stAsana === 'Atendimento Encerrado' ? 'status-chip-encerrado' : 'status-chip-aberto'}`}
                              >
                                <span className="status-dot-pulse" />
                                {stAsana}
                              </span>
                              {r.secao_asana && (
                                <span
                                  style={{
                                    fontSize: 9,
                                    color: 'var(--sub)',
                                    maxWidth: 140,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                  title={r.secao_asana}
                                >
                                  {r.secao_asana}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--sub)' }}>—</span>
                          )}
                        </td>

                        {/* Problema Preview */}
                        <td>
                          <div
                            style={{
                              fontSize: 11.5,
                              color: 'var(--muted-c)',
                              maxWidth: 240,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={r.problema}
                          >
                            {r.problema || 'Sem descrição'}
                          </div>
                        </td>

                        {/* Ação */}
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="pagination-btn"
                            style={{ padding: '4px 8px', fontSize: 11 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDrawerChamado(r);
                            }}
                            title="Inspecionar chamado"
                          >
                            <Eye size={12} /> Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Bar ── */}
          {dadosFiltrados.length > 0 && (
            <div className="chamados-pagination-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>Linhas por página:</span>
                <select
                  value={itensPorPagina}
                  onChange={(e) => setItensPorPagina(Number(e.target.value))}
                  style={{ height: 26, padding: '0 20px 0 6px', fontSize: 11.5 }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span style={{ marginLeft: 8 }}>
                  Mostrando {(pagina - 1) * itensPorPagina + 1}–
                  {Math.min(pagina * itensPorPagina, dadosFiltrados.length)} de {dadosFiltrados.length}
                </span>
              </div>

              <div className="pagination-controls">
                <button
                  onClick={() => setPagina(1)}
                  disabled={pagina === 1}
                  className="pagination-btn"
                  title="Primeira página"
                >
                  <ChevronsLeft size={13} />
                </button>
                <button
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="pagination-btn"
                  title="Página anterior"
                >
                  <ChevronLeft size={13} />
                </button>

                <span style={{ padding: '0 8px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  Página {pagina} de {totalPaginas}
                </span>

                <button
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  className="pagination-btn"
                  title="Próxima página"
                >
                  <ChevronRight size={13} />
                </button>
                <button
                  onClick={() => setPagina(totalPaginas)}
                  disabled={pagina === totalPaginas}
                  className="pagination-btn"
                  title="Última página"
                >
                  <ChevronsRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Slide-Over Detail Inspector ── */}
      <AnimatePresence>
        {drawerChamado && (
          <ChamadoDrawer
            chamado={drawerChamado}
            onClose={() => setDrawerChamado(null)}
            onNavigateNext={() => navegarDrawer(1)}
            onNavigatePrev={() => navegarDrawer(-1)}
            onChamadoUpdated={(updated) => {
              setDrawerChamado(updated);
              setDados((prev) =>
                prev.map((d) => (d.ticket === updated.ticket ? { ...d, ...updated } : d))
              );
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Modal de Importação ── */}
      {modalImportacaoAberta && (
        <ModalImportacaoChamados
          onClose={() => setModalImportacaoAberta(false)}
          onSucesso={() => {
            setModalImportacaoAberta(false);
            carregar();
          }}
        />
      )}
    </div>
  );
}
