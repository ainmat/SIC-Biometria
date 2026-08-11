-- Apenas a atualização da Função RPC (Lógica Set-Based ultra-rápida)
-- As colunas já foram criadas na primeira vez.

-- 1. Função para Upsert em Lotes (chamada várias vezes)
CREATE OR REPLACE FUNCTION sincronizar_servidores_batch_rpc(p_servidores JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Atualização em Lote (UPDATE Set-based) preservando dados antigos se vier NULL
    UPDATE funcionarios_infos f
    SET
        "Nome_Funcionario" = COALESCE(NULLIF(s.value->>'Nome_Funcionario', ''), f."Nome_Funcionario"),
        "Des_Contrato" = COALESCE(NULLIF(s.value->>'Des_Contrato', ''), f."Des_Contrato"),
        "Idade" = COALESCE(NULLIF(s.value->>'Idade', '')::INT, f."Idade"),
        "Sexo" = COALESCE(NULLIF(s.value->>'Sexo', ''), f."Sexo"),
        "Des_GrInstrucao" = COALESCE(NULLIF(s.value->>'Des_GrInstrucao', ''), f."Des_GrInstrucao"),
        "Des_Cargo" = COALESCE(NULLIF(s.value->>'Des_Cargo', ''), f."Des_Cargo"),
        "Des_LocalTrab" = COALESCE(NULLIF(s.value->>'Des_LocalTrab', ''), f."Des_LocalTrab"),
        "Des_Secretaria" = COALESCE(NULLIF(s.value->>'Des_Secretaria', ''), f."Des_Secretaria"),
        "SiglaSec" = COALESCE(NULLIF(s.value->>'SiglaSec', ''), f."SiglaSec"),
        "ativo" = true
    FROM jsonb_array_elements(p_servidores) AS s(value)
    WHERE f."Matricula" = (s.value->>'Matricula')::BIGINT 
      AND f."Con" = (s.value->>'Con')::INT;

    -- Inserção em Lote (INSERT Set-based) para quem não existe
    INSERT INTO funcionarios_infos (
        "Matricula", "Nome_Funcionario", "Con", "Pr", "Des_Contrato",
        "Idade", "Sexo", "CdGrIns", "Des_GrInstrucao", "DtNomeacao",
        "DtPosse", "DtAdmissao", "DtIniExerc", "DtIniExerc_Exten",
        "CdRegTrab", "Des_RegTrab", "CdCargo", "SigCargo", "Des_Cargo",
        "CatSefip", "Des_CategSefip", "CdPadrao_Adm", "Des_Padrao_Adm",
        "HrSem", "CdLocal", "Des_LocalTrab", "CdCusteio", "Des_Custeio",
        "CdSecret", "Des_Secretaria", "SiglaSec", "Des_Horario",
        "Tempo_Contrato_Anos", "Tempo_Contrato_Dias", "Tempo_Contrato_Extenso",
        "Data_Formatada", "Data_Geracao", "Hora_Geracao", "idug",
        "ativo"
    )
    SELECT 
        (s.value->>'Matricula')::BIGINT, s.value->>'Nome_Funcionario', (s.value->>'Con')::INT, s.value->>'Pr', s.value->>'Des_Contrato',
        (s.value->>'Idade')::INT, s.value->>'Sexo', (s.value->>'CdGrIns')::INT, s.value->>'Des_GrInstrucao', s.value->>'DtNomeacao',
        s.value->>'DtPosse', s.value->>'DtAdmissao', s.value->>'DtIniExerc', s.value->>'DtIniExerc_Exten',
        (s.value->>'CdRegTrab')::INT, s.value->>'Des_RegTrab', (s.value->>'CdCargo')::INT, s.value->>'SigCargo', s.value->>'Des_Cargo',
        (s.value->>'CatSefip')::INT, s.value->>'Des_CategSefip', (s.value->>'CdPadrao_Adm')::INT, s.value->>'Des_Padrao_Adm',
        (s.value->>'HrSem')::INT, (s.value->>'CdLocal')::INT, s.value->>'Des_LocalTrab', s.value->>'CdCusteio', s.value->>'Des_Custeio',
        s.value->>'CdSecret', s.value->>'Des_Secretaria', s.value->>'SiglaSec', s.value->>'Des_Horario',
        (s.value->>'Tempo_Contrato_Anos')::INT, (s.value->>'Tempo_Contrato_Dias')::INT, s.value->>'Tempo_Contrato_Extenso',
        s.value->>'Data_Formatada', s.value->>'Data_Geracao', s.value->>'Hora_Geracao', (s.value->>'idug')::INT,
        true
    FROM jsonb_array_elements(p_servidores) AS s(value)
    WHERE NOT EXISTS (
        SELECT 1 FROM funcionarios_infos f 
        WHERE f."Matricula" = (s.value->>'Matricula')::BIGINT 
          AND f."Con" = (s.value->>'Con')::INT
    );
END;
$$;

-- 2. Função para Inativar quem não veio na lista (recebe um JSON menor só com as matrículas)
CREATE OR REPLACE FUNCTION inativar_servidores_ausentes_rpc(p_matriculas JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_inativados INT := 0;
BEGIN
    CREATE TEMP TABLE IF NOT EXISTS temp_ativas (
        matricula BIGINT,
        con INT
    ) ON COMMIT DROP;

    TRUNCATE TABLE temp_ativas;

    INSERT INTO temp_ativas (matricula, con)
    SELECT 
        (value->>'Matricula')::BIGINT, 
        (value->>'Con')::INT
    FROM jsonb_array_elements(p_matriculas);

    WITH inativados AS (
        UPDATE funcionarios_infos f
        SET ativo = false
        WHERE NOT EXISTS (
            SELECT 1 FROM temp_ativas t 
            WHERE t.matricula = f."Matricula" AND t.con = f."Con"
        )
        AND f.ativo = true
        RETURNING f."Matricula"
    )
    SELECT count(*) INTO v_total_inativados FROM inativados;

    RETURN v_total_inativados;
END;
$$;
