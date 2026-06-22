-- ============================================================
-- SIC-Biometria — Sistema de Usuários Customizado
-- Execute DEPOIS de sic_biometria.sql
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │  Habilitar pgcrypto (para hash de senhas)               │
-- └─────────────────────────────────────────────────────────┘
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ┌─────────────────────────────────────────────────────────┐
-- │  Tabela de usuários do sistema                          │
-- └─────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS usuarios (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  nome        TEXT        NOT NULL,
  username    TEXT        UNIQUE NOT NULL,
  senha_hash  TEXT        NOT NULL,
  role        TEXT        NOT NULL DEFAULT 'viewer',
  ativo       BOOLEAN     DEFAULT TRUE
);

-- role pode ser: 'master', 'admin', 'viewer'
-- master: acesso total + gerenciar usuários
-- admin:  importar folha, publicar prévias, ver dashboards
-- viewer: somente leitura

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usuarios_select_all" ON usuarios FOR SELECT USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  RPCs de autenticação e gestão                          │
-- └─────────────────────────────────────────────────────────┘

-- Login: retorna { id, nome, username, role } ou vazio
CREATE OR REPLACE FUNCTION login_usuario(p_username TEXT, p_senha TEXT)
RETURNS TABLE (id UUID, nome TEXT, username TEXT, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v usuarios%ROWTYPE;
BEGIN
  SELECT * INTO v
  FROM usuarios
  WHERE usuarios.username = lower(p_username) AND ativo = TRUE;

  IF FOUND AND v.senha_hash = crypt(p_senha, v.senha_hash) THEN
    RETURN QUERY SELECT v.id, v.nome, v.username, v.role;
  END IF;
END;
$$;

-- Criar usuário (chamado pelo master via app)
CREATE OR REPLACE FUNCTION criar_usuario(
  p_nome     TEXT,
  p_username TEXT,
  p_senha    TEXT,
  p_role     TEXT DEFAULT 'viewer'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO usuarios (nome, username, senha_hash, role)
  VALUES (p_nome, lower(p_username), crypt(p_senha, gen_salt('bf', 12)), p_role)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Listar todos os usuários
CREATE OR REPLACE FUNCTION listar_usuarios()
RETURNS TABLE (
  id         UUID,
  nome       TEXT,
  username   TEXT,
  role       TEXT,
  ativo      BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT id, nome, username, role, ativo, created_at
  FROM usuarios
  ORDER BY created_at ASC;
$$;

-- Resetar senha de um usuário
CREATE OR REPLACE FUNCTION resetar_senha_usuario(p_username TEXT, p_senha_nova TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE usuarios
  SET senha_hash = crypt(p_senha_nova, gen_salt('bf', 12))
  WHERE username = lower(p_username);
END;
$$;

-- Desativar usuário
CREATE OR REPLACE FUNCTION desativar_usuario(p_username TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE usuarios SET ativo = FALSE
  WHERE username = lower(p_username) AND role <> 'master';
END;
$$;

-- Reativar usuário
CREATE OR REPLACE FUNCTION reativar_usuario(p_username TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE usuarios SET ativo = TRUE WHERE username = lower(p_username);
END;
$$;


CREATE OR REPLACE FUNCTION excluir_usuario(p_username TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM usuarios WHERE username = lower(p_username) AND role <> 'master';
END;
$$;


-- ┌─────────────────────────────────────────────────────────┐
-- │  Ajustar RLS para aceitar escrita anon                  │
-- │  (autenticação agora é feita via RPCs, não JWT)         │
-- └─────────────────────────────────────────────────────────┘

-- Remover políticas que exigem JWT autenticado
DROP POLICY IF EXISTS "previas_freq_insert_auth" ON previas_frequencia;
DROP POLICY IF EXISTS "previas_freq_update_auth" ON previas_frequencia;
DROP POLICY IF EXISTS "previas_freq_delete_auth" ON previas_frequencia;
DROP POLICY IF EXISTS "previas_pub_insert_auth"  ON previas_publicadas;
DROP POLICY IF EXISTS "previas_pub_update_auth"  ON previas_publicadas;
DROP POLICY IF EXISTS "previas_pub_delete_auth"  ON previas_publicadas;
DROP POLICY IF EXISTS "folha_insert_auth"         ON folha_previas;
DROP POLICY IF EXISTS "folha_update_auth"         ON folha_previas;
DROP POLICY IF EXISTS "folha_delete_auth"         ON folha_previas;
DROP POLICY IF EXISTS "audit_insert_authenticated" ON audit_log;
DROP POLICY IF EXISTS "audit_select_authenticated" ON audit_log;

-- Permitir escrita anon (segurança feita no nível da aplicação)
CREATE POLICY "previas_freq_write_all" ON previas_frequencia
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "previas_pub_write_all" ON previas_publicadas
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "folha_write_all" ON folha_previas
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "audit_all" ON audit_log
  FOR ALL USING (true) WITH CHECK (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  Criar usuário MASTER                                   │
-- │  EDITE os valores antes de executar!                    │
-- └─────────────────────────────────────────────────────────┘

-- Substitua:
--   'Seu Nome'     → seu nome completo
--   'seu.usuario'  → username de login (sem espaços, sem acentos)
--   'SuaSenha123'  → sua senha de acesso

INSERT INTO usuarios (nome, username, senha_hash, role)
VALUES (
  'Seu Nome',
  'seu.usuario',
  crypt('SuaSenha123', gen_salt('bf', 12)),
  'master'
)
ON CONFLICT (username) DO NOTHING;


-- ┌─────────────────────────────────────────────────────────┐
-- │  Verificação                                             │
-- └─────────────────────────────────────────────────────────┘

SELECT username, nome, role, ativo FROM usuarios;

SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('login_usuario','criar_usuario','listar_usuarios',
                       'resetar_senha_usuario','desativar_usuario','reativar_usuario','excluir_usuario')
ORDER BY routine_name;
