-- ============================================================
-- SIC-Biometria — Script de Migração
-- Execute no Supabase Dashboard > SQL Editor
-- Ordem de execução: do topo para baixo
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │  P12 — Tabela de Audit Log                              │
-- └─────────────────────────────────────────────────────────┘

CREATE TABLE IF NOT EXISTS audit_log (
  id                  BIGSERIAL PRIMARY KEY,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  operacao            TEXT        NOT NULL,
  tabela_alvo         TEXT,
  competencia         TEXT,
  secretaria          TEXT,
  registros_afetados  INT,
  usuario_email       TEXT
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_insert_authenticated" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "audit_select_authenticated" ON audit_log
  FOR SELECT TO authenticated USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  P02 — RLS nas tabelas de dados                         │
-- └─────────────────────────────────────────────────────────┘

-- previas_frequencia
ALTER TABLE previas_frequencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "previas_freq_read_all" ON previas_frequencia
  FOR SELECT USING (true);

CREATE POLICY "previas_freq_insert_auth" ON previas_frequencia
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "previas_freq_update_auth" ON previas_frequencia
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "previas_freq_delete_auth" ON previas_frequencia
  FOR DELETE TO authenticated USING (true);


-- previas_publicadas
ALTER TABLE previas_publicadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "previas_pub_read_all" ON previas_publicadas
  FOR SELECT USING (true);

CREATE POLICY "previas_pub_insert_auth" ON previas_publicadas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "previas_pub_update_auth" ON previas_publicadas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "previas_pub_delete_auth" ON previas_publicadas
  FOR DELETE TO authenticated USING (true);


-- folha_previas
ALTER TABLE folha_previas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folha_read_all" ON folha_previas
  FOR SELECT USING (true);

CREATE POLICY "folha_insert_auth" ON folha_previas
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "folha_update_auth" ON folha_previas
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "folha_delete_auth" ON folha_previas
  FOR DELETE TO authenticated USING (true);


-- ┌─────────────────────────────────────────────────────────┐
-- │  P03 — Publicação atômica de prévia                     │
-- └─────────────────────────────────────────────────────────┘

CREATE OR REPLACE FUNCTION republica_previa(
  p_secretaria_codigo  TEXT,
  p_periodo_referencia TEXT,
  p_registros          JSONB,
  p_metadados          JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM previas_frequencia
  WHERE secretaria_codigo  = p_secretaria_codigo
    AND periodo_referencia = p_periodo_referencia;

  INSERT INTO previas_frequencia (
    secretaria_codigo, periodo_referencia, matricula,
    data_ocorrencia, codigo_ocorrencia, percentual_desconto
  )
  SELECT
    p_secretaria_codigo,
    p_periodo_referencia,
    r->>'matricula',
    CASE WHEN (r->>'data_ocorrencia') IS NOT NULL AND (r->>'data_ocorrencia') <> ''
         THEN (r->>'data_ocorrencia')::DATE
         ELSE NULL
    END,
    r->>'codigo_ocorrencia',
    COALESCE((r->>'percentual_desconto')::NUMERIC, 0)
  FROM jsonb_array_elements(p_registros) AS r;

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
    p_secretaria_codigo,
    p_periodo_referencia,
    p_metadados->>'secretaria_nome',
    COALESCE((p_metadados->>'total_ocorrencias')::INT, 0),
    COALESCE((p_metadados->>'total_faltas')::INT, 0),
    COALESCE((p_metadados->>'total_atrasos')::INT, 0),
    COALESCE((p_metadados->>'servidores_impactados')::INT, 0),
    COALESCE((p_metadados->>'total_desconto_acumulado')::NUMERIC, 0),
    COALESCE((p_metadados->>'media_desconto')::NUMERIC, 0),
    CASE WHEN (p_metadados->>'z_score') IS NOT NULL AND (p_metadados->>'z_score') <> 'null'
         THEN (p_metadados->>'z_score')::NUMERIC ELSE NULL END,
    COALESCE(p_metadados->>'classificacao_alerta', 'sem_historico')
  )
  ON CONFLICT (secretaria_codigo, competencia) DO UPDATE SET
    secretaria_nome          = EXCLUDED.secretaria_nome,
    total_ocorrencias        = EXCLUDED.total_ocorrencias,
    total_faltas             = EXCLUDED.total_faltas,
    total_atrasos            = EXCLUDED.total_atrasos,
    servidores_impactados    = EXCLUDED.servidores_impactados,
    total_desconto_acumulado = EXCLUDED.total_desconto_acumulado,
    media_desconto           = EXCLUDED.media_desconto,
    z_score                  = EXCLUDED.z_score,
    classificacao_alerta     = EXCLUDED.classificacao_alerta;
END;
$$;


-- ┌─────────────────────────────────────────────────────────┐
-- │  P11 — RPCs de agregação (prévias)                      │
-- └─────────────────────────────────────────────────────────┘

-- Histórico de secretaria
CREATE OR REPLACE FUNCTION get_historico_secretaria(
  p_secretaria      TEXT,
  p_periodo_excluir TEXT DEFAULT NULL
)
RETURNS TABLE (
  periodo_referencia  TEXT,
  total_ocorrencias   BIGINT,
  total_faltas        BIGINT,
  total_atrasos       BIGINT,
  servidores_afetados BIGINT,
  desconto_total      NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    periodo_referencia,
    COUNT(*)                                                           AS total_ocorrencias,
    COUNT(*) FILTER (WHERE codigo_ocorrencia = '171')                 AS total_faltas,
    COUNT(*) FILTER (WHERE codigo_ocorrencia = '335')                 AS total_atrasos,
    COUNT(DISTINCT matricula)                                          AS servidores_afetados,
    COALESCE(SUM(percentual_desconto), 0)                             AS desconto_total
  FROM previas_frequencia
  WHERE secretaria_codigo = p_secretaria
    AND (p_periodo_excluir IS NULL OR periodo_referencia < p_periodo_excluir)
  GROUP BY periodo_referencia
  ORDER BY periodo_referencia DESC;
$$;


-- Top matrículas
CREATE OR REPLACE FUNCTION get_top_matriculas(
  p_limite     INT  DEFAULT 10,
  p_secretaria TEXT DEFAULT NULL
)
RETURNS TABLE (
  matricula   TEXT,
  ocorrencias BIGINT,
  desconto    NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    matricula,
    COUNT(*)                        AS ocorrencias,
    COALESCE(SUM(percentual_desconto), 0) AS desconto
  FROM previas_frequencia
  WHERE (p_secretaria IS NULL OR secretaria_codigo = p_secretaria)
  GROUP BY matricula
  ORDER BY ocorrencias DESC
  LIMIT p_limite;
$$;


-- Evolução mensal
CREATE OR REPLACE FUNCTION get_evolucao_mensal()
RETURNS TABLE (
  periodo_referencia  TEXT,
  total_ocorrencias   BIGINT,
  servidores_afetados BIGINT,
  desconto_total      NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    periodo_referencia,
    COUNT(*)                        AS total_ocorrencias,
    COUNT(DISTINCT matricula)       AS servidores_afetados,
    COALESCE(SUM(percentual_desconto), 0) AS desconto_total
  FROM previas_frequencia
  GROUP BY periodo_referencia
  ORDER BY periodo_referencia ASC;
$$;


-- ┌─────────────────────────────────────────────────────────┐
-- │  P07 — Conferência Biômetro × Folha                     │
-- └─────────────────────────────────────────────────────────┘
--
-- Notas sobre o join:
--   folha_previas.competencia  → DATE  (YYYY-MM-DD)
--   folha_previas.matricula    → INT
--   previas_frequencia.periodo_referencia → TEXT (YYYY-MM)
--   previas_frequencia.matricula          → TEXT
--
-- A conversão é:
--   to_char(fp.competencia, 'YYYY-MM') = pf.periodo_referencia
--   fp.matricula::TEXT                 = pf.matricula

CREATE OR REPLACE FUNCTION get_conferencia_biometria_folha(
  p_competencia DATE,
  p_secretaria  TEXT DEFAULT NULL
)
RETURNS TABLE (
  matricula             TEXT,
  nome                  TEXT,
  secretaria_sigla      TEXT,
  faltas_ponto          BIGINT,
  atrasos_ponto         BIGINT,
  faltas_folha          INT,
  atrasos_fracao_folha  INT,
  atrasos_dia_folha     INT
)
LANGUAGE sql
STABLE
AS $$
  WITH periodo AS (
    SELECT to_char(p_competencia, 'YYYY-MM') AS mes
  ),
  -- Agrega ocorrências de ponto para o período (sem filtro de secretaria — ponto não tem essa info)
  ponto AS (
    SELECT
      pf.matricula AS mat,
      COUNT(*) FILTER (WHERE pf.codigo_ocorrencia = '171') AS faltas,
      COUNT(*) FILTER (WHERE pf.codigo_ocorrencia = '335') AS atrasos
    FROM previas_frequencia pf
    CROSS JOIN periodo pr
    WHERE pf.periodo_referencia = pr.mes
    GROUP BY pf.matricula
  ),
  -- Secretarias que têm pelo menos um servidor com registro de ponto no período.
  -- Usada para excluir da análise "Todas" as secretarias sem prévia de ponto.
  secs_com_ponto AS (
    SELECT DISTINCT fp.secretaria_sigla
    FROM folha_previas fp
    INNER JOIN ponto p ON fp.matricula::TEXT = p.mat
    WHERE fp.competencia = p_competencia
      AND fp.secretaria_sigla IS NOT NULL
      AND fp.secretaria_sigla <> ''
  ),
  folha AS (
    SELECT
      matricula::TEXT AS mat,
      nome,
      secretaria_sigla,
      faltas,
      atrasos_fracao,
      atrasos_dia
    FROM folha_previas
    WHERE competencia = p_competencia
      -- Filtro de secretaria explícito
      AND (p_secretaria IS NULL OR secretaria_sigla = p_secretaria)
      -- Quando "Todas": excluir secretarias sem nenhum registro de ponto no período
      AND (p_secretaria IS NOT NULL
           OR secretaria_sigla IN (SELECT secretaria_sigla FROM secs_com_ponto))
  )
  SELECT
    COALESCE(f.mat, p.mat)          AS matricula,
    COALESCE(f.nome, '')            AS nome,
    COALESCE(f.secretaria_sigla,'') AS secretaria_sigla,
    COALESCE(p.faltas,  0)          AS faltas_ponto,
    COALESCE(p.atrasos, 0)          AS atrasos_ponto,
    COALESCE(f.faltas,  0)          AS faltas_folha,
    COALESCE(f.atrasos_fracao, 0)   AS atrasos_fracao_folha,
    COALESCE(f.atrasos_dia,    0)   AS atrasos_dia_folha
  FROM folha f
  FULL OUTER JOIN ponto p ON f.mat = p.mat
  WHERE (COALESCE(p.faltas, 0) + COALESCE(p.atrasos, 0) + COALESCE(f.faltas, 0)
       + COALESCE(f.atrasos_fracao, 0) + COALESCE(f.atrasos_dia, 0)) > 0
    -- Quando secretaria específica: não vazar registros de ponto de outras secretarias
    AND (p_secretaria IS NULL OR f.mat IS NOT NULL)
  ORDER BY
    (COALESCE(p.faltas, 0) + COALESCE(f.faltas, 0)) DESC,
    matricula;
$$;


-- ┌─────────────────────────────────────────────────────────┐
-- │  P01 — Criar usuário administrador no Supabase Auth     │
-- │  (Execute via Dashboard > Authentication > Users)       │
-- └─────────────────────────────────────────────────────────┘
--
-- Não é possível criar usuários via SQL diretamente no Supabase Auth.
-- Acesse: Supabase Dashboard → Authentication → Users → Invite user
-- Crie a conta com o e-mail do administrador e defina a senha.
-- Após o login, o usuário terá role "authenticated" e poderá
-- importar folhas e publicar prévias.


-- ┌─────────────────────────────────────────────────────────┐
-- │  Verificação: listar todas as funções criadas           │
-- └─────────────────────────────────────────────────────────┘

SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'republica_previa',
    'get_historico_secretaria',
    'get_top_matriculas',
    'get_evolucao_mensal',
    'get_conferencia_biometria_folha'
  )
ORDER BY routine_name;
