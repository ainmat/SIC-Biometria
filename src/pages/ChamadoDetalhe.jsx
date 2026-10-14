import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { fmtDate } from '@/lib/utils';
import { COR_SEC } from '@/lib/constants';
import {
  ArrowLeft, Copy, Check, Building2, Wrench, ScanFace,
  Clock, UserCheck, HelpCircle, AlertTriangle, ExternalLink, Calendar, User
} from 'lucide-react';

function isDivergente(chamado) {
  if (!chamado) return false;
  const auvo = chamado.status_auvo || chamado.status;
  const asana = chamado.status_asana;
  return Boolean(auvo && asana && auvo !== asana);
}

function getMotivoIcon(motivo) {
  switch (motivo) {
    case 'EQUIPAMENTO':
      return <Wrench size={13} className="text-rose-500 shrink-0" />;
    case 'RECONHECIMENTO':
      return <ScanFace size={13} className="text-emerald-500 shrink-0" />;
    case 'ESPELHO DE PONTO':
      return <Clock size={13} className="text-amber-500 shrink-0" />;
    case 'CADASTRO':
      return <UserCheck size={13} className="text-teal-500 shrink-0" />;
    default:
      return <HelpCircle size={13} className="text-slate-400 shrink-0" />;
  }
}

import ChamadoAtividades from '@/components/chamados/ChamadoAtividades';

export default function ChamadoDetalhe() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [chamado, setChamado] = useState(state?.chamado);
  const [copiado, setCopiado] = useState(false);
  const [copiadoTexto, setCopiadoTexto] = useState(false);

  if (!chamado) {
    return (
      <div>
        <div className="topbar">
          <div className="topbar-left">
            <h1>Detalhe do Chamado</h1>
          </div>
        </div>
        <div className="content">
          <div className="chamados-empty-state" style={{ background: 'var(--surface)', border: '1px solid var(--border-c)', borderRadius: 14 }}>
            <div className="chamados-empty-icon">
              <HelpCircle size={24} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              Nenhum chamado selecionado
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-c)', marginBottom: 16 }}>
              Selecione um chamado na listagem para inspecionar os detalhes técnicos.
            </div>
            <button
              onClick={() => navigate('/todos-chamados')}
              className="pagination-btn"
              style={{ background: '#0D7C3D', color: '#fff', border: 'none', padding: '8px 16px', fontWeight: 600 }}
            >
              Ir para Central de Chamados
            </button>
          </div>
        </div>
      </div>
    );
  }

  const stAuvo = chamado.status_auvo || chamado.status || 'Aguardando Atendimento';
  const stAsana = chamado.status_asana;
  const divergente = isDivergente(chamado);
  const corSec = COR_SEC[chamado.secretaria] || '#64748b';

  const copiarTicket = () => {
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
• Descrição: ${chamado.problema || 'Sem descrição'}`;
    navigator.clipboard.writeText(resumo);
    setCopiadoTexto(true);
    setTimeout(() => setCopiadoTexto(false), 2200);
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => navigate(-1)}
            className="pagination-btn"
            style={{ padding: '6px 10px', fontSize: 12 }}
            title="Voltar"
          >
            <ArrowLeft size={13} /> Voltar
          </button>
          <div>
            <h1>Chamado #{chamado.ticket}</h1>
            <p>Visualização operacional detalhada</p>
          </div>
        </div>

        <div className="topbar-right">
          <button onClick={copiarResumo} className="pagination-btn" style={{ padding: '7px 12px', fontSize: 12 }}>
            {copiadoTexto ? (
              <>
                <Check size={13} className="text-emerald-500" /> Resumo Copiado!
              </>
            ) : (
              <>
                <Copy size={13} /> Copiar Resumo
              </>
            )}
          </button>
        </div>
      </div>

      <div className="content">
        <div style={{ maxWidth: 840, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Header Card */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-c)',
              borderRadius: 14,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="ticket-pill" style={{ fontSize: 16, padding: '6px 12px' }}>
                #{chamado.ticket}
                <button onClick={copiarTicket} className="ticket-copy-btn" style={{ opacity: 1, marginLeft: 4 }} title="Copiar número">
                  {copiado ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
              </span>

              <span className={`status-chip ${stAuvo === 'Atendimento Encerrado' ? 'status-chip-encerrado' : 'status-chip-aberto'}`} style={{ fontSize: 12, padding: '4px 10px' }}>
                <span className="status-dot-pulse" />
                {stAuvo}
              </span>

              {divergente && (
                <span className="divergence-pill" style={{ fontSize: 11, padding: '3px 8px' }}>
                  <AlertTriangle size={12} /> Descompasso Auvo/Asana
                </span>
              )}
            </div>

            <div style={{ fontSize: 12, color: 'var(--sub)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={13} /> Aberto em {fmtDate(chamado.data_abertura)}
            </div>
          </div>

          {/* Divergence Notice */}
          {divergente && (
            <div
              style={{
                background: 'rgba(234, 179, 8, 0.08)',
                border: '1px solid rgba(234, 179, 8, 0.3)',
                borderRadius: 12,
                padding: '14px 18px',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={18} className="text-amber-500 shrink-0" style={{ marginTop: 2 }} />
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)' }}>
                <strong style={{ color: '#D97706', display: 'block', marginBottom: 2 }}>
                  Divergência de Sincronização Detectada
                </strong>
                No <strong>Auvo</strong> consta como <span style={{ textDecoration: 'underline' }}>{stAuvo}</span>, enquanto no <strong>Asana</strong> está registrado como <span style={{ textDecoration: 'underline' }}>{stAsana}</span>{chamado.secao_asana ? ` (${chamado.secao_asana})` : ''}.
              </div>
            </div>
          )}

          {/* Grid de Metadados */}
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border-c)',
              borderRadius: 14,
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div>
              <div className="drawer-section-title">
                <Building2 size={13} /> Unidade e Secretaria
              </div>
              <div
                style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border-c)',
                  borderRadius: 10,
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
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
                    Secretaria municipal responsável
                  </span>
                </div>
              </div>
            </div>

            <div>
              <div className="drawer-section-title">
                <Wrench size={13} /> Dados do Incidente
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
                  <div className="drawer-key">Responsável Técnico</div>
                  <div className="drawer-val">
                    {chamado.responsavel || 'Não atribuído'}
                  </div>
                </div>

                <div className="drawer-key-val-card">
                  <div className="drawer-key">Status Auvo</div>
                  <div className="drawer-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: stAuvo === 'Atendimento Encerrado' ? '#10B981' : '#F59E0B' }} />
                    {stAuvo}
                  </div>
                </div>

                <div className="drawer-key-val-card">
                  <div className="drawer-key">Status Asana</div>
                  <div className="drawer-val" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: stAsana === 'Atendimento Encerrado' ? '#10B981' : stAsana ? '#F59E0B' : '#94A3B8' }} />
                    {stAsana || 'Não integrado'}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="drawer-section-title">
                Descrição do Problema Relatado
              </div>
              <div className="drawer-description-box" style={{ fontSize: 13.5, padding: '16px' }}>
                {chamado.problema || 'Nenhuma descrição detalhada informada.'}
              </div>
            </div>

            {/* Todas as atividades e Comentários */}
            <ChamadoAtividades
              chamado={chamado}
              onChamadoUpdated={(updated) => setChamado(updated)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
