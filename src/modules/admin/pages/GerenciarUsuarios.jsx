import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const ROLES_MASTER = [
  { value: 'admin',  label: 'Administrador', desc: 'Pode importar folha e publicar prévias' },
  { value: 'viewer', label: 'Visitante',      desc: 'Somente leitura dos dashboards' },
];
const ROLES_ADMIN = [
  { value: 'viewer', label: 'Visitante',      desc: 'Somente leitura dos dashboards' },
];

const ROLE_LABELS = { master: 'Master', admin: 'Administrador', viewer: 'Visitante' };
const ROLE_COLORS = { master: '#f59e0b', admin: '#0D7C3D', viewer: '#10b981' };

const inputSt = {
  width: '100%', background: 'rgba(0, 0, 0, 0.04)',
  border: '1px solid rgba(0, 0, 0, 0.06)', borderRadius: 7,
  padding: '9px 12px', color: 'var(--text)', fontSize: 13,
  outline: 'none', boxSizing: 'border-box',
};

const labelSt = {
  display: 'block', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600,
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em',
};

function ModalNovoUsuario({ onClose, onSalvo, rolesDisponiveis }) {
  const { sessao } = useAuth();
  const [form, setForm] = useState({ nome: '', username: '', senha: '', role: 'viewer' });
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    if (!form.nome || !form.username || !form.senha) { setErro('Preencha todos os campos'); return; }
    if (form.username.includes(' ')) { setErro('Username não pode ter espaços'); return; }
    setLoading(true); setErro('');
    try {
      const { error } = await supabase.rpc('criar_usuario_rpc', {
        p_token: sessao?.token,
        p_nome: form.nome, p_username: form.username,
        p_senha: form.senha, p_role: form.role,
      });
      if (error) throw error;
      onSalvo();
      onClose();
    } catch (e) {
      setErro(e.message?.includes('unique') ? 'Esse username já existe' : (e.message || 'Erro ao criar usuário'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 460 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Novo Usuário</div>
          <button className="chamado-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={salvar} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelSt}>Nome completo</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Gabriel Souza" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Usuário de login</label>
            <input
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, '.') }))}
              placeholder="Ex: gabriel ou ricardo.folha"
              style={{ ...inputSt, fontFamily: 'monospace' }}
            />
            <div style={{ fontSize: 10, color: 'var(--muted-c)', marginTop: 4 }}>
              Letras minúsculas e pontos. O usuário vai digitar isso na tela de login.
            </div>
          </div>
          <div>
            <label style={labelSt}>Senha inicial</label>
            <input type="password" value={form.senha}
              onChange={e => setForm(f => ({ ...f, senha: e.target.value }))}
              placeholder="Senha que o usuário vai usar" style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Nível de acesso</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rolesDisponiveis.map(r => (
                <label key={r.value} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  cursor: 'pointer', padding: '10px 12px', borderRadius: 8,
                  border: `1px solid ${form.role === r.value ? 'rgba(13,124,61,.4)' : 'rgba(0,0,0,.07)'}`,
                  background: form.role === r.value ? 'rgba(13,124,61,.1)' : 'transparent',
                  transition: 'all .15s',
                }}>
                  <input type="radio" name="role" value={r.value}
                    checked={form.role === r.value}
                    onChange={() => setForm(f => ({ ...f, role: r.value }))}
                    style={{ marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: form.role === r.value ? '#15A050' : '#334155' }}>{r.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 2 }}>{r.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {erro && <div style={{ fontSize: 12, color: '#dc2626', padding: '8px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 6 }}>{erro}</div>}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 7, background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--muted-c)', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} style={{ padding: '9px 20px', borderRadius: 7, background: 'rgba(13,124,61,.85)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Criando...' : 'Criar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalResetSenha({ usuario, onClose, onSalvo }) {
  const { sessao } = useAuth();
  const [senha, setSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    if (!senha) { setErro('Digite a nova senha'); return; }
    if (senha !== confirmar) { setErro('Senhas não coincidem'); return; }
    setLoading(true); setErro('');
    try {
      const { error } = await supabase.rpc('resetar_senha_usuario_rpc', {
        p_token: sessao?.token,
        p_username: usuario.username, p_senha_nova: senha,
      });
      if (error) throw error;
      onSalvo();
      onClose();
    } catch (e) {
      setErro(e.message || 'Erro ao resetar senha');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 400 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Resetar Senha — {usuario.nome}</div>
          <button className="chamado-modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={salvar} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelSt}>Nova senha</label>
            <input type="password" value={senha} onChange={e => setSenha(e.target.value)} style={inputSt} />
          </div>
          <div>
            <label style={labelSt}>Confirmar senha</label>
            <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} style={inputSt} />
          </div>
          {erro && <div style={{ fontSize: 12, color: '#dc2626' }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', borderRadius: 7, background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--muted-c)', fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ padding: '9px 20px', borderRadius: 7, background: 'rgba(13,124,61,.85)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalConfirmarExclusao({ usuario, onClose, onExcluido }) {
  const { sessao } = useAuth();
  const [loading, setLoading] = useState(false);
  const [erro,    setErro]    = useState('');

  async function confirmar() {
    setLoading(true); setErro('');
    try {
      const { error } = await supabase.rpc('excluir_usuario_rpc', {
        p_token: sessao?.token,
        p_username: usuario.username
      });
      if (error) throw error;
      onExcluido();
      onClose();
    } catch (e) {
      setErro(e.message || 'Erro ao excluir usuário');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="chamado-modal" style={{ maxWidth: 400 }}>
        <div className="chamado-modal-header">
          <div className="chamado-modal-title">Excluir Usuário</div>
          <button className="chamado-modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          <div style={{
            background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)',
            borderRadius: 8, padding: '14px 16px', marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
              Excluir permanentemente <span style={{ color: '#dc2626' }}>{usuario.nome}</span>?
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-c)' }}>
              Username: <span style={{ fontFamily: 'monospace', color: '#b45309' }}>{usuario.username}</span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-c)', marginTop: 8 }}>
              Esta ação não pode ser desfeita. Se preferir, use "Desativar" para bloquear temporariamente.
            </div>
          </div>
          {erro && <div style={{ fontSize: 12, color: '#dc2626', marginBottom: 12 }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 7, background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--muted-c)', fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={confirmar} disabled={loading} style={{ padding: '9px 20px', borderRadius: 7, background: 'rgba(239,68,68,.85)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
              {loading ? 'Excluindo...' : 'Excluir'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GerenciarUsuarios() {
  const { sessao, isMaster } = useAuth();
  const rolesDisponiveis = isMaster ? ROLES_MASTER : ROLES_ADMIN;
  const [usuarios,       setUsuarios]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [modalNovo,      setModalNovo]      = useState(false);
  const [modalReset,     setModalReset]     = useState(null);
  const [modalExcluir,   setModalExcluir]   = useState(null);

  async function carregar() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('listar_usuarios_rpc', {
        p_token: sessao?.token
      });
      if (error) throw error;
      setUsuarios(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  async function handleToggle(u) {
    const fn = u.ativo ? 'desativar_usuario_rpc' : 'reativar_usuario_rpc';
    const { error } = await supabase.rpc(fn, {
      p_token: sessao?.token,
      p_username: u.username
    });
    if (!error) carregar();
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <h1>Gerenciar Usuários</h1>
          <p>Controle de acesso ao sistema SIC · Biometria</p>
        </div>
        <div className="topbar-right">
          <button onClick={() => setModalNovo(true)} style={{
            padding: '8px 16px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(13,124,61,.85)', border: 'none', color: '#fff',
            fontSize: 13, fontWeight: 600,
          }}>
            + Novo Usuário
          </button>
        </div>
      </div>

      <div className="content">
        {/* Legenda de níveis */}
        <div style={{
          background: 'rgba(13,124,61,.07)', border: '1px solid rgba(13,124,61,.18)',
          borderRadius: 10, padding: '14px 18px', marginBottom: 24,
          display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          {[
            { role: 'master',  desc: 'Acesso total + gerenciar usuários' },
            { role: 'admin',   desc: 'Importar folha, publicar prévias, ver dashboards' },
            { role: 'viewer',  desc: 'Somente leitura — acesso criado por Admin ou Master' },
          ].map(({ role, desc }) => (
            <div key={role} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 8,
                background: `${ROLE_COLORS[role]}20`, color: ROLE_COLORS[role],
                fontWeight: 700, textTransform: 'uppercase',
              }}>{ROLE_LABELS[role]}</span>
              <span style={{ fontSize: 12, color: 'var(--muted-c)' }}>{desc}</span>
            </div>
          ))}
        </div>

        <div className="table-card">
          <div className="chart-header" style={{ marginBottom: 16 }}>
            <div>
              <div className="chart-title">Usuários cadastrados</div>
              <div className="chart-sub">{usuarios.length} usuário{usuarios.length !== 1 ? 's' : ''}</div>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted-c)' }}>Carregando...</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Usuário de login</th>
                    <th style={{ textAlign: 'center' }}>Nível</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Criado em</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map(u => {
                    const isSelf = u.username === sessao?.username;
                    const cor = ROLE_COLORS[u.role] || '#64748b';
                    return (
                      <tr key={u.id}>
                        <td style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {u.nome}
                          {isSelf && (
                            <span style={{ marginLeft: 7, fontSize: 9, color: '#0D7C3D', fontWeight: 800, letterSpacing: '.05em' }}>
                              VOCÊ
                            </span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--muted-c)' }}>{u.username}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 8,
                            background: `${cor}20`, color: cor, fontWeight: 700, textTransform: 'uppercase',
                          }}>{ROLE_LABELS[u.role] || u.role}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontSize: 10, padding: '2px 8px', borderRadius: 8, fontWeight: 700,
                            background: u.ativo ? 'rgba(16,185,129,.15)' : 'rgba(71,85,105,.15)',
                            color: u.ativo ? '#047857' : '#64748b',
                          }}>
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted-c)' }}>
                          {new Date(u.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {!isSelf && u.role !== 'master' && (isMaster || u.role === 'viewer') ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button onClick={() => setModalReset(u)} style={{
                                padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                                background: 'rgba(13,124,61,.12)', border: '1px solid rgba(13,124,61,.25)', color: '#15A050',
                              }}>
                                Resetar senha
                              </button>
                              <button onClick={() => handleToggle(u)} style={{
                                padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                                background: u.ativo ? 'rgba(239,68,68,.1)' : 'rgba(16,185,129,.1)',
                                border: u.ativo ? '1px solid rgba(239,68,68,.25)' : '1px solid rgba(16,185,129,.25)',
                                color: u.ativo ? '#dc2626' : '#047857',
                              }}>
                                {u.ativo ? 'Desativar' : 'Reativar'}
                              </button>
                              <button onClick={() => setModalExcluir(u)} style={{
                                padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 600,
                                background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', color: '#dc2626',
                              }}>
                                Excluir
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--text)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {modalNovo    && <ModalNovoUsuario onClose={() => setModalNovo(false)} onSalvo={carregar} rolesDisponiveis={rolesDisponiveis} />}
      {modalReset   && <ModalResetSenha usuario={modalReset} onClose={() => setModalReset(null)} onSalvo={carregar} />}
      {modalExcluir && <ModalConfirmarExclusao usuario={modalExcluir} onClose={() => setModalExcluir(null)} onExcluido={carregar} />}
    </div>
  );
}
