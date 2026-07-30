import { RefreshCw, Download } from 'lucide-react';

export default function TopbarAvatar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button
        onClick={() => window.location.reload()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: 'rgba(0, 0, 0, 0.04)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
      >
        <RefreshCw size={14} /> Atualizar
      </button>
      <button
        onClick={() => window.print()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, background: '#0D7C3D', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
      >
        <Download size={14} /> Exportar
      </button>
      <div className="avatar" />
    </div>
  );
}
