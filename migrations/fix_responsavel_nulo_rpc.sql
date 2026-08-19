-- ============================================
-- Correção: permitir atribuir "Ninguém" (responsavel = null) em atualizar_protocolo_rpc
-- Problema: 
--   O uso de COALESCE((p_campos->>'responsavel')::TEXT, responsavel) ignora
--   o caso onde p_campos contém { "responsavel": null }, mantendo o valor antigo.
-- ============================================

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
    responsavel = CASE WHEN p_campos ? 'responsavel' 
                       THEN (p_campos->>'responsavel')::TEXT 
                       ELSE responsavel 
                  END,
    prioridade = CASE WHEN p_campos ? 'prioridade' 
                      THEN (p_campos->>'prioridade')::TEXT 
                      ELSE prioridade 
                 END,
    prazo_estimado = CASE WHEN p_campos ? 'prazo_estimado' 
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
