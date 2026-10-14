import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, X, Clock, Check } from 'lucide-react';

const PRESETS = [
  { id: 'todos', label: 'Todo o Período' },
  { id: '7d', label: 'Últimos 7 dias' },
  { id: '30d', label: 'Últimos 30 dias' },
  { id: '90d', label: 'Últimos 90 dias' },
  { id: 'este_mes', label: 'Este mês' },
  { id: 'mes_anterior', label: 'Mês anterior' },
  { id: 'custom', label: 'Personalizado (De / Até)' },
];

export function DateRangeFilterDropdown({
  filtroData,
  onChange,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // filtroData tem a forma: { preset: 'todos'|'7d'|'30d'|'90d'|'este_mes'|'mes_anterior'|'custom', dataInicio: '', dataFim: '' }
  const [dataInicioLocal, setDataInicioLocal] = useState(filtroData?.dataInicio || '');
  const [dataFimLocal, setDataFimLocal] = useState(filtroData?.dataFim || '');

  useEffect(() => {
    setDataInicioLocal(filtroData?.dataInicio || '');
    setDataFimLocal(filtroData?.dataFim || '');
  }, [filtroData]);

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // Aplica um preset
  const handleSelectPreset = (presetId) => {
    if (presetId === 'todos') {
      onChange({ preset: 'todos', dataInicio: '', dataFim: '' });
      setOpen(false);
      return;
    }

    if (presetId === 'custom') {
      onChange({
        preset: 'custom',
        dataInicio: dataInicioLocal,
        dataFim: dataFimLocal,
      });
      return;
    }

    const hoje = new Date();
    let inicio = new Date();
    let fim = new Date();

    if (presetId === '7d') {
      inicio.setDate(hoje.getDate() - 7);
    } else if (presetId === '30d') {
      inicio.setDate(hoje.getDate() - 30);
    } else if (presetId === '90d') {
      inicio.setDate(hoje.getDate() - 90);
    } else if (presetId === 'este_mes') {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    } else if (presetId === 'mes_anterior') {
      inicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    }

    const fmt = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    onChange({
      preset: presetId,
      dataInicio: fmt(inicio),
      dataFim: fmt(fim),
    });
    setOpen(false);
  };

  const handleApplyCustom = (e) => {
    e.preventDefault();
    onChange({
      preset: 'custom',
      dataInicio: dataInicioLocal,
      dataFim: dataFimLocal,
    });
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ preset: 'todos', dataInicio: '', dataFim: '' });
    setDataInicioLocal('');
    setDataFimLocal('');
  };

  const hasFilter = filtroData && filtroData.preset !== 'todos';

  // Rótulo exibido no botão
  const renderLabel = () => {
    if (!hasFilter) {
      return (
        <span style={{ color: 'var(--muted-c)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={13} /> Data de Abertura: Todas
        </span>
      );
    }

    const presetObj = PRESETS.find((p) => p.id === filtroData.preset);
    if (filtroData.preset !== 'custom' && presetObj) {
      return (
        <span style={{ color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={13} color="#0D7C3D" /> {presetObj.label}
        </span>
      );
    }

    // Custom format
    const fmtBR = (iso) => {
      if (!iso) return '';
      const [y, m, d] = iso.split('-');
      return `${d}/${m}`;
    };

    const texto = `${fmtBR(filtroData.dataInicio)} até ${fmtBR(filtroData.dataFim)}`;
    return (
      <span style={{ color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Calendar size={13} color="#0D7C3D" /> {texto || 'Personalizado'}
      </span>
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Botão Gatilho */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          height: 30,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '0 10px',
          borderRadius: 6,
          boxSizing: 'border-box',
          background: hasFilter ? 'rgba(13, 124, 61, 0.06)' : 'var(--card-bg, #ffffff)',
          border: hasFilter ? '1.5px solid #0D7C3D' : '1px solid var(--border-c, rgba(0, 0, 0, 0.1))',
          color: 'var(--text)',
          fontSize: 11.5,
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease',
          boxShadow: open ? '0 0 0 2px rgba(13, 124, 61, 0.2)' : 'none',
          whiteSpace: 'nowrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {renderLabel()}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {hasFilter && (
            <span
              onClick={handleClear}
              title="Limpar filtro de data"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 16,
                height: 16,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.08)',
                color: 'var(--muted-c)',
                cursor: 'pointer',
              }}
            >
              <X size={10} />
            </span>
          )}
          <ChevronDown
            size={13}
            color="var(--muted-c)"
            style={{
              transition: 'transform 0.2s ease',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>

      {/* Popover Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 1050,
            width: 290,
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--border-c, rgba(0, 0, 0, 0.12))',
            borderRadius: 10,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Cabeçalho */}
          <div
            style={{
              padding: '9px 12px',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--muted-c)',
              borderBottom: '1px solid var(--border-c, rgba(0, 0, 0, 0.06))',
              background: 'rgba(0,0,0,0.02)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Clock size={12} /> Período de Abertura
          </div>

          {/* Lista de Presets */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '6px' }}>
            {PRESETS.filter((p) => p.id !== 'custom').map((p) => {
              const active = filtroData?.preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: active ? 'rgba(13, 124, 61, 0.08)' : 'transparent',
                    color: active ? '#0D7C3D' : 'var(--text)',
                    fontWeight: active ? 600 : 400,
                    fontSize: 12,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <span>{p.label}</span>
                  {active && <Check size={13} color="#0D7C3D" />}
                </button>
              );
            })}
          </div>

          {/* Divisor */}
          <div style={{ height: 1, background: 'var(--border-c, rgba(0, 0, 0, 0.06))' }} />

          {/* Faixa Personalizada (De / Até) */}
          <form onSubmit={handleApplyCustom} style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-c)' }}>Intervalo Específico:</span>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 10, color: 'var(--muted-c)', display: 'block', marginBottom: 2 }}>De:</label>
                <input
                  type="date"
                  value={dataInicioLocal}
                  onChange={(e) => setDataInicioLocal(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 6px',
                    borderRadius: 6,
                    border: '1px solid var(--border-c, rgba(0,0,0,0.12))',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text)',
                    fontSize: 11,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 10, color: 'var(--muted-c)', display: 'block', marginBottom: 2 }}>Até:</label>
                <input
                  type="date"
                  value={dataFimLocal}
                  onChange={(e) => setDataFimLocal(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '5px 6px',
                    borderRadius: 6,
                    border: '1px solid var(--border-c, rgba(0,0,0,0.12))',
                    background: 'var(--card-bg, #ffffff)',
                    color: 'var(--text)',
                    fontSize: 11,
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button
                type="submit"
                disabled={!dataInicioLocal && !dataFimLocal}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: !dataInicioLocal && !dataFimLocal ? '#94a3b8' : '#0D7C3D',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: !dataInicioLocal && !dataFimLocal ? 'not-allowed' : 'pointer',
                }}
              >
                Aplicar Intervalo
              </button>

              {hasFilter && (
                <button
                  type="button"
                  onClick={handleClear}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: 'transparent',
                    border: '1px solid var(--border-c, rgba(0,0,0,0.12))',
                    color: 'var(--text)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  Limpar
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
