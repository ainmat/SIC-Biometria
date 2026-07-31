import { useState, useEffect } from 'react';
import { RefreshCw, Download, Moon, Sun, KeyRound, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ModalAlterarSenha from './ModalAlterarSenha';

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

  const roleLabels = { master: 'Master', admin: 'Administrador', visitor: 'Visitante' };
  const roleColors = { master: '#f59e0b', admin: '#0D7C3D', visitor: '#64748b' };
  const roleLabel = roleLabels[sessao?.role] || 'Visitante';
  const roleColor = roleColors[sessao?.role] || '#64748b';

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '6px 12px', borderRadius: 12,
          background: 'var(--card-bg)', border: '1px solid rgba(0,0,0,0.04)',
        }}>
          {/* Avatar and Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8,
              background: roleColor + '22',
              border: `1px solid ${roleColor}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontSize: 13, fontWeight: 700, color: roleColor,
            }}>
              {sessao?.nome ? sessao.nome.charAt(0).toUpperCase() : '?'}
            </div>
            <div style={{ minWidth: 0, paddingRight: 8, borderRight: '1px solid rgba(0,0,0,0.06)' }}>
              {sessao?.nome && sessao.role !== 'visitor' && (
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sessao.nome}
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 600, color: roleColor }}>
                {roleLabel}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ActionBtn
              title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}
              onClick={toggleTheme}
              hoverColor="#15A050"
            >
              {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
            </ActionBtn>
            <ActionBtn title="Alterar senha" onClick={() => setModalSenha(true)} hoverColor="#15A050">
              <KeyRound size={15} />
            </ActionBtn>
            <ActionBtn title="Sair" onClick={logout} hoverColor="#dc2626">
              <LogOut size={15} />
            </ActionBtn>
          </div>
        </div>
        <img src="/logo-prefeitura-osasco.png" alt="Prefeitura de Osasco" style={{ height: 40, objectFit: 'contain', marginLeft: 8, flexShrink: 0 }} />
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
