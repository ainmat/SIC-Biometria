import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { RefreshCw, Download, ChevronRight } from 'lucide-react';
import logoDarh from '../../../img/logo-darh.png';
import { IconBar, IconBarItem } from '@/components/ui/icon-bar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';


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
    ],
  },
  {
    section: 'Análise do Quadro',
    items: [
      {
        to: '/servidores/aposentadoria',
        label: 'Aposentadoria',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ),
      },
      {
        to: '/servidores/comissionados',
        label: 'Comissionados',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
            <line x1="7" y1="8" x2="17" y2="8" />
            <line x1="7" y1="12" x2="13" y2="12" />
          </svg>
        ),
      },
      {
        to: '/servidores/escolaridade',
        label: 'Escolaridade',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
            <path d="M6 12v5c3 3 9 3 12 0v-5" />
          </svg>
        ),
      },
      {
        to: '/servidores/perfil',
        label: 'Perfil do Quadro',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="4" />
            <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        ),
      },
      {
        to: '/servidores/saude',
        label: 'Saúde do Quadro',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Planejamento',
    items: [
      {
        to: '/servidores/simulador',
        label: 'Simulador',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <line x1="6" y1="8" x2="6" y2="12" />
            <line x1="10" y1="10" x2="10" y2="12" />
            <line x1="14" y1="7" x2="14" y2="12" />
            <line x1="18" y1="9" x2="18" y2="12" />
          </svg>
        ),
      },
      {
        to: '/servidores/auditoria',
        label: 'Auditoria',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
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

function NavItem({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end ?? false}
      className={({ isActive }) =>
        [
          'group flex items-center gap-2.5 px-2.5 rounded-md cursor-pointer transition-all duration-150 select-none no-underline',
          isActive
            ? 'bg-black/[0.06] dark:bg-white/10 text-foreground font-semibold'
            : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/5 hover:text-foreground/90',
        ].join(' ')
      }
      style={{ paddingTop: 7, paddingBottom: 7, color: 'inherit' }}
    >
      {({ isActive }) => (
        <>
          <span
            className="shrink-0 transition-colors"
            style={{
              width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isActive ? 'var(--text)' : 'var(--muted-c)',
            }}
          >
            {icon}
          </span>
          <span style={{ fontSize: 13, letterSpacing: '0.01em', lineHeight: 1 }}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

/* ─── NavSection (collapsible) ────────────────────────────────────────────── */

function NavSection({ section, items, isAdmin, isMaster }) {
  const location = useLocation();
  const visibleItems = items.filter(({ adminOnly, masterOnly }) => {
    if (masterOnly && !isMaster) return false;
    if (adminOnly  && !isAdmin)  return false;
    return true;
  });
  if (!visibleItems.length) return null;

  // Auto-open if a child is active
  const hasActive = visibleItems.some(item => {
    if (item.end) return location.pathname === item.to;
    return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  });

  const [open, setOpen] = useState(hasActive);

  return (
    <div className="flex flex-col">
      {/* Section heading — clickable to collapse */}
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
      <div
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          opacity: open ? 1 : 0,
          transition: 'grid-template-rows 250ms ease, opacity 200ms ease',
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          <div className="flex flex-col" style={{ gap: 1, paddingBottom: 4 }}>
            {visibleItems.map(item => (
              <NavItem
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                end={item.end}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Layout/Sidebar ──────────────────────────────────────────────────────── */

export default function Sidebar() {
  const { sessao, isAdmin, isMaster, logout } = useAuth();
  const [modalSenha, setModalSenha] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
    window.dispatchEvent(new Event('themechange'));
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  const roleColor  = isMaster ? '#f59e0b' : isAdmin ? '#0D7C3D' : '#10b981';
  const roleLabel  = isMaster ? 'Master'  : isAdmin ? 'Administrador' : 'Visitante';
  const roleBg     = isMaster ? 'rgba(245,158,11,.08)' : isAdmin ? 'rgba(13,124,61,.08)' : 'rgba(16,185,129,.08)';
  const roleBorder = isMaster ? 'rgba(245,158,11,.2)'  : isAdmin ? 'rgba(13,124,61,.2)'  : 'rgba(16,185,129,.2)';

  return (
    <>
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Logo ── */}
        <div className="logo" style={{ flexShrink: 0 }}>
          <img
            src={logoDarh}
            alt="DARH Osasco"
            style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
          />
          <div className="logo-text" style={{ color: 'var(--text)' }}>SIC · Biometria</div>
        </div>

        {/* ── Scrollable nav ── */}
        <nav
          className="nav"
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: 2,
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {NAV.map(({ section, items }) => (
            <NavSection
              key={section}
              section={section}
              items={items}
              isAdmin={isAdmin}
              isMaster={isMaster}
            />
          ))}
        </nav>

        {/* ── Footer ── */}
        <div className="sidebar-footer" style={{ flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={() => window.location.reload()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 14px', borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.04)', border: '1px solid rgba(0, 0, 0, 0.06)',
                color: 'var(--text)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
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
                padding: '10px 14px', borderRadius: 8,
                background: '#0D7C3D', border: 'none',
                color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                width: '100%', transition: 'opacity 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Download size={14} /> Exportar Tela
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─── Tiny helper ─────────────────────────────────────────────────────────── */
function ActionBtn({ title, onClick, hoverColor = '#15A050', children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? (hoverColor + '15') : 'none',
        border: 'none', cursor: 'pointer', padding: 4,
        color: hov ? hoverColor : 'var(--muted-c)',
        display: 'flex', alignItems: 'center',
        borderRadius: 5, transition: 'color .15s, background .15s',
      }}
    >
      {children}
    </button>
  );
}
