import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';

/**
 * Dropdown moderno para seleção múltipla com pesquisa, contadores e ações rápidas.
 */
export function MultiSelectDropdown({
  values = [],
  onChange,
  options = [],
  placeholder = 'Todos',
  searchPlaceholder = 'Buscar...',
  minWidth = 160,
  maxWidth,
  counts = {},
  pluralNoun = 'selecionados',
  feminine = false
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

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

  // Fecha no ESC
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  // Normaliza as opções (podem ser strings ou objetos { value, label, color })
  const normalizedOptions = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt, color: null };
      }
      return {
        value: opt.value,
        label: opt.label || opt.value,
        color: opt.color || opt.dotColor || null
      };
    });
  }, [options]);

  // Filtragem pela busca
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return normalizedOptions;
    const term = search.toLowerCase();
    return normalizedOptions.filter(o => o.label.toLowerCase().includes(term));
  }, [normalizedOptions, search]);

  // Alterna uma opção
  const toggleOption = (val) => {
    if (values.includes(val)) {
      onChange(values.filter(v => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  // Selecionar todos os visíveis
  const handleSelectAllVisible = () => {
    const visibleValues = filteredOptions.map(o => o.value);
    const newSet = new Set([...values, ...visibleValues]);
    onChange(Array.from(newSet));
  };

  // Desmarcar todos
  const handleClearAll = (e) => {
    if (e) e.stopPropagation();
    onChange([]);
  };

  // Rótulo exibido no botão
  const renderLabel = () => {
    if (!values || values.length === 0) {
      return <span style={{ color: 'var(--muted-c)' }}>{placeholder}</span>;
    }
    if (values.length === 1) {
      const found = normalizedOptions.find(o => o.value === values[0]);
      return (
        <span style={{ color: 'var(--text)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {found?.label || values[0]}
        </span>
      );
    }
    const suffix = feminine ? 'selecionadas' : pluralNoun;
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
        <span style={{
          background: '#0D7C3D',
          color: '#ffffff',
          fontSize: 10,
          fontWeight: 700,
          borderRadius: 10,
          padding: '1px 6px',
          lineHeight: '14px'
        }}>
          {values.length}
        </span>
        <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {values.length} {suffix}
        </span>
      </span>
    );
  };

  const hasSelection = values && values.length > 0;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        minWidth: minWidth,
        maxWidth: maxWidth || 'none'
      }}
    >
      {/* Botão Gatilho */}
      <button
        type="button"
        onClick={() => {
          setOpen(prev => !prev);
          if (!open) setSearch('');
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 8,
          background: hasSelection ? 'rgba(13, 124, 61, 0.05)' : 'var(--card-bg, #ffffff)',
          border: hasSelection ? '1.5px solid #0D7C3D' : '1px solid var(--border-c, rgba(0, 0, 0, 0.1))',
          color: 'var(--text)',
          fontSize: 12,
          cursor: 'pointer',
          outline: 'none',
          transition: 'all 0.15s ease',
          boxShadow: open ? '0 0 0 2px rgba(13, 124, 61, 0.2)' : 'none',
          textAlign: 'left'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          {renderLabel()}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {hasSelection && (
            <span
              onClick={handleClearAll}
              title="Limpar seleção"
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
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'; e.currentTarget.style.color = '#dc2626'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.08)'; e.currentTarget.style.color = 'var(--muted-c)'; }}
            >
              <X size={10} />
            </span>
          )}
          <ChevronDown
            size={13}
            color="var(--muted-c)"
            style={{
              transition: 'transform 0.2s ease',
              transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
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
            minWidth: Math.max(minWidth, 240),
            maxWidth: 340,
            background: 'var(--surface, #ffffff)',
            border: '1px solid var(--border-c, rgba(0, 0, 0, 0.12))',
            borderRadius: 10,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {/* Caixa de busca se tiver mais de 5 opções */}
          {normalizedOptions.length > 5 && (
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-c, rgba(0, 0, 0, 0.06))' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--card-bg, #f8fafc)',
                  border: '1px solid var(--border-c, rgba(0, 0, 0, 0.08))',
                  borderRadius: 6,
                  padding: '4px 8px'
                }}
              >
                <Search size={13} color="var(--muted-c)" />
                <input
                  ref={inputRef}
                  type="text"
                  autoFocus
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text)',
                    fontSize: 12,
                    width: '100%'
                  }}
                />
                {search && (
                  <span
                    onClick={() => setSearch('')}
                    style={{ cursor: 'pointer', color: 'var(--muted-c)', display: 'flex' }}
                  >
                    <X size={12} />
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Barra de Ações Rápidas */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 10px',
              fontSize: 11,
              background: 'rgba(0, 0, 0, 0.02)',
              borderBottom: '1px solid var(--border-c, rgba(0, 0, 0, 0.06))',
              color: 'var(--muted-c)'
            }}
          >
            <span>
              {values.length} de {normalizedOptions.length} {feminine ? 'selecionadas' : 'selecionados'}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={handleSelectAllVisible}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontSize: 11,
                  color: '#0D7C3D',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                Marcar todos
              </button>
              {values.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    fontSize: 11,
                    color: '#dc2626',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Limpar
                </button>
              )}
            </div>
          </div>

          {/* Lista de Opções */}
          <div
            style={{
              maxHeight: 260,
              overflowY: 'auto',
              padding: '4px 0'
            }}
          >
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted-c)', textAlign: 'center' }}>
                Nenhum resultado encontrado
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = values.includes(opt.value);
                const count = counts[opt.value];

                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '7px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      background: isSelected ? 'rgba(13, 124, 61, 0.08)' : 'transparent',
                      color: isSelected ? '#0D7C3D' : 'var(--text)',
                      fontWeight: isSelected ? 600 : 400,
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)';
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                      {/* Checkbox customizado */}
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 4,
                          border: isSelected ? '1.5px solid #0D7C3D' : '1.5px solid var(--border-c, rgba(0, 0, 0, 0.2))',
                          background: isSelected ? '#0D7C3D' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s'
                        }}
                      >
                        {isSelected && <Check size={11} color="#ffffff" strokeWidth={3} />}
                      </div>

                      {/* Dot de cor opcional (para Status, Prioridade) */}
                      {opt.color && (
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: opt.color,
                            flexShrink: 0
                          }}
                        />
                      )}

                      {/* Rótulo */}
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {opt.label}
                      </span>
                    </div>

                    {/* Badge numérica opcional */}
                    {typeof count === 'number' && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: isSelected ? 'rgba(13, 124, 61, 0.15)' : 'rgba(0, 0, 0, 0.05)',
                          color: isSelected ? '#0D7C3D' : 'var(--muted-c)',
                          flexShrink: 0
                        }}
                      >
                        {count}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default MultiSelectDropdown;
