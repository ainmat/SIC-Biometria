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
          background: 'var(--surface)', border: '1px solid #334155',
          borderRadius: 6, padding: '6px 10px', cursor: disabled ? 'not-allowed' : 'pointer',
          color: value ? '#1e293b' : '#64748b', fontSize: 13,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLabel}</span>
        <ChevronDown size={12} color="#64748b" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 100,
          background: 'var(--surface)', border: '1px solid #334155', borderRadius: 8,
          minWidth: '100%', maxHeight: 280, display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,.08)',
        }}>
          <div style={{ padding: '6px 6px 4px' }}>
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              style={{
                width: '100%', background: 'var(--bg)', border: '1px solid #334155',
                borderRadius: 5, padding: '5px 8px', color: 'var(--text)', fontSize: 12, outline: 'none',
              }}
            />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div
              onClick={() => { onChange(''); setOpen(false); }}
              style={{
                padding: '7px 12px', cursor: 'pointer', fontSize: 12,
                color: !value ? '#15A050' : '#64748b',
                background: !value ? 'rgba(13,124,61,.08)' : 'transparent',
              }}
              onMouseEnter={e => { if (value) e.currentTarget.style.background = 'rgba(0,0,0,.04)'; }}
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
                  color: value === o.value ? '#15A050' : '#1e293b',
                  background: value === o.value ? 'rgba(13,124,61,.08)' : 'transparent',
                }}
                onMouseEnter={e => { if (value !== o.value) e.currentTarget.style.background = 'rgba(0,0,0,.04)'; }}
                onMouseLeave={e => { if (value !== o.value) e.currentTarget.style.background = 'transparent'; }}
              >
                {o.label}
              </div>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', color: 'var(--muted-c)', fontSize: 12 }}>Nenhum resultado</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
