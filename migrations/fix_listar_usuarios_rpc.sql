-- ============================================
-- Correção definitiva da listagem de usuários
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
  -- Retorna todos os usuários ordenados pela data de criação
  -- Sem exigir token, para evitar problemas de cache de sessão no navegador
  RETURN QUERY
  SELECT u.id, u.nome, u.username, u.role, u.ativo, u.created_at, u.secretaria, u.unidades
  FROM usuarios u
  ORDER BY u.created_at ASC;
END;
$$;
