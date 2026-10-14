import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Clock,
  Layers,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SyncStatusBadge() {
  const [syncData, setSyncData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [timeAgo, setTimeAgo] = useState('');
  const popoverRef = useRef(null);

  // Função para carregar metadados da última sincronização
  const carregarSyncStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .eq('chave', 'ultima_sincronizacao_asana')
        .maybeSingle();

      if (error) throw error;
      if (data && data.valor) {
        try {
          const parsed = JSON.parse(data.valor);
          setSyncData(parsed);
        } catch {
          setSyncData(null);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar status de sincronização:', err);
    } finally {
      setLoading(false);
    }
  };

  // Carregar inicial + escutar realtime no Supabase
  useEffect(() => {
    carregarSyncStatus();

    // Inscrever em atualizações em tempo real na tabela configuracoes
    const channel = supabase
      .channel('sync-status-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'configuracoes' },
        (payload) => {
          if (payload.new && payload.new.chave === 'ultima_sincronizacao_asana') {
            try {
              setSyncData(JSON.parse(payload.new.valor));
            } catch (e) {
              console.warn(e);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Calcular tempo relativo a cada 30 segundos
  useEffect(() => {
    const calcularTempo = () => {
      if (!syncData?.timestamp) {
        setTimeAgo('Sem registro');
        return;
      }
      const diffMs = Date.now() - new Date(syncData.timestamp).getTime();
      const diffMin = Math.floor(diffMs / 60000);

      if (diffMin < 1) {
        setTimeAgo('Agora mesmo');
      } else if (diffMin < 60) {
        setTimeAgo(`há ${diffMin} min`);
      } else {
        const diffHoras = Math.floor(diffMin / 60);
        if (diffHoras < 24) {
          setTimeAgo(`há ${diffHoras}h ${diffMin % 60}m`);
        } else {
          const diffDias = Math.floor(diffHoras / 24);
          setTimeAgo(`há ${diffDias}d`);
        }
      }
    };

    calcularTempo();
    const interval = setInterval(calcularTempo, 30000);
    return () => clearInterval(interval);
  }, [syncData]);

  // Fechar popover ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setPopoverOpen(false);
      }
    };
    if (popoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [popoverOpen]);

  // Avaliação de saúde da automação
  const diffMin = syncData?.timestamp
    ? Math.floor((Date.now() - new Date(syncData.timestamp).getTime()) / 60000)
    : 999;

  const agora = new Date();
  const horaAtual = agora.getHours();
  const diaSemana = agora.getDay(); // 1 a 5 é dia útil
  const isHorarioComercial = diaSemana >= 1 && diaSemana <= 5 && horaAtual >= 7 && horaAtual <= 20;

  let estado = 'sucesso'; // 'sucesso' | 'atrasado' | 'erro'
  if (syncData?.status === 'erro') {
    estado = 'erro';
  } else if (isHorarioComercial && diffMin > 50) {
    estado = 'atrasado';
  }

  const cores = {
    sucesso: {
      dot: '#10b981',
      bg: 'rgba(16, 185, 129, 0.08)',
      border: 'rgba(16, 185, 129, 0.22)',
      text: '#047857',
      label: 'Asana Sincronizado',
    },
    atrasado: {
      dot: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.1)',
      border: 'rgba(245, 158, 11, 0.28)',
      text: '#b45309',
      label: 'Sincronização Atrasada',
    },
    erro: {
      dot: '#ef4444',
      bg: 'rgba(239, 68, 68, 0.1)',
      border: 'rgba(239, 68, 68, 0.3)',
      text: '#b91c1c',
      label: 'Falha na Sincronização',
    },
  };

  const estiloAtual = cores[estado];

  const formatarDataCompleta = (iso) => {
    if (!iso) return 'N/A';
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      {/* Botão Chip Compacto do Header */}
      <button
        onClick={() => setPopoverOpen((prev) => !prev)}
        title="Clique para ver detalhes da sincronização Asana"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '6px 11px',
          borderRadius: 20,
          background: estiloAtual.bg,
          border: `1px solid ${estiloAtual.border}`,
          color: 'var(--text)',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          transition: 'all 0.2s ease',
          boxShadow: popoverOpen ? '0 0 0 3px rgba(13, 124, 61, 0.15)' : 'none',
        }}
      >
        {/* Indicador Luminoso com Pulso */}
        <span style={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
          {estado === 'sucesso' && (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                backgroundColor: estiloAtual.dot,
                opacity: 0.6,
                animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
              }}
            />
          )}
          <span
            style={{
              position: 'relative',
              borderRadius: '50%',
              width: 8,
              height: 8,
              backgroundColor: estiloAtual.dot,
            }}
          />
        </span>

        {/* Texto do Chip */}
        <span style={{ color: estiloAtual.text, display: 'flex', alignItems: 'center', gap: 4 }}>
          {loading ? (
            <RefreshCw size={12} className="animate-spin" />
          ) : (
            <>
              <span>Asana:</span>
              <span style={{ fontWeight: 500, opacity: 0.9 }}>{timeAgo}</span>
            </>
          )}
        </span>
      </button>

      {/* Popover Detalhado de Diagnóstico */}
      <AnimatePresence>
        {popoverOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 320,
              zIndex: 1000,
              background: 'var(--card-bg, #ffffff)',
              borderRadius: 14,
              border: '1px solid var(--border, rgba(0,0,0,0.08))',
              boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.18), 0 4px 10px rgba(0, 0, 0, 0.06)',
              padding: '16px',
              color: 'var(--text, #1e293b)',
            }}
          >
            {/* Cabeçalho do Popover */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {estado === 'sucesso' && <CheckCircle2 size={16} color="#10b981" />}
                {estado === 'atrasado' && <AlertTriangle size={16} color="#f59e0b" />}
                {estado === 'erro' && <XCircle size={16} color="#ef4444" />}
                <span style={{ fontSize: 13, fontWeight: 700 }}>Status da Sincronização</span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 7px',
                  borderRadius: 6,
                  background: estiloAtual.bg,
                  color: estiloAtual.text,
                }}
              >
                {estado === 'sucesso' ? 'Em dia' : estado === 'atrasado' ? 'Atrasado' : 'Erro'}
              </span>
            </div>

            {/* Lista de Métricas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: 8 }}>
                <span style={{ color: 'var(--muted-c)' }}>Última execução:</span>
                <span style={{ fontWeight: 600 }}>{formatarDataCompleta(syncData?.timestamp)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: 8 }}>
                <span style={{ color: 'var(--muted-c)' }}>Novos importados:</span>
                <span style={{ fontWeight: 600, color: '#10b981' }}>
                  {syncData?.novos_inseridos ?? 0} chamados
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: 8 }}>
                <span style={{ color: 'var(--muted-c)' }}>Status atualizados:</span>
                <span style={{ fontWeight: 600, color: '#3b82f6' }}>
                  {syncData?.status_atualizados ?? 0} chamados
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 8px', background: 'rgba(0,0,0,0.02)', borderRadius: 8 }}>
                <span style={{ color: 'var(--muted-c)' }}>Duração da rodada:</span>
                <span style={{ fontWeight: 600 }}>{syncData?.duracao_segundos ? `${syncData.duracao_segundos}s` : 'N/A'}</span>
              </div>

              {syncData?.mensagem_erro && (
                <div style={{ padding: 8, background: 'rgba(239, 68, 68, 0.08)', borderRadius: 8, color: '#b91c1c', fontSize: 11 }}>
                  <strong>Detalhes do erro:</strong> {syncData.mensagem_erro}
                </div>
              )}
            </div>

            {/* Divisor */}
            <div style={{ height: 1, background: 'var(--border, rgba(0,0,0,0.06))', margin: '14px 0 10px' }} />

            {/* Ações e Links */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <a
                href="https://github.com/ainmat/SIC-Biometria/actions/workflows/sync-asana.yml"
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: '#0D7C3D',
                  color: '#ffffff',
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <RefreshCw size={13} /> Sincronizar Agora no GitHub <ExternalLink size={12} />
              </a>

              <button
                onClick={() => {
                  setLoading(true);
                  carregarSyncStatus();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  padding: '7px 10px',
                  borderRadius: 8,
                  background: 'transparent',
                  border: '1px solid var(--border, rgba(0,0,0,0.1))',
                  color: 'var(--text)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={11} /> Atualizar status do indicador
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
