-- ============================================
-- Correção: permitir que perfil 'admin' também liste usuários
-- Problema: 
--   A RPC listar_usuarios_rpc exigia estritamente o perfil 'master',
--   o que impedia usuários administradores de carregar a lista de 
--   colaboradores para atribuir aos protocolos.
-- ============================================

CREATE OR REPLACE FUNCTION listar_usuarios_rpc(p_token TEXT)
RETURNS TABLE (
  id         UUID,
  nome       TEXT,
  username   TEXT,
  role       TEXT,
  ativo      BOOLEAN,
  created_at TIMESTAMPTZ,
  secretaria TEXT,
  unidades   TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  -- Permite master e admin listar os usuários
  v_usuario_id := validar_sessao(p_token, ARRAY['master', 'admin']);

  RETURN QUERY
  SELECT u.id, u.nome, u.username, u.role, u.ativo, u.created_at, u.secretaria, u.unidades
  FROM usuarios u
  ORDER BY u.created_at ASC;
END;
$$;
