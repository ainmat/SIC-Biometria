import { createContext, useContext, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);
const SESSION_KEY = 'sic_sessao';

function lerSessao() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [sessao, setSessao] = useState(lerSessao);

  async function loginUser(username, senha) {
    const { data, error } = await supabase.rpc('login_usuario', {
      p_username: username.toLowerCase().trim(),
      p_senha:    senha,
    });
    if (error) throw error;
    if (!data || data.length === 0) throw new Error('Usuário ou senha inválidos');

    const user = data[0];
    const s = { 
      id: user.id, 
      nome: user.nome, 
      username: user.username, 
      role: user.role, 
      token: user.token,
      secretaria: user.secretaria,
      unidades: user.unidades
    };
    setSessao(s);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    return s;
  }

  function logout() {
    setSessao(null);
    sessionStorage.removeItem(SESSION_KEY);
  }

  const role      = sessao?.role ?? null;
  const isMaster  = role === 'master';
  const isAdmin   = role === 'master' || role === 'admin';
  const isApoio   = role === 'apoio';
  const isVisitor = role === 'viewer';
  const isLoggedIn = role !== null;

  return (
    <AuthContext.Provider value={{
      sessao,
      role,
      isMaster,
      isAdmin,
      isApoio,
      isVisitor,
      isLoggedIn,
      loading: false,
      loginUser,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
