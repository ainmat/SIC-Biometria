-- 1. Adicionar coluna 'ativo' (caso não exista)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'funcionarios_infos' AND column_name = 'ativo'
    ) THEN
        ALTER TABLE funcionarios_infos ADD COLUMN ativo BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 2. Atualizar todos os registros existentes para ativo = true por padrão (carga inicial)
UPDATE funcionarios_infos SET ativo = true WHERE ativo IS NULL;

-- 3. Criar função RPC para sincronizar os servidores
-- Esta função recebe um array de JSON com os servidores ativos da nova planilha.
-- Ela faz o upsert (insere/atualiza) e marca como ativo = false os que não vieram na lista.
CREATE OR REPLACE FUNCTION sincronizar_servidores_rpc(p_servidores JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_recebidos INT := 0;
    v_total_inativados INT := 0;
    v_servidor JSONB;
BEGIN
    -- Obter total de servidores recebidos
    v_total_recebidos := jsonb_array_length(p_servidores);

    -- 1. Criar tabela temporária com as matrículas recebidas
    CREATE TEMP TABLE IF NOT EXISTS temp_matriculas_recebidas (
        matricula BIGINT,
        con INT
    ) ON COMMIT DROP;

    -- Limpar caso já exista na mesma sessão
    TRUNCATE TABLE temp_matriculas_recebidas;

    -- 2. Inserir/Atualizar os servidores recebidos
    FOR v_servidor IN SELECT * FROM jsonb_array_elements(p_servidores)
    LOOP
        -- Inserir na tabela temporária para controle
        INSERT INTO temp_matriculas_recebidas (matricula, con) 
        VALUES ((v_servidor->>'Matricula')::BIGINT, (v_servidor->>'Con')::INT);

        -- Verifica se o servidor já existe (pela matrícula e contrato)
        IF EXISTS (SELECT 1 FROM funcionarios_infos WHERE "Matricula" = (v_servidor->>'Matricula')::BIGINT AND "Con" = (v_servidor->>'Con')::INT) THEN
            -- Atualiza dados do servidor existente
            UPDATE funcionarios_infos SET
                "Nome_Funcionario" = v_servidor->>'Nome_Funcionario',
                "Des_Contrato" = v_servidor->>'Des_Contrato',
                "Idade" = (v_servidor->>'Idade')::INT,
                "Sexo" = v_servidor->>'Sexo',
                "Des_GrInstrucao" = v_servidor->>'Des_GrInstrucao',
                "Des_Cargo" = v_servidor->>'Des_Cargo',
                "Des_LocalTrab" = v_servidor->>'Des_LocalTrab',
                "Des_Secretaria" = v_servidor->>'Des_Secretaria',
                "SiglaSec" = v_servidor->>'SiglaSec',
                "ativo" = true
            WHERE "Matricula" = (v_servidor->>'Matricula')::BIGINT AND "Con" = (v_servidor->>'Con')::INT;
        ELSE
            -- Insere novo servidor
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
            ) VALUES (
                (v_servidor->>'Matricula')::BIGINT, v_servidor->>'Nome_Funcionario', (v_servidor->>'Con')::INT, v_servidor->>'Pr', v_servidor->>'Des_Contrato',
                (v_servidor->>'Idade')::INT, v_servidor->>'Sexo', (v_servidor->>'CdGrIns')::INT, v_servidor->>'Des_GrInstrucao', v_servidor->>'DtNomeacao',
                v_servidor->>'DtPosse', v_servidor->>'DtAdmissao', v_servidor->>'DtIniExerc', v_servidor->>'DtIniExerc_Exten',
                (v_servidor->>'CdRegTrab')::INT, v_servidor->>'Des_RegTrab', (v_servidor->>'CdCargo')::INT, v_servidor->>'SigCargo', v_servidor->>'Des_Cargo',
                (v_servidor->>'CatSefip')::INT, v_servidor->>'Des_CategSefip', (v_servidor->>'CdPadrao_Adm')::INT, v_servidor->>'Des_Padrao_Adm',
                (v_servidor->>'HrSem')::INT, (v_servidor->>'CdLocal')::INT, v_servidor->>'Des_LocalTrab', v_servidor->>'CdCusteio', v_servidor->>'Des_Custeio',
                v_servidor->>'CdSecret', v_servidor->>'Des_Secretaria', v_servidor->>'SiglaSec', v_servidor->>'Des_Horario',
                (v_servidor->>'Tempo_Contrato_Anos')::INT, (v_servidor->>'Tempo_Contrato_Dias')::INT, v_servidor->>'Tempo_Contrato_Extenso',
                v_servidor->>'Data_Formatada', v_servidor->>'Data_Geracao', v_servidor->>'Hora_Geracao', (v_servidor->>'idug')::INT,
                true
            );
        END IF;
    END LOOP;

    -- 3. Inativar quem NÃO está na lista recebida
    WITH inativados AS (
        UPDATE funcionarios_infos f
        SET ativo = false
        WHERE NOT EXISTS (
            SELECT 1 FROM temp_matriculas_recebidas t 
            WHERE t.matricula = f."Matricula" AND t.con = f."Con"
        )
        AND f.ativo = true
        RETURNING f."Matricula"
    )
    SELECT count(*) INTO v_total_inativados FROM inativados;

    RETURN jsonb_build_object(
        'sucesso', true,
        'total_processados', v_total_recebidos,
        'total_inativados', v_total_inativados
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'sucesso', false,
        'erro', SQLERRM
    );
END;
$$;
