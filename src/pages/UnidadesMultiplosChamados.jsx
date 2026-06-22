import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchChamados } from '@/lib/supabase';
import { fmtDate } from '@/lib/utils';
import { COR_SEC } from '@/lib/constants';

function ChamadoModal({ chamado, onClose }) {
  const navigate = useNavigate();
  if (!chamado) return null;
  const st = chamado.status || 'Aguardando Atendimento';
  return (
    <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chamado-modal" role="dialog" aria-modal="true">
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Detalhes do Chamado</div>
          <button className="chamado-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="chamado-modal-grid">
          {[
            ['Ticket', `#${chamado.ticket}`],
            ['Status', st],
            ['Unidade', chamado.unidade],
            ['Secretaria', chamado.secretaria],
            ['Motivo', chamado.motivo],
            ['Data de Abertura', fmtDate(chamado.data_abertura)],
          ].map(([label, value]) => (
            <div key={label} className="chamado-modal-item">
              <div className="chamado-modal-label">{label}</div>
              <div className="chamado-modal-value">{value || '—'}</div>
            </div>
          ))}
        </div>
        <div className="chamado-modal-item">
          <div className="chamado-modal-label">Descrição</div>
          <div className="chamado-modal-desc">{chamado.problema || '—'}</div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => { onClose(); navigate('/chamado-detalhe', { state: { chamado } }); }}
            style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(59,130,246,.12)', border: '1px solid rgba(59,130,246,.25)', color: '#60a5fa', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            Ver página completa →
          </button>
        </div>
      </div>
    </div>
  );
}

function agruparUnidades(dados) {
  const mapa = {};
  dados.forEach((c) => {
    const unidade = c.unidade || 'Unidade Não Informada';
    if (!mapa[unidade]) mapa[unidade] = [];
    mapa[unidade].push(c);
  });

  return Object.entries(mapa)
    .filter(([, chamados]) => chamados.length > 1)
    .map(([unidade, chamados]) => ({
      unidade,
      chamados: chamados.sort((a, b) => b.ticket - a.ticket),
      totalChamados: chamados.length,
      secretaria: chamados[0].secretaria,
      abertos: chamados.filter((c) => (c.status || 'Aguardando Atendimento') !== 'Atendimento Encerrado').length,
    }))
    .sort((a, b) => {
      const naoId = (u) =>
        u.toUpperCase().includes('NÃO IDENTIFICADO') || u.toUpperCase().includes('UNIDADE NÃO INFORMADA');
      if (naoId(a.unidade) && !naoId(b.unidade)) return 1;
      if (!naoId(a.unidade) && naoId(b.unidade)) return -1;
      return b.totalChamados - a.totalChamados;
    });
}

export default function UnidadesMultiplosChamados() {
  const [dados, setDados] = useState([]);
  const [status, setStatus] = useState('Carregando...');
  const [expandida, setExpandida] = useState(null);
  const [modal, setModal] = useState(null);

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
    const ch = supabase
      .channel('multiplos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados' }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [carregar]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const unidades = agruparUnidades(dados);

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Unidades com Múltiplos Chamados</h1>
          <p>{status}</p>
        </div>
        <div className="topbar-right">
          <div className="badge-live"><div className="status-dot" />AO VIVO</div>
          <div className="avatar">MC</div>
        </div>
      </div>

      <div className="content">
        {/* KPI */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2,1fr)', marginBottom: 24 }}>
          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: '#3b82f6' }} />
            <div className="kpi-label">Unidades com múltiplos chamados</div>
            <div className="kpi-value" style={{ color: '#60a5fa' }}>{unidades.length}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: '#ef4444' }} />
            <div className="kpi-label">Total de chamados nestas unidades</div>
            <div className="kpi-value" style={{ color: '#f87171' }}>
              {unidades.reduce((s, u) => s + u.totalChamados, 0)}
            </div>
          </div>
        </div>

        {/* Lista de unidades */}
        {unidades.length === 0 ? (
          <div className="chart-card" style={{ textAlign: 'center', padding: 40, color: 'var(--muted-c)' }}>
            Nenhuma unidade com múltiplos chamados encontrada.
          </div>
        ) : (
          unidades.map((u) => {
            const cor = COR_SEC[u.secretaria] || '#64748b';
            const isOpen = expandida === u.unidade;
            return (
              <div key={u.unidade} className="chart-card" style={{ marginBottom: 12 }}>
                {/* Header da unidade */}
                <div
                  onClick={() => setExpandida(isOpen ? null : u.unidade)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    cursor: 'pointer', userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{u.unidade}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-c)' }}>
                        {u.secretaria} · {u.totalChamados} chamados · {u.abertos} aberto(s)
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        background: `${cor}20`, color: cor, border: `1px solid ${cor}40`,
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      }}
                    >
                      {u.totalChamados}
                    </span>
                    <svg
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      style={{ width: 16, height: 16, color: 'var(--muted-c)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>

                {/* Chamados expandidos */}
                {isOpen && (
                  <div style={{ marginTop: 16 }}>
                    <table>
                      <thead>
                        <tr>
                          <th style={{ textAlign: 'right' }}>Ticket</th>
                          <th>Motivo</th>
                          <th style={{ textAlign: 'center' }}>Abertura</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                          <th>Descrição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {u.chamados.map((c) => {
                          const st = c.status || 'Aguardando Atendimento';
                          return (
                            <tr key={c.ticket} className="clickable-row" onClick={() => setModal(c)}>
                              <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: '#60a5fa', fontWeight: 600 }}>
                                #{c.ticket}
                              </td>
                              <td style={{ fontSize: 11 }}>{c.motivo}</td>
                              <td style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>
                                {fmtDate(c.data_abertura)}
                              </td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge ${st === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto'}`} style={{ fontSize: 9 }}>
                                  {st}
                                </span>
                              </td>
                              <td style={{ fontSize: 10, color: 'var(--sub)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {c.problema || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <ChamadoModal chamado={modal} onClose={() => setModal(null)} />
    </div>
  );
}
