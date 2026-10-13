import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchChamados } from '@/lib/supabase';
import { fmtDate, contarPor } from '@/lib/utils';
import { COR_SEC } from '@/lib/constants';
import { Upload } from 'lucide-react';
import ModalImportacaoChamados from '@/components/ModalImportacaoChamados';
import { motion } from 'motion/react';

const FILTROS_SEC = ['Todos', 'Saúde', 'Educação', 'Outros'];
const FILTROS_MOT = ['Todos', 'EQUIPAMENTO', 'RECONHECIMENTO', 'ESPELHO DE PONTO', 'CADASTRO'];
const FILTROS_ST = ['Todos', 'Aguardando Atendimento', 'Atendimento Encerrado'];
const FILTROS_FONTE = ['Todos', 'Com Divergência (Auvo ≠ Asana)', 'Apenas AUVO', 'Apenas ASANA'];

function aplicarFiltros(dados, { secretaria, motivo, status, fonte, ticket, unidade }) {
  let r = dados;
  if (secretaria !== 'Todos') {
    if (secretaria === 'Saúde') r = r.filter((d) => d.secretaria === 'SS');
    else if (secretaria === 'Educação') r = r.filter((d) => d.secretaria === 'SED');
    else if (secretaria === 'Outros') r = r.filter((d) => d.secretaria !== 'SS' && d.secretaria !== 'SED');
    else r = r.filter((d) => d.secretaria === secretaria);
  }
  if (motivo !== 'Todos') r = r.filter((d) => d.motivo === motivo);
  if (status !== 'Todos') r = r.filter((d) => (d.status_auvo || d.status || 'Aguardando Atendimento') === status);
  if (fonte !== 'Todos') {
    if (fonte === 'Com Divergência (Auvo ≠ Asana)') {
      r = r.filter((d) => {
        const stAuvo = d.status_auvo || d.status;
        const stAsana = d.status_asana;
        return stAuvo && stAsana && stAuvo !== stAsana;
      });
    } else if (fonte === 'Apenas AUVO') {
      r = r.filter((d) => (d.status_auvo || d.status) && !d.status_asana);
    } else if (fonte === 'Apenas ASANA') {
      r = r.filter((d) => d.status_asana && !d.status_auvo);
    }
  }
  if (ticket) r = r.filter((d) => d.ticket.toString().includes(ticket));
  if (unidade) r = r.filter((d) => d.unidade?.toLowerCase().includes(unidade.toLowerCase()));
  return r;
}

function ChamadoModal({ chamado, onClose }) {
  const navigate = useNavigate();
  if (!chamado) return null;
  const stAuvo = chamado.status_auvo || chamado.status || '—';
  const stAsana = chamado.status_asana ? `${chamado.status_asana}${chamado.secao_asana ? ` (${chamado.secao_asana})` : ''}` : '—';
  const temDivergencia = chamado.status_auvo && chamado.status_asana && chamado.status_auvo !== chamado.status_asana;

  return (
    <div className="modal-overlay show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chamado-modal" role="dialog" aria-modal="true">
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Detalhes do Chamado #{chamado.ticket}</div>
          <button className="chamado-modal-close" onClick={onClose}>×</button>
        </div>

        {temDivergencia && (
          <div style={{ background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: 8, padding: '10px 14px', margin: '0 24px 16px', fontSize: 12, color: '#ca8a04', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <span><strong>Divergência detectada:</strong> No Auvo está como <strong>{chamado.status_auvo}</strong>, enquanto no Asana está como <strong>{chamado.status_asana}</strong>.</span>
          </div>
        )}

        <div className="chamado-modal-grid">
          {[
            ['Ticket', `#${chamado.ticket}`],
            ['Status AUVO', stAuvo],
            ['Status ASANA', stAsana],
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
            style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(13,124,61,.12)', border: '1px solid rgba(13,124,61,.25)', color: '#15A050', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
          >
            Ver página completa →
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TodosChamados() {
  const [dados, setDados] = useState([]);
  const [status, setStatus] = useState('Carregando...');
  const [modal, setModal] = useState(null);
  const [modalImportacaoAberta, setModalImportacaoAberta] = useState(false);
  const [filtros, setFiltros] = useState({
    secretaria: 'Todos',
    motivo: 'Todos',
    status: 'Todos',
    fonte: 'Todos',
    ticket: '',
    unidade: '',
  });

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
      .channel('todos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chamados' }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [carregar]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const arr = aplicarFiltros(dados, filtros);

  const setF = (key, value) => setFiltros((prev) => ({ ...prev, [key]: value }));

  const FilterGroup = ({ label, filterKey, options }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span className="filter-label">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          className={`filter-btn${filtros[filterKey] === o ? ' on' : ''}`}
          onClick={() => setF(filterKey, o)}
        >
          {o}
        </button>
      ))}
    </div>
  );

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Todos os Chamados</h1>
          <p>{status}</p>
        </div>
        <div className="topbar-right">
          <button 
            onClick={() => setModalImportacaoAberta(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#0D7C3D', color: '#fff', border: 'none', 
              padding: '6px 12px', borderRadius: 8, fontSize: 13, 
              fontWeight: 600, cursor: 'pointer'
            }}
          >
            <Upload size={14} /> Importar
          </button>

          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* Filtros empilhados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <FilterGroup label="Origem / Visão" filterKey="fonte" options={FILTROS_FONTE} />
          <FilterGroup label="Secretaria" filterKey="secretaria" options={FILTROS_SEC} />
          <FilterGroup label="Motivo" filterKey="motivo" options={FILTROS_MOT} />
          <FilterGroup label="Status AUVO" filterKey="status" options={FILTROS_ST} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="Buscar por ticket..."
              value={filtros.ticket}
              onChange={(e) => setF('ticket', e.target.value)}
              style={{ width: 160 }}
            />
            <input
              type="text"
              placeholder="Buscar por unidade..."
              value={filtros.unidade}
              onChange={(e) => setF('unidade', e.target.value)}
              style={{ width: 200 }}
            />
          </div>
        </div>

        <div className="table-card" style={{ overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'right' }}>Ticket</th>
                <th>Unidade</th>
                <th style={{ textAlign: 'center' }}>Secretaria</th>
                <th style={{ textAlign: 'center' }}>Motivo</th>
                <th style={{ textAlign: 'center' }}>Abertura</th>
                <th style={{ textAlign: 'center' }}>Status AUVO</th>
                <th style={{ textAlign: 'center' }}>Status ASANA</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {arr.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-c)' }}>
                    Nenhum chamado encontrado para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                arr.map((r, i) => {
                  const stAuvo = r.status_auvo || r.status || 'Aguardando Atendimento';
                  const stAsana = r.status_asana;
                  const cor = COR_SEC[r.secretaria] || '#64748b';
                  const temDivergencia = r.status_auvo && r.status_asana && r.status_auvo !== r.status_asana;

                  return (
                    <motion.tr
                      key={r.ticket}
                      className="clickable-row"
                      onClick={() => setModal(r)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.2 }}
                      style={temDivergencia ? { background: 'rgba(234, 179, 8, 0.03)' } : undefined}
                    >
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: '#15A050', fontSize: 11 }}>
                        #{r.ticket}
                        {temDivergencia && <span title="Divergência entre Auvo e Asana" style={{ marginLeft: 4 }}>⚠️</span>}
                      </td>
                      <td style={{ color: 'var(--text)', fontWeight: 500, fontSize: 11 }}>{r.unidade || 'N/A'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${cor}20`, color: cor, fontWeight: 500 }}>
                          {r.secretaria}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 11 }}>{r.motivo}</td>
                      <td style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{fmtDate(r.data_abertura)}</td>
                      
                      {/* Status AUVO */}
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${stAuvo === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto'}`} style={{ fontSize: 9 }}>
                          {stAuvo}
                        </span>
                      </td>

                      {/* Status ASANA */}
                      <td style={{ textAlign: 'center' }}>
                        {stAsana ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <span className={`badge ${stAsana === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto'}`} style={{ fontSize: 9 }}>
                              {stAsana}
                            </span>
                            {r.secao_asana && (
                              <span style={{ fontSize: 8, color: 'var(--muted-c)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.secao_asana}>
                                {r.secao_asana}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--muted-c)' }}>—</span>
                        )}
                      </td>

                      <td style={{ fontSize: 11, color: 'var(--sub)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.problema || '—'}
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ChamadoModal chamado={modal} onClose={() => setModal(null)} />
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
