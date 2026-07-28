-- ============================================
-- Correção: data_conclusao nos RPCs de protocolo
-- Data: 2026-07-28
-- Problema: 
--   1) atualizar_protocolo_rpc não atualizava data_conclusao
--   2) atualizar_status_protocolo_rpc sempre sobrescrevia com CURRENT_DATE
-- ============================================

-- 1. Corrigir atualizar_status_protocolo_rpc
-- Preservar data_conclusao existente ao marcar como Concluído
-- Só usar CURRENT_DATE quando data_conclusao é NULL
-- Limpar data_conclusao quando status sai de Concluído
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
    data_conclusao = CASE 
      WHEN p_status = 'Concluído' AND data_conclusao IS NOT NULL THEN data_conclusao
      WHEN p_status = 'Concluído' AND data_conclusao IS NULL THEN CURRENT_DATE
      ELSE NULL
    END
  WHERE id = p_id;

  SELECT to_jsonb(pd) INTO v_res FROM protocolo_digital pd WHERE pd.id = p_id;

  INSERT INTO audit_log (operacao, tabela_alvo, registros_afetados, usuario_email)
  VALUES ('UPDATE STATUS PROTOCOLO', 'protocolo_digital', 1, v_user_email);

  RETURN v_res;
END;
$$;

-- 2. Corrigir atualizar_protocolo_rpc
-- Adicionar suporte ao campo data_conclusao (setar e limpar)
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
    data_conclusao = CASE WHEN p_campos ? 'data_conclusao' 
                          THEN (p_campos->>'data_conclusao')::DATE 
                          ELSE data_conclusao 
                     END,
    updated_at = NOW()
  WHERE id = p_id;

  SELECT to_jsonb(pd) INTO v_res FROM protocolo_digital pd WHERE pd.id = p_id;

  INSERT INTO audit_log (operacao, tabela_alvo, registros_afetados, usuario_email)
  VALUES ('UPDATE FIELDS PROTOCOLO', 'protocolo_digital', 1, v_user_email);

  RETURN v_res;
END;
$$;
