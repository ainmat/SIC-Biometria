import { useState, useEffect } from 'react';
import { RefreshCw, Download, Moon, Sun, KeyRound, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ModalAlterarSenha from './ModalAlterarSenha';
import SyncStatusBadge from './SyncStatusBadge';

export default function TopbarAvatar() {
  const { sessao, logout } = useAuth();
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

  const roleLabels = { master: 'Master', admin: 'Administrador', apoio: 'Apoio', viewer: 'Visitante', visitor: 'Visitante' };
  const roleColors = { master: '#f59e0b', admin: '#0D7C3D', apoio: '#3b82f6', viewer: '#64748b', visitor: '#64748b' };
  const roleLabel = roleLabels[sessao?.role] || 'Visitante';
  const roleColor = roleColors[sessao?.role] || '#64748b';

  return (
    <>
      <div className="topbar-avatar-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="topbar-sync-badge-wrap">
          <SyncStatusBadge />
        </div>
        <div className="topbar-user-pill" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '6px 12px', borderRadius: 12,
          background: 'var(--card-bg)', border: '1px solid rgba(0,0,0,0.06)',
        }}>
          {/* Avatar and Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: roleColor + '22',
              border: `1px solid ${roleColor}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontSize: 12.5, fontWeight: 700, color: roleColor,
            }}>
              {sessao?.nome ? sessao.nome.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="topbar-user-names" style={{ minWidth: 0, paddingRight: 8, borderRight: '1px solid rgba(0,0,0,0.08)' }}>
              {sessao?.nome && sessao.role !== 'visitor' && (
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sessao.nome}
                </div>
              )}
              <div style={{ fontSize: 10.5, fontWeight: 600, color: roleColor }}>
                {roleLabel}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <ActionBtn
              title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
              onClick={toggleTheme}
              hoverColor="#15A050"
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </ActionBtn>
            <ActionBtn title="Alterar senha" onClick={() => setModalSenha(true)} hoverColor="#15A050">
              <KeyRound size={14} />
            </ActionBtn>
            <ActionBtn title="Sair" onClick={logout} hoverColor="#dc2626">
              <LogOut size={14} />
            </ActionBtn>
          </div>
        </div>
        <img className="topbar-osasco-logo" src="/logo-prefeitura-osasco.png" alt="Prefeitura de Osasco" style={{ height: 36, objectFit: 'contain', marginLeft: 4, flexShrink: 0 }} />
      </div>

      {modalSenha && <ModalAlterarSenha onClose={() => setModalSenha(false)} />}
    </>
  );
}

function ActionBtn({ title, onClick, hoverColor = '#15A050', children }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      title={title} onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 32, height: 32, borderRadius: 8, border: 'none', background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: hov ? hoverColor : 'var(--muted-c)', cursor: 'pointer', transition: '0.2s',
      }}
    >
      {children}
    </button>
  );
}
