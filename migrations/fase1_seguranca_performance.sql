-- ============================================================
-- SIC-Biometria — Script de Migração da Fase 1
-- Segurança (RLS), Sessões e Processamento Server-Side
-- Execute no Supabase Dashboard > SQL Editor
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │  1. Tabela de Sessões                                   │
-- └─────────────────────────────────────────────────────────┘
CREATE TABLE IF NOT EXISTS sessoes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id  UUID        NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Ativar RLS para segurança
ALTER TABLE sessoes ENABLE ROW LEVEL SECURITY;

-- ┌─────────────────────────────────────────────────────────┐
-- │  2. Saneamento de RLS nas tabelas principais            │
-- └─────────────────────────────────────────────────────────┘

-- A. Habilitar RLS em protocolo_digital (estava desabilitada)
ALTER TABLE protocolo_digital ENABLE ROW LEVEL SECURITY;

-- B. Remover políticas antigas de escrita pública total
DROP POLICY IF EXISTS "previas_freq_write_all" ON previas_frequencia;
DROP POLICY IF EXISTS "previas_pub_write_all" ON previas_publicadas;
DROP POLICY IF EXISTS "folha_write_all" ON folha_previas;
DROP POLICY IF EXISTS "audit_all" ON audit_log;
DROP POLICY IF EXISTS "usuarios_select_all" ON usuarios;

-- C. Criar novas políticas seguras (SELECT público para dados, escrita restrita)
-- previas_frequencia
CREATE POLICY "previas_freq_read_public" ON previas_frequencia FOR SELECT USING (true);
-- previas_publicadas
CREATE POLICY "previas_pub_read_public" ON previas_publicadas FOR SELECT USING (true);
-- folha_previas
CREATE POLICY "folha_read_public" ON folha_previas FOR SELECT USING (true);
-- audit_log
CREATE POLICY "audit_read_public" ON audit_log FOR SELECT USING (true);
-- protocolo_digital
DROP POLICY IF EXISTS "Leitura pública" ON protocolo_digital;
CREATE POLICY "protocolo_read_public" ON protocolo_digital FOR SELECT USING (true);

-- D. A tabela 'usuarios' NÃO deve ser legível por qualquer cliente anônimo.
-- Bloquear SELECT direto para anon (nenhuma SELECT policy para anon).
-- Apenas usuários autenticados via JWT ou procedimentos internos podem ver.
CREATE POLICY "usuarios_select_authenticated" ON usuarios 
  FOR SELECT TO authenticated USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  3. Validação de Sessão & Autenticação                  │
-- └─────────────────────────────────────────────────────────┘

-- Helper: Validador de Token e Papel (Role)
CREATE OR REPLACE FUNCTION validar_sessao(p_token TEXT, p_roles_permitidas TEXT[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_role TEXT;
BEGIN
  SELECT s.usuario_id, u.role INTO v_usuario_id, v_role
  FROM sessoes s
  INNER JOIN usuarios u ON s.usuario_id = u.id
  WHERE s.token = p_token 
    AND s.expires_at > now()
    AND u.ativo = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sessão inválida, expirada ou usuário inativo.';
  END IF;

  IF p_roles_permitidas IS NOT NULL AND NOT (v_role = ANY(p_roles_permitidas)) THEN
    RAISE EXCEPTION 'Acesso não autorizado para esta operação.';
  END IF;

  RETURN v_usuario_id;
END;
$$;

-- Novo Login: gera e armazena token de sessão
DROP FUNCTION IF EXISTS login_usuario(text,text);
CREATE OR REPLACE FUNCTION login_usuario(p_username TEXT, p_senha TEXT)
RETURNS TABLE (id UUID, nome TEXT, username TEXT, role TEXT, token TEXT)
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
    
    RETURN QUERY SELECT v.id, v.nome, v.username, v.role, v_token;
  END IF;
END;
$$;


-- ┌─────────────────────────────────────────────────────────┐
-- │  4. RPCs Seguras: Prévias de Frequência                 │
-- └─────────────────────────────────────────────────────────┘

-- Deletar competência
CREATE OR REPLACE FUNCTION deletar_competencia_ponto_rpc(p_token TEXT, p_competencia TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_del_freq INT;
  v_del_pub INT;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['admin', 'master']);

  DELETE FROM previas_frequencia WHERE periodo_referencia = p_competencia;
  GET DIAGNOSTICS v_del_freq = ROW_COUNT;

  DELETE FROM previas_publicadas WHERE competencia = p_competencia;
  GET DIAGNOSTICS v_del_pub = ROW_COUNT;

  INSERT INTO audit_log (operacao, tabela_alvo, competencia, registros_afetados, usuario_email)
  SELECT 'DELETE PONTO', 'previas_frequencia & previas_publicadas', p_competencia, v_del_freq + v_del_pub, u.username
  FROM usuarios u WHERE u.id = v_usuario_id;
END;
$$;

-- Inserir lote de marcações
CREATE OR REPLACE FUNCTION inserir_marcacoes_batch_rpc(p_token TEXT, p_rows JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_count INT;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['admin', 'master']);

  INSERT INTO previas_frequencia (
    secretaria_codigo,
    periodo_referencia,
    matricula,
    data_ocorrencia,
    codigo_ocorrencia,
    percentual_desconto
  )
  SELECT
    (r->>'secretaria_codigo')::TEXT,
    (r->>'periodo_referencia')::TEXT,
    (r->>'matricula')::TEXT,
    CASE WHEN (r->>'data_ocorrencia') IS NOT NULL AND (r->>'data_ocorrencia') <> ''
         THEN (r->>'data_ocorrencia')::DATE
         ELSE NULL
    END,
    (r->>'codigo_ocorrencia')::TEXT,
    COALESCE((r->>'percentual_desconto')::INTEGER, 0)
  FROM jsonb_array_elements(p_rows) AS r;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  INSERT INTO audit_log (operacao, tabela_alvo, registros_afetados, usuario_email)
  SELECT 'INSERT BATCH PONTO', 'previas_frequencia', v_count, u.username
  FROM usuarios u WHERE u.id = v_usuario_id;

  RETURN v_count;
END;
$$;

-- Publicar resumos das secretarias
CREATE OR REPLACE FUNCTION publicar_resumos_ponto_rpc(p_token TEXT, p_competencia TEXT, p_rows JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_count INT;
  r RECORD;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['admin', 'master']);

  FOR r IN 
    SELECT 
      (x->>'secretaria_codigo')::TEXT AS sec_codigo,
      (x->>'secretaria_nome')::TEXT AS sec_nome,
      (x->>'total_ocorrencias')::INT AS ocorrencias,
      (x->>'total_faltas')::INT AS faltas,
      (x->>'total_atrasos')::INT AS atrasos,
      (x->>'servidores_impactados')::INT AS serv_impactados
    FROM jsonb_array_elements(p_rows) AS x
  LOOP
    INSERT INTO previas_publicadas (
      secretaria_codigo,
      competencia,
      secretaria_nome,
      total_ocorrencias,
      total_faltas,
      total_atrasos,
      servidores_impactados,
      total_desconto_acumulado,
      media_desconto,
      z_score,
      classificacao_alerta
    )
    VALUES (
      r.sec_codigo,
      p_competencia,
      r.sec_nome,
      r.ocorrencias,
      r.faltas,
      r.atrasos,
      r.serv_impactados,
      0, 0, NULL, 'sem_historico'
    )
    ON CONFLICT (secretaria_codigo, competencia) DO UPDATE SET
      secretaria_nome = EXCLUDED.secretaria_nome,
      total_ocorrencias = EXCLUDED.total_ocorrencias,
      total_faltas = EXCLUDED.total_faltas,
      total_atrasos = EXCLUDED.total_atrasos,
      servidores_impactados = EXCLUDED.servidores_impactados;
  END LOOP;

  SELECT count(*) INTO v_count FROM jsonb_array_elements(p_rows);

  INSERT INTO audit_log (operacao, tabela_alvo, competencia, registros_afetados, usuario_email)
  SELECT 'PUBLISH RESUMOS PONTO', 'previas_publicadas', p_competencia, v_count, u.username
  FROM usuarios u WHERE u.id = v_usuario_id;

  RETURN v_count;
END;
$$;


-- ┌─────────────────────────────────────────────────────────┐
-- │  5. RPCs Seguras: Folha de Pagamento                    │
-- └─────────────────────────────────────────────────────────┘

-- Deletar folha
CREATE OR REPLACE FUNCTION deletar_folha_rpc(p_token TEXT, p_competencia DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_deleted INT;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['admin', 'master']);

  DELETE FROM folha_previas WHERE competencia = p_competencia;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO audit_log (operacao, tabela_alvo, competencia, registros_afetados, usuario_email)
  SELECT 'DELETE FOLHA', 'folha_previas', p_competencia::TEXT, v_deleted, u.username
  FROM usuarios u WHERE u.id = v_usuario_id;
END;
$$;

-- Inserir lote da folha
CREATE OR REPLACE FUNCTION inserir_folha_batch_rpc(p_token TEXT, p_rows JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_count INT;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['admin', 'master']);

  INSERT INTO folha_previas (
    competencia,
    matricula,
    nome,
    cargo,
    secretaria_sigla,
    secretaria,
    unidade,
    faltas,
    atrasos_fracao,
    atrasos_dia,
    dsr,
    hora_extra_50,
    hora_extra_100,
    adicional_noturno
  )
  SELECT
    (r->>'competencia')::DATE,
    (r->>'matricula')::INTEGER,
    (r->>'nome')::TEXT,
    (r->>'cargo')::TEXT,
    (r->>'secretaria_sigla')::TEXT,
    (r->>'secretaria')::TEXT,
    (r->>'unidade')::TEXT,
    COALESCE((r->>'faltas')::INTEGER, 0),
    COALESCE((r->>'atrasos_fracao')::INTEGER, 0),
    COALESCE((r->>'atrasos_dia')::INTEGER, 0),
    COALESCE((r->>'dsr')::INTEGER, 0),
    COALESCE((r->>'hora_extra_50')::INTEGER, 0),
    COALESCE((r->>'hora_extra_100')::INTEGER, 0),
    COALESCE((r->>'adicional_noturno')::INTEGER, 0)
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (competencia, matricula) DO UPDATE SET
    nome = EXCLUDED.nome,
    cargo = EXCLUDED.cargo,
    secretaria_sigla = EXCLUDED.secretaria_sigla,
    secretaria = EXCLUDED.secretaria,
    unidade = EXCLUDED.unidade,
    faltas = EXCLUDED.faltas,
    atrasos_fracao = EXCLUDED.atrasos_fracao,
    atrasos_dia = EXCLUDED.atrasos_dia,
    dsr = EXCLUDED.dsr,
    hora_extra_50 = EXCLUDED.hora_extra_50,
    hora_extra_100 = EXCLUDED.hora_extra_100,
    adicional_noturno = EXCLUDED.adicional_noturno;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  INSERT INTO audit_log (operacao, tabela_alvo, registros_afetados, usuario_email)
  SELECT 'INSERT BATCH FOLHA', 'folha_previas', v_count, u.username
  FROM usuarios u WHERE u.id = v_usuario_id;

  RETURN v_count;
END;
$$;


-- ┌─────────────────────────────────────────────────────────┐
-- │  6. RPCs Seguras: Protocolo Digital                     │
-- └─────────────────────────────────────────────────────────┘

-- Criar Protocolo
CREATE OR REPLACE FUNCTION criar_protocolo_rpc(p_token TEXT, p_protocolo JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_user_email TEXT;
  v_new_id BIGINT;
  v_res JSONB;
BEGIN
  v_usuario_id := validar_sessao(p_token, NULL); -- qualquer usuário autenticado
  SELECT username INTO v_user_email FROM usuarios WHERE id = v_usuario_id;

  INSERT INTO protocolo_digital (
    numero_protocolo,
    requerente_nome,
    requerente_matricula,
    secretaria,
    tipo_solicitacao,
    descricao,
    status,
    prioridade,
    prazo_estimado,
    historico_tramitacao,
    documento_anexo
  )
  VALUES (
    (p_protocolo->>'numero_protocolo')::TEXT,
    (p_protocolo->>'requerente_nome')::TEXT,
    (p_protocolo->>'requerente_matricula')::TEXT,
    (p_protocolo->>'secretaria')::TEXT,
    (p_protocolo->>'tipo_solicitacao')::TEXT,
    (p_protocolo->>'descricao')::TEXT,
    'Aberto',
    COALESCE((p_protocolo->>'prioridade')::TEXT, 'Normal'),
    (p_protocolo->>'prazo_estimado')::DATE,
    COALESCE((p_protocolo->'historico_tramitacao')::JSONB, '[]'::JSONB),
    (p_protocolo->>'documento_anexo')::TEXT
  )
  RETURNING id INTO v_new_id;

  SELECT to_jsonb(pd) INTO v_res FROM protocolo_digital pd WHERE pd.id = v_new_id;

  INSERT INTO audit_log (operacao, tabela_alvo, registros_afetados, usuario_email)
  VALUES ('CREATE PROTOCOLO', 'protocolo_digital', 1, v_user_email);

  RETURN v_res;
END;
$$;

-- Atualizar status do protocolo
CREATE OR REPLACE FUNCTION atualizar_status_protocolo_rpc(
  p_token TEXT,
  p_id BIGINT,
  p_status TEXT,
  p_historico JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_user_email TEXT;
  v_res JSONB;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['admin', 'master']);
  SELECT username INTO v_user_email FROM usuarios WHERE id = v_usuario_id;

  UPDATE protocolo_digital
  SET 
    status = p_status,
    historico_tramitacao = p_historico,
    updated_at = NOW(),
    data_conclusao = CASE WHEN p_status = 'Concluído' THEN CURRENT_DATE ELSE data_conclusao END
  WHERE id = p_id;

  SELECT to_jsonb(pd) INTO v_res FROM protocolo_digital pd WHERE pd.id = p_id;

  INSERT INTO audit_log (operacao, tabela_alvo, registros_afetados, usuario_email)
  VALUES ('UPDATE STATUS PROTOCOLO', 'protocolo_digital', 1, v_user_email);

  RETURN v_res;
END;
$$;

-- Atualizar campos gerais do protocolo
CREATE OR REPLACE FUNCTION atualizar_protocolo_rpc(
  p_token TEXT,
  p_id BIGINT,
  p_campos JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_user_email TEXT;
  v_res JSONB;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['admin', 'master']);
  SELECT username INTO v_user_email FROM usuarios WHERE id = v_usuario_id;

  UPDATE protocolo_digital
  SET
    responsavel = COALESCE((p_campos->>'responsavel')::TEXT, responsavel),
    prioridade = COALESCE((p_campos->>'prioridade')::TEXT, prioridade),
    prazo_estimado = CASE WHEN (p_campos->>'prazo_estimado') IS NOT NULL 
                          THEN (p_campos->>'prazo_estimado')::DATE 
                          ELSE prazo_estimado 
                     END,
    updated_at = NOW()
  WHERE id = p_id;

  SELECT to_jsonb(pd) INTO v_res FROM protocolo_digital pd WHERE pd.id = p_id;

  INSERT INTO audit_log (operacao, tabela_alvo, registros_afetados, usuario_email)
  VALUES ('UPDATE FIELDS PROTOCOLO', 'protocolo_digital', 1, v_user_email);

  RETURN v_res;
END;
$$;

-- Importar/sincronizar planilha de protocolos
CREATE OR REPLACE FUNCTION importar_protocolos_rpc(p_token TEXT, p_rows JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
  v_user_email TEXT;
  r RECORD;
  v_count INT := 0;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['admin', 'master']);
  SELECT username INTO v_user_email FROM usuarios WHERE id = v_usuario_id;

  -- Realiza o upsert de cada protocolo fornecido
  FOR r IN
    SELECT
      (x->>'numero_protocolo')::TEXT AS num_prot,
      (x->>'requerente_nome')::TEXT AS nome,
      (x->>'requerente_matricula')::TEXT AS matricula,
      (x->>'secretaria')::TEXT AS sec,
      (x->>'tipo_solicitacao')::TEXT AS tipo,
      (x->>'descricao')::TEXT AS descr,
      (x->>'status')::TEXT AS stat,
      (x->>'prioridade')::TEXT AS prio,
      (x->>'prazo_estimado')::DATE AS prazo,
      (x->'historico_tramitacao')::JSONB AS hist
    FROM jsonb_array_elements(p_rows) AS x
  LOOP
    INSERT INTO protocolo_digital (
      numero_protocolo, requerente_nome, requerente_matricula, secretaria,
      tipo_solicitacao, descricao, status, prioridade, prazo_estimado,
      historico_tramitacao, updated_at
    )
    VALUES (
      r.num_prot, r.nome, r.matricula, r.sec, r.tipo, r.descr, r.stat, r.prio, r.prazo, r.hist, NOW()
    )
    ON CONFLICT (numero_protocolo) DO UPDATE SET
      requerente_nome = EXCLUDED.requerente_nome,
      secretaria = EXCLUDED.secretaria,
      tipo_solicitacao = EXCLUDED.tipo_solicitacao,
      descricao = EXCLUDED.descricao,
      status = EXCLUDED.status,
      prioridade = EXCLUDED.prioridade,
      prazo_estimado = EXCLUDED.prazo_estimado,
      historico_tramitacao = EXCLUDED.historico_tramitacao,
      updated_at = NOW();
      
    v_count := v_count + 1;
  END LOOP;

  INSERT INTO audit_log (operacao, tabela_alvo, registros_afetados, usuario_email)
  VALUES ('IMPORT PLANILHA PROTOCOLO', 'protocolo_digital', v_count, v_user_email);

  RETURN v_count;
END;
$$;


-- ┌─────────────────────────────────────────────────────────┐
-- │  7. RPCs Seguras: Administração de Usuários             │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION criar_usuario_rpc(
  p_token    TEXT,
  p_nome     TEXT,
  p_username TEXT,
  p_senha    TEXT,
  p_role     TEXT DEFAULT 'viewer'
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

  INSERT INTO usuarios (nome, username, senha_hash, role)
  VALUES (p_nome, lower(p_username), crypt(p_senha, gen_salt('bf', 12)), p_role)
  RETURNING id INTO v_new_id;
  
  RETURN v_new_id;
END;
$$;

CREATE OR REPLACE FUNCTION listar_usuarios_rpc(p_token TEXT)
RETURNS TABLE (
  id         UUID,
  nome       TEXT,
  username   TEXT,
  role       TEXT,
  ativo      BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['master']);

  RETURN QUERY
  SELECT u.id, u.nome, u.username, u.role, u.ativo, u.created_at
  FROM usuarios u
  ORDER BY u.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION resetar_senha_usuario_rpc(p_token TEXT, p_username TEXT, p_senha_nova TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['master']);

  UPDATE usuarios
  SET senha_hash = crypt(p_senha_nova, gen_salt('bf', 12))
  WHERE username = lower(p_username);
END;
$$;

CREATE OR REPLACE FUNCTION desativar_usuario_rpc(p_token TEXT, p_username TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['master']);

  UPDATE usuarios SET ativo = FALSE
  WHERE username = lower(p_username) AND role <> 'master';
END;
$$;

CREATE OR REPLACE FUNCTION reativar_usuario_rpc(p_token TEXT, p_username TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['master']);

  UPDATE usuarios SET ativo = TRUE WHERE username = lower(p_username);
END;
$$;

CREATE OR REPLACE FUNCTION excluir_usuario_rpc(p_token TEXT, p_username TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id UUID;
BEGIN
  v_usuario_id := validar_sessao(p_token, ARRAY['master']);

  DELETE FROM usuarios WHERE username = lower(p_username) AND role <> 'master';
END;
$$;


-- ┌─────────────────────────────────────────────────────────┐
-- │  8. Otimização de Performance: JOIN Server-Side         │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION get_funcionarios_por_matriculas(p_matriculas TEXT[])
RETURNS TABLE (
  "Matricula"          INTEGER,
  "Nome_Funcionario"   TEXT,
  "Des_LocalTrab"      TEXT,
  "Des_Secretaria"     TEXT,
  "SiglaSec"           TEXT,
  "Des_Cargo"          TEXT,
  "Des_Horario"        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f."Matricula"::INTEGER,
    f."Nome_Funcionario"::TEXT,
    f."Des_LocalTrab"::TEXT,
    f."Des_Secretaria"::TEXT,
    f."SiglaSec"::TEXT,
    f."Des_Cargo"::TEXT,
    f."Des_Horario"::TEXT
  FROM funcionarios_infos f
  -- Cast matriculas array para inteiros para fazer o join rápido indexado
  WHERE f."Matricula" = ANY(p_matriculas::INTEGER[]);
END;
$$;

-- Criar índice em Matricula se não existir para garantir busca em O(1) por funcionário
CREATE UNIQUE INDEX IF NOT EXISTS idx_funcionarios_matricula ON funcionarios_infos("Matricula");
