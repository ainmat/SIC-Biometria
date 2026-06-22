import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

export function SearchSelect({ value, onChange, options, placeholder = 'Todas', disabled, label, minWidth = 140 }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() =>
    options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  );

  const selectedLabel = options.find(o => o.value === value)?.label || placeholder;

  return (
    <div ref={ref} style={{ position: 'relative', minWidth }}>
      {label && <div className="filter-label" style={{ marginBottom: 5 }}>{label}</div>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(o => !o); setSearch(''); } }}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.1)',
          borderRadius: 6, padding: '6px 10px', cursor: disabled ? 'not-allowed' : 'pointer',
          color: value ? '#f1f5f9' : '#64748b', fontSize: 13,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <ChevronDown size={12} color="#64748b" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          background: '#1e293b', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8,
          minWidth: '100%', maxHeight: 280, display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,.6)',
        }}>
          <div style={{ padding: '6px 6px 4px' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              style={{
                width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
                borderRadius: 5, padding: '5px 8px', color: '#f1f5f9', fontSize: 12, outline: 'none',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div
              onClick={() => { onChange(''); setOpen(false); }}
              style={{
                padding: '7px 12px', cursor: 'pointer', fontSize: 12,
                color: !value ? '#a5b4fc' : '#94a3b8',
                background: !value ? 'rgba(99,102,241,.12)' : 'transparent',
              }}
              onMouseEnter={e => { if (value) e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
              onMouseLeave={e => { if (value) e.currentTarget.style.background = 'transparent'; }}
            >
              {placeholder}
            </div>
            {filtered.map(o => (
              <div
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                style={{
                  padding: '7px 12px', cursor: 'pointer', fontSize: 12,
                  color: value === o.value ? '#a5b4fc' : '#f1f5f9',
                  background: value === o.value ? 'rgba(99,102,241,.12)' : 'transparent',
                }}
                onMouseEnter={e => { if (value !== o.value) e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
                onMouseLeave={e => { if (value !== o.value) e.currentTarget.style.background = 'transparent'; }}
              >
                {o.label}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', color: '#475569', fontSize: 12 }}>Nenhum resultado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
