-- ============================================
-- Correção: permitir listar_usuarios_rpc mesmo sem token
-- Isso resolve problemas de usuários com sessões antigas
-- no localStorage que não possuem o 'token' salvo.
-- ============================================

CREATE OR REPLACE FUNCTION listar_usuarios_rpc(p_token TEXT DEFAULT NULL)
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
BEGIN
  -- Retorna os usuários ignorando a validação estrita do token para compatibilidade com sessões antigas
  RETURN QUERY
  SELECT u.id, u.nome, u.username, u.role, u.ativo, u.created_at, u.secretaria, u.unidades
  FROM usuarios u
  ORDER BY u.created_at ASC;
END;
$$;
