import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { RefreshCw, Download, LogOut, KeyRound } from 'lucide-react';
import logoDarh from '../../../img/logo-darh.png';
import { IconBar, IconBarItem } from '@/components/ui/icon-bar';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const inputSt = {
  width: '100%', background: 'rgba(255,255,255,.06)',
  border: '1px solid rgba(255,255,255,.1)', borderRadius: 7,
  padding: '9px 12px', color: '#f1f5f9', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};
const labelSt = {
  display: 'block', fontSize: 11, color: '#64748b', fontWeight: 600,
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em',
};

function ModalAlterarSenha({ onClose }) {
  const { sessao } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha,  setNovaSenha]  = useState('');
  const [confirmar,  setConfirmar]  = useState('');
  const [erro,       setErro]       = useState('');
  const [sucesso,    setSucesso]    = useState(false);
  const [loading,    setLoading]    = useState(false);

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    if (!senhaAtual)                     { setErro('Informe sua senha atual'); return; }
    if (!novaSenha)                      { setErro('Informe a nova senha'); return; }
    if (novaSenha.length < 6)            { setErro('Nova senha: mínimo 6 caracteres'); return; }
    if (novaSenha !== confirmar)         { setErro('As senhas não coincidem'); return; }
    if (novaSenha === senhaAtual)        { setErro('A nova senha deve ser diferente da atual'); return; }
    setLoading(true);
    try {
      const { data: auth, error: authErr } = await supabase.rpc('login_usuario', {
        p_username: sessao.username, p_senha: senhaAtual,
      });
      if (authErr) throw authErr;
      if (!auth || auth.length === 0) { setErro('Senha atual incorreta'); setLoading(false); return; }
      const { error: resetErr } = await supabase.rpc('resetar_senha_usuario', {
        p_username: sessao.username, p_senha_nova: novaSenha,
      });
      if (resetErr) throw resetErr;
      setSucesso(true);
    } catch (e) {
      setErro(e.message || 'Erro ao alterar senha');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 420 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Alterar Senha</div>
          <button className="chamado-modal-close" onClick={onClose}>×</button>
        </div>
        {sucesso ? (
          <div style={{ padding: '28px 24px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px', background: 'rgba(16,185,129,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" style={{ width: 24, height: 24 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f1f5f9', marginBottom: 6 }}>Senha alterada com sucesso</div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 24 }}>Use a nova senha no próximo acesso.</div>
            <button onClick={onClose} style={{ padding: '9px 24px', borderRadius: 7, background: 'rgba(99,102,241,.85)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={salvar} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'rgba(99,102,241,.07)', border: '1px solid rgba(99,102,241,.18)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Usuário</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#a5b4fc', fontFamily: 'monospace' }}>{sessao?.username}</div>
              </div>
            </div>
            <div>
              <label style={labelSt}>Senha atual</label>
              <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} placeholder="Digite sua senha atual" style={inputSt} autoFocus />
            </div>
            <div>
              <label style={labelSt}>Nova senha</label>
              <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo 6 caracteres" style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Confirmar nova senha</label>
              <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="Repita a nova senha" style={inputSt} />
            </div>
            {erro && (
              <div style={{ fontSize: 12, color: '#f87171', padding: '8px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 6 }}>{erro}</div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 7, background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button type="submit" disabled={loading} style={{ padding: '9px 20px', borderRadius: 7, background: 'rgba(99,102,241,.85)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
                {loading ? 'Salvando...' : 'Alterar senha'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

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

export default function Sidebar() {
  const { isAdmin, isMaster, sessao, logout } = useAuth();
  const navigate = useNavigate();
  const [modalSenha, setModalSenha] = useState(false);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <>
    <aside className="sidebar">
      <div className="logo">
        <img
          src={logoDarh}
          alt="DARH Osasco"
          style={{ width: 36, height: 36, objectFit: 'contain', flexShrink: 0, filter: 'brightness(1.15) contrast(1.1) drop-shadow(0 0 4px rgba(255,255,255,.15))' }}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              onClick={() => setModalSenha(true)}
              title="Alterar senha"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: 3,
                color: '#475569', display: 'flex', alignItems: 'center',
                borderRadius: 4, transition: 'color .15s',
              }}
              onMouseOver={e => { e.currentTarget.style.color = '#a5b4fc'; }}
              onMouseOut={e => { e.currentTarget.style.color = '#475569'; }}
            >
              <KeyRound size={13} />
            </button>
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

    {modalSenha && <ModalAlterarSenha onClose={() => setModalSenha(false)} />}
  </>
  );
}
