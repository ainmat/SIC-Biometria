import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function ModalAlterarSenha({ onClose }) {
  const { sessao } = useAuth();
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha,  setNovaSenha]  = useState('');
  const [confirmar,  setConfirmar]  = useState('');
  const [erro,       setErro]       = useState('');
  const [sucesso,    setSucesso]    = useState(false);
  const [loading,    setLoading]    = useState(false);

  const inputSt = {
    width: '100%', background: 'var(--surface)',
    border: '1px solid #334155', borderRadius: 7,
    padding: '9px 12px', color: 'var(--text)', fontSize: 13,
    outline: 'none', boxSizing: 'border-box',
  };
  const labelSt = {
    display: 'block', fontSize: 11, color: 'var(--muted-c)', fontWeight: 600,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em',
  };

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
          <div className="chamado-modal-title">Alterar Minha Senha</div>
          <button className="chamado-modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ padding: '20px 24px' }}>
          {sucesso ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <span style={{ color: '#10b981', fontSize: 24 }}>✓</span>
              </div>
              <h3 style={{ fontSize: 16, color: 'var(--text)', marginBottom: 8 }}>Senha alterada com sucesso!</h3>
              <p style={{ fontSize: 13, color: 'var(--muted-c)', marginBottom: 24 }}>
                Sua senha foi atualizada. Você pode usar a nova senha na próxima vez que fizer login.
              </p>
              <button onClick={onClose} style={{ padding: '9px 24px', borderRadius: 7, background: '#0D7C3D', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          ) : (
            <form onSubmit={salvar}>
              <div style={{ marginBottom: 16 }}>
                <label style={labelSt}>Senha Atual</label>
                <input type="password" value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} style={inputSt} autoFocus />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelSt}>Nova Senha</label>
                <input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} style={inputSt} />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={labelSt}>Confirmar Nova Senha</label>
                <input type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} style={inputSt} />
              </div>
              {erro && <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 16, padding: '10px 12px', background: 'rgba(239,68,68,.1)', borderRadius: 6 }}>{erro}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={onClose} style={{ padding: '9px 16px', borderRadius: 7, background: 'rgba(0, 0, 0, 0.03)', border: '1px solid rgba(0, 0, 0, 0.06)', color: 'var(--muted-c)', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={loading} style={{ padding: '9px 20px', borderRadius: 7, background: '#0D7C3D', border: 'none', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'wait' : 'pointer' }}>
                  {loading ? 'Salvando...' : 'Salvar nova senha'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
