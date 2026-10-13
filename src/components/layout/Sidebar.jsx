import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  RefreshCw, Download, ChevronRight, ChevronLeft,
  PanelLeftClose, PanelLeftOpen, Menu
} from 'lucide-react';
import logoDarh from '../../../img/logo-darh.png';
import { useAuth } from '@/contexts/AuthContext';

const NAV = [
  {
    section: 'Equipamentos e Chamados',
    items: [
      {
        to: '/',
        label: 'Dashboard',
        end: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        to: '/parque-equipamentos',
        label: 'Equipamentos',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="20" height="8" rx="2" />
            <rect x="2" y="14" width="20" height="8" rx="2" />
            <line x1="6" y1="6" x2="6.01" y2="6" />
            <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
        ),
      },
      {
        to: '/mapa-equipamentos',
        label: 'Mapa',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        ),
      },
      {
        to: '/todos-chamados',
        label: 'Chamados',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect x="9" y="3" width="6" height="4" rx="1" />
          </svg>
        ),
      },
      {
        to: '/unidades-multiplos-chamados',
        label: 'Unidades Críticas',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        to: '/analise-tendencias',
        label: 'Tendências',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Ponto Biométrico',
    items: [
      {
        to: '/previas/simulador',
        label: 'Simulador',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <polygon points="10 8 16 12 10 16 10 8" />
          </svg>
        ),
      },
      {
        to: '/previas/historico',
        label: 'Histórico',
        apoioAllowed: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 8v4l3 3" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        ),
      },
      {
        to: '/previas/bi',
        label: 'BI / Indicadores',
        apoioAllowed: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Folha de Pagamento',
    items: [
      {
        to: '/folha/importar',
        label: 'Importar Folha',
        adminOnly: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        ),
      },
      {
        to: '/folha/dashboard',
        label: 'Painel',
        apoioAllowed: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        to: '/folha/simulador',
        label: 'Simulador Folha',
        apoioAllowed: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
        ),
      },
      {
        to: '/folha/comparativo',
        label: 'Comparativo',
        apoioAllowed: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <line x1="2" y1="20" x2="22" y2="20" />
            <rect x="3" y="13" width="3" height="7" rx="0.5" />
            <rect x="7" y="9"  width="3" height="11" rx="0.5" />
            <rect x="14" y="11" width="3" height="9" rx="0.5" />
            <rect x="18" y="5"  width="3" height="15" rx="0.5" />
          </svg>
        ),
      },
      {
        to: '/folha/conferencia',
        label: 'Conferência Ponto',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        ),
      },
      {
        to: '/folha/mapa',
        label: 'Mapa de Descontos',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Servidores',
    items: [
      {
        to: '/servidores/painel',
        label: 'Painel',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        to: '/servidores/diretorio',
        label: 'Diretório',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        ),
      },
      {
        to: '/admin/servidores/importar',
        label: 'Importar Servidores',
        adminOnly: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        ),
      },
      {
        to: '/servidores/sentinel',
        label: 'Jornadas',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <circle cx="12" cy="11" r="3" />
            <line x1="12" y1="14" x2="12" y2="17" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Protocolo Digital',
    items: [
      {
        to: '/protocolos/painel',
        label: 'Painel',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        to: '/protocolos/consulta',
        label: 'Consulta',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        ),
      },
      {
        to: '/protocolos/novo',
        label: 'Novo Protocolo',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Monitoramento TV',
    items: [
      {
        to: '/monitoramento-tv',
        label: 'Painel TV (NOC)',
        apoioAllowed: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
            <polyline points="17 2 12 7 7 2" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Sistema',
    items: [
      {
        to: '/admin/usuarios',
        label: 'Usuários',
        adminOnly: true,
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
    ],
  },
];

/* ─── NavItem ─────────────────────────────────────────────────────────────── */

function NavItem({ to, label, icon, end, collapsed }) {
  return (
    <NavLink
      to={to}
      end={end ?? false}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'group flex items-center rounded-md cursor-pointer transition-all duration-150 select-none no-underline relative',
          collapsed ? 'justify-center px-0 py-2 w-10 mx-auto' : 'gap-2.5 px-2.5 py-1.5 w-full',
          isActive
            ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-semibold'
            : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/5 hover:text-foreground/90',
        ].join(' ')
      }
      style={{ color: 'inherit' }}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="navItemIndicator"
              className="absolute left-0 w-[3px] h-[18px] bg-emerald-500 rounded-r-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            />
          )}
          <span
            className="shrink-0 transition-colors"
            style={{
              width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isActive ? 'inherit' : 'var(--muted-c)',
            }}
          >
            {icon}
          </span>
          {!collapsed && (
            <span style={{ fontSize: 13, letterSpacing: '0.01em', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

/* ─── NavSection ─────────────────────────────────────────────────────────── */

function NavSection({ section, items, isAdmin, isMaster, isApoio, collapsed }) {
  const location = useLocation();
  const visibleItems = items.filter(({ adminOnly, masterOnly, apoioAllowed }) => {
    if (masterOnly && !isMaster) return false;
    if (adminOnly  && !isAdmin)  return false;
    if (isApoio && !apoioAllowed) return false;
    return true;
  });
  if (!visibleItems.length) return null;

  const hasActive = visibleItems.some(item => {
    if (item.end) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  });

  const [open, setOpen] = useState(hasActive);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center" style={{ gap: 4 }}>
        <div style={{ width: 24, height: 1, background: 'var(--border-c)', opacity: 0.7, margin: '6px 0 2px' }} />
        {visibleItems.map(item => (
          <NavItem
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            end={item.end}
            collapsed={true}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Section heading */}
      <button
        onClick={() => setOpen(o => !o)}
        className="group flex items-center justify-between px-2 mb-0.5 cursor-pointer select-none border-none bg-transparent w-full text-left"
        style={{ paddingTop: 4, paddingBottom: 4 }}
      >
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted-c)',
          opacity: 0.65,
        }}>
          {section}
        </span>
        <ChevronRight
          size={12}
          style={{
            color: 'var(--muted-c)',
            opacity: 0.4,
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Animated items container */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="flex flex-col" style={{ gap: 1, paddingBottom: 4 }}>
              {visibleItems.map(item => (
                <NavItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  end={item.end}
                  collapsed={false}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Sidebar Principal ─────────────────────────────────────────────────── */

export default function Sidebar() {
  const { isAdmin, isMaster, isApoio } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sic_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Atualiza a variável CSS global --sidebar-w e persiste o estado
  useEffect(() => {
    const width = collapsed ? '68px' : '228px';
    document.documentElement.style.setProperty('--sidebar-w', width);
    try {
      localStorage.setItem('sic_sidebar_collapsed', String(collapsed));
    } catch (e) {
      console.warn(e);
    }
  }, [collapsed]);

  const toggleCollapsed = () => setCollapsed(prev => !prev);

  return (
    <aside
      className="sidebar"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: collapsed ? 68 : 228,
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >
      {/* ── Header / Logo & Botão Retrátil ── */}
      <div
        className="logo"
        style={{
          flexShrink: 0,
          padding: collapsed ? '16px 12px' : '18px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 10
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <img
            src={logoDarh}
            alt="DARH Osasco"
            style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }}
          />
          {!collapsed && (
            <div className="logo-text" style={{ color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              SIC · Biometria
            </div>
          )}
        </div>

        {/* Botão de Recolher / Expandir */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expandir menu lateral (Ctrl + B)" : "Recolher menu lateral"}
          style={{
            background: 'rgba(0,0,0,0.03)',
            border: '1px solid var(--border-c)',
            borderRadius: 6,
            padding: 5,
            cursor: 'pointer',
            color: 'var(--muted-c)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            flexShrink: 0
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(13,124,61,0.1)';
            e.currentTarget.style.color = '#0D7C3D';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
            e.currentTarget.style.color = 'var(--muted-c)';
          }}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* ── Scrollable nav ── */}
      <nav
        className="nav"
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: collapsed ? '12px 6px' : '14px 10px',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: collapsed ? 10 : 8,
        }}
      >
        <div className="flex flex-col mb-4" style={{ gap: collapsed ? 8 : 20 }}>
          {NAV.map(section => (
            <NavSection
              key={section.section}
              section={section.section}
              items={section.items}
              isAdmin={isAdmin}
              isMaster={isMaster}
              isApoio={isApoio}
              collapsed={collapsed}
            />
          ))}
        </div>
      </nav>

      {/* ── Footer ── */}
      <div
        className="sidebar-footer"
        style={{
          flexShrink: 0,
          padding: collapsed ? '12px 8px' : '12px 16px 16px',
        }}
      >
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => window.location.reload()}
              title="Atualizar Sistema"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.04)', border: '1px solid rgba(0, 0, 0, 0.06)',
                color: 'var(--text)', cursor: 'pointer', transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
            >
              <RefreshCw size={15} />
            </button>
            <button
              onClick={() => window.print()}
              title="Exportar Tela (Imprimir / PDF)"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: 8,
                background: '#0D7C3D', border: 'none',
                color: '#fff', cursor: 'pointer', transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Download size={15} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '9px 12px', borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.04)', border: '1px solid rgba(0, 0, 0, 0.06)',
                color: 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                width: '100%', transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.04)'}
            >
              <RefreshCw size={14} /> Atualizar Sistema
            </button>
            <button
              onClick={() => window.print()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '9px 12px', borderRadius: 8,
                background: '#0D7C3D', border: 'none',
                color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                width: '100%', transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Download size={14} /> Exportar Tela
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
