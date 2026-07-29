import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, fetchChamados } from '@/lib/supabase';
import { fmtDate, contarPor } from '@/lib/utils';
import { COR_SEC } from '@/lib/constants';

const FILTROS_SEC = ['Todos', 'Saúde', 'Educação', 'Outros'];
const FILTROS_MOT = ['Todos', 'EQUIPAMENTO', 'RECONHECIMENTO', 'ESPELHO DE PONTO', 'CADASTRO'];
const FILTROS_ST = ['Todos', 'Aguardando Atendimento', 'Atendimento Encerrado'];

function aplicarFiltros(dados, { secretaria, motivo, status, ticket, unidade }) {
  let r = dados;
  if (secretaria !== 'Todos') {
    if (secretaria === 'Saúde') r = r.filter((d) => d.secretaria === 'SS');
    else if (secretaria === 'Educação') r = r.filter((d) => d.secretaria === 'SED');
    else if (secretaria === 'Outros') r = r.filter((d) => d.secretaria !== 'SS' && d.secretaria !== 'SED');
    else r = r.filter((d) => d.secretaria === secretaria);
  }
  if (motivo !== 'Todos') r = r.filter((d) => d.motivo === motivo);
  if (status !== 'Todos') r = r.filter((d) => (d.status || 'Aguardando Atendimento') === status);
  if (ticket) r = r.filter((d) => d.ticket.toString().includes(ticket));
  if (unidade) r = r.filter((d) => d.unidade?.toLowerCase().includes(unidade.toLowerCase()));
  return r;
}

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
  const [filtros, setFiltros] = useState({
    secretaria: 'Todos',
    motivo: 'Todos',
    status: 'Todos',
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
          <div className="badge-live"><div className="status-dot" />AO VIVO</div>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* Filtros empilhados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          <FilterGroup label="Secretaria" filterKey="secretaria" options={FILTROS_SEC} />
          <FilterGroup label="Motivo" filterKey="motivo" options={FILTROS_MOT} />
          <FilterGroup label="Status" filterKey="status" options={FILTROS_ST} />
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
                <th style={{ textAlign: 'center' }}>Status</th>
                <th>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {arr.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-c)' }}>
                    Nenhum chamado encontrado para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                arr.map((r) => {
                  const st = r.status || 'Aguardando Atendimento';
                  const cor = COR_SEC[r.secretaria] || '#64748b';
                  return (
                    <tr key={r.ticket} className="clickable-row" onClick={() => setModal(r)}>
                      <td style={{ textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: '#15A050', fontSize: 11 }}>
                        #{r.ticket}
                      </td>
                      <td style={{ color: 'var(--text)', fontWeight: 500, fontSize: 11 }}>{r.unidade || 'N/A'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: `${cor}20`, color: cor, fontWeight: 500 }}>
                          {r.secretaria}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 11 }}>{r.motivo}</td>
                      <td style={{ textAlign: 'center', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{fmtDate(r.data_abertura)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${st === 'Atendimento Encerrado' ? 'status-encerrado' : 'status-aberto'}`} style={{ fontSize: 9 }}>
                          {st}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--sub)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.problema || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ChamadoModal chamado={modal} onClose={() => setModal(null)} />
    </div>
  );
}
