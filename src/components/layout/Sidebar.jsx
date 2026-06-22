import { NavLink, useNavigate } from 'react-router-dom';
import { RefreshCw, Download, LogOut } from 'lucide-react';
import logoDarh from '../../../img/logo-darh.png';
import { IconBar, IconBarItem } from '@/components/ui/icon-bar';
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
    section: 'Folha Processada',
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
    section: 'Sistema',
    items: [
      {
        to: '/admin/usuarios',
        label: 'Usuários',
        masterOnly: true,
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

export default function Sidebar() {
  const { isAdmin, isMaster, sessao, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <aside className="sidebar">
      <div className="logo">
        <img
          src={logoDarh}
          alt="DARH Osasco"
          style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0 }}
        />
        <div className="logo-text">SIC · Biometria</div>
      </div>

      <nav className="nav">
        {NAV.map(({ section, items }) => {
          const visibleItems = items.filter(({ adminOnly, masterOnly }) => {
            if (masterOnly && !isMaster) return false;
            if (adminOnly  && !isAdmin)  return false;
            return true;
          });
          if (!visibleItems.length) return null;
          return (
            <div key={section}>
              <div className="nav-section">{section}</div>
              {visibleItems.map(({ to, label, icon, end, adminOnly, masterOnly }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end ?? false}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                >
                  {icon}
                  {label}
                </NavLink>
              ))}
            </div>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 10, padding: '6px 10px', borderRadius: 8,
          background: isMaster ? 'rgba(245,158,11,.08)' : isAdmin ? 'rgba(59,130,246,.08)' : 'rgba(16,185,129,.08)',
          border: `1px solid ${isMaster ? 'rgba(245,158,11,.2)' : isAdmin ? 'rgba(59,130,246,.2)' : 'rgba(16,185,129,.2)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
              background: isMaster ? '#f59e0b' : isAdmin ? '#3b82f6' : '#10b981',
            }} />
            <div style={{ minWidth: 0 }}>
              {sessao?.nome && sessao.role !== 'visitor' && (
                <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sessao.nome}
                </div>
              )}
              <span style={{ fontSize: 10, fontWeight: 600, color: isMaster ? '#fbbf24' : isAdmin ? '#60a5fa' : '#34d399' }}>
                {isMaster ? 'Master' : isAdmin ? 'Administrador' : 'Visitante'}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sair"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 3,
              color: '#475569', display: 'flex', alignItems: 'center',
              borderRadius: 4, transition: 'color .15s',
            }}
            onMouseOver={e => { e.currentTarget.style.color = '#f87171'; }}
            onMouseOut={e => { e.currentTarget.style.color = '#475569'; }}
          >
            <LogOut size={13} />
          </button>
        </div>

        <div className="status-pill" style={{ marginBottom: 12 }}>
          <div className="status-dot" />
          Realtime ativo
        </div>
        <IconBar>
          <IconBarItem icon={RefreshCw} label="Atualizar" onClick={() => window.location.reload()} />
          <IconBarItem icon={Download}  label="Exportar PDF" onClick={() => window.print()} />
        </IconBar>
      </div>
    </aside>
  );
}
