import TopbarAvatar from '@/components/layout/TopbarAvatar';
import { useState, useEffect, useCallback } from 'react';
import { supabase, fetchEquipamentos } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

function moduloBadge(modulo) {
  const n = Number(modulo);
  if (isNaN(n)) return { bg: 'rgba(100,116,139,.12)', color: '#94a3b8', border: 'rgba(100,116,139,.2)', label: '—' };
  const blue = n < 17;
  return blue
    ? { bg: 'rgba(59,130,246,.12)', color: '#60a5fa', border: 'rgba(59,130,246,.25)', label: String(n) }
    : { bg: 'rgba(239,68,68,.12)', color: '#f87171', border: 'rgba(239,68,68,.25)', label: String(n) };
}

function fabricanteBadge(fabricante) {
  const f = (fabricante || '').trim();
  if (/tomm?i/i.test(f))
    return { bg: 'rgba(59,130,246,.12)', color: '#60a5fa', border: 'rgba(59,130,246,.25)', label: f };
  if (/control\s*id/i.test(f))
    return { bg: 'rgba(239,68,68,.12)', color: '#f87171', border: 'rgba(239,68,68,.25)', label: f };
  return { bg: 'rgba(100,116,139,.12)', color: '#94a3b8', border: 'rgba(100,116,139,.2)', label: f || '—' };
}

function Badge({ style: { bg, color, border, label } }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 3,
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '.06em',
      textTransform: 'uppercase',
      background: bg,
      color,
      border: `1px solid ${border}`,
    }}>
      {label}
    </span>
  );
}

export default function ParqueEquipamentos() {
  const { isVisitor } = useAuth();
  const [dados, setDados] = useState([]);
  const [busca, setBusca] = useState('');
  const [fabricanteFilter, setFabricanteFilter] = useState('Todos');
  const [status, setStatus] = useState('Carregando...');

  const carregar = useCallback(async () => {
    try {
      const data = await fetchEquipamentos();
      setDados(data);
      setStatus(
        `Atualizado em ${new Date().toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'long', year: 'numeric',
        })} · ${data.length} equipamentos`
      );
    } catch (err) {
      console.error(err);
      setStatus('Erro ao carregar equipamentos');
    }
  }, []);

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel('equipamentos-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipamentos' }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [carregar]);

  const filtrado = dados.filter((eq) => {
    const q = busca.toLowerCase();
    const matchBusca = !busca || [
      String(eq.codigo), eq.nome, eq.ip_equipamento, eq.secretaria, eq.fabricante, String(eq.modulo),
    ].some((v) => v?.toLowerCase().includes(q));
    const matchFab =
      fabricanteFilter === 'Todos' ||
      (fabricanteFilter === 'Tommi'      && /tomm?i/i.test(eq.fabricante || '')) ||
      (fabricanteFilter === 'Control ID' && /control\s*id/i.test(eq.fabricante || ''));
    return matchBusca && matchFab;
  });

  const tommiCount     = dados.filter((e) => /tomm?i/i.test(e.fabricante || '')).length;
  const controlIdCount = dados.filter((e) => /control\s*id/i.test(e.fabricante || '')).length;

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Parque de Equipamentos</h1>
          <p>{status}</p>
        </div>
        <div className="topbar-right">
          <div className="badge-live"><div className="status-dot" />AO VIVO</div>
          <TopbarAvatar />
        </div>
      </div>

      <div className="content">
        {/* KPIs */}
        <div className="kpi-grid" style={{ marginBottom: 24 }}>
          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: '#3b82f6' }} />
            <div className="kpi-label">Total</div>
            <div className="kpi-value" style={{ color: '#60a5fa' }}>{dados.length}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: '#3b82f6' }} />
            <div className="kpi-label">Tommi</div>
            <div className="kpi-value" style={{ color: '#60a5fa' }}>{tommiCount}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-accent" style={{ background: '#ef4444' }} />
            <div className="kpi-label">Control ID</div>
            <div className="kpi-value" style={{ color: '#f87171' }}>{controlIdCount}</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="filters" style={{ marginBottom: 16, gap: 8 }}>
          <span className="filter-label">Fabricante</span>
          {['Todos', 'Tommi', 'Control ID'].map((f) => (
            <button
              key={f}
              className={`filter-btn${fabricanteFilter === f ? ' on' : ''}`}
              onClick={() => setFabricanteFilter(f)}
            >
              {f}
            </button>
          ))}
          <input
            type="text"
            placeholder="Buscar por código, nome, IP..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ marginLeft: 8, width: 220 }}
          />
        </div>

        {/* Tabela */}
        <div className="table-card" style={{ overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: 'right', width: 64 }}>Código</th>
                <th>Nome do Equipamento</th>
                <th>IP do Equipamento</th>
                <th style={{ textAlign: 'center' }}>Secretaria</th>
                <th style={{ textAlign: 'center' }}>Módulo</th>
                <th style={{ textAlign: 'center' }}>Fabricante</th>
              </tr>
            </thead>
            <tbody>
              {filtrado.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-c)' }}>
                    Nenhum equipamento encontrado.
                  </td>
                </tr>
              ) : (
                filtrado.map((eq) => (
                  <tr key={eq.id}>
                    <td style={{
                      textAlign: 'right',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 600,
                      color: '#60a5fa',
                      fontSize: 11,
                    }}>
                      {eq.codigo}
                    </td>
                    <td style={{ color: '#f1f5f9', fontWeight: 500, fontSize: 11 }}>
                      {eq.nome || '—'}
                    </td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: isVisitor ? '#374151' : '#94a3b8' }}>
                      {isVisitor ? '••••••••' : (eq.ip_equipamento || '—')}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 11 }}>
                      {eq.secretaria || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge style={moduloBadge(eq.modulo)} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <Badge style={fabricanteBadge(eq.fabricante)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
