-- Migration: Adicionar suporte ao perfil de Apoio (secretaria e unidades)

-- 1. Adicionar novas colunas na tabela usuarios
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS secretaria TEXT,
ADD COLUMN IF NOT EXISTS unidades TEXT[];

-- 2. Atualizar a view/rpc de login para retornar secretaria e unidades
DROP FUNCTION IF EXISTS login_usuario(text,text);
CREATE OR REPLACE FUNCTION login_usuario(p_username TEXT, p_senha TEXT)
RETURNS TABLE (id UUID, nome TEXT, username TEXT, role TEXT, token TEXT, secretaria TEXT, unidades TEXT[])
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v usuarios%ROWTYPE;
  v_token TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  SELECT * INTO v
  FROM usuarios
  WHERE usuarios.username = lower(p_username) AND ativo = TRUE;

  IF FOUND AND v.senha_hash = crypt(p_senha, v.senha_hash) THEN
    v_token := gen_random_uuid()::text;
    v_expires := now() + interval '24 hours'; -- expiração em 24h
    
    INSERT INTO sessoes (usuario_id, token, expires_at)
    VALUES (v.id, v_token, v_expires);
    
    RETURN QUERY SELECT v.id, v.nome, v.username, v.role, v_token, v.secretaria, v.unidades;
  END IF;
END;
$$;

-- 3. Atualizar a RPC de criação de usuário (Dropa versão antiga de 5 params e nova de 7 params)
DROP FUNCTION IF EXISTS criar_usuario_rpc(TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS criar_usuario_rpc(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION criar_usuario_rpc(
  p_token    TEXT,
  p_nome     TEXT,
  p_username TEXT,
  p_senha    TEXT,
  p_role     TEXT DEFAULT 'viewer',
  p_secretaria TEXT DEFAULT NULL,
  p_unidades TEXT[] DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_new_id UUID;
BEGIN
  -- Somente master pode criar usuários
  v_usuario_id := validar_sessao(p_token, ARRAY['master']);

  INSERT INTO usuarios (nome, username, senha_hash, role, secretaria, unidades)
  VALUES (
    p_nome, 
    lower(p_username), 
    crypt(p_senha, gen_salt('bf', 12)), 
    p_role,
    p_secretaria,
    p_unidades
  )
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

-- 4. Atualizar a RPC de listagem de usuários
DROP FUNCTION IF EXISTS listar_usuarios_rpc(TEXT);
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
  v_usuario_id := validar_sessao(p_token, ARRAY['master']);

  RETURN QUERY
  SELECT u.id, u.nome, u.username, u.role, u.ativo, u.created_at, u.secretaria, u.unidades
  FROM usuarios u
  ORDER BY u.created_at ASC;
END;
$$;

-- 5. Força a atualização do cache do Supabase (PostgREST)
NOTIFY pgrst, 'reload schema';

