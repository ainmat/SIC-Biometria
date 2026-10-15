-- ==============================================================================
-- DDL para criação da tabela de Prévias de Frequência no Supabase
-- Nome do Arquivo: previas_frequencia.sql
-- Localização: Raiz do projeto
-- ==============================================================================

-- 1. Criação da tabela principal
CREATE TABLE IF NOT EXISTS public.previas_frequencia (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    periodo_referencia  VARCHAR(7)   NOT NULL,  -- Formato: 'YYYY-MM' (ex: '2025-12')
    secretaria_codigo   VARCHAR(10)  NOT NULL,  -- Código da secretaria (ex: '589')
    matricula           VARCHAR(10)  NOT NULL,  -- Matrícula do servidor (ex: '123456')
    data_ocorrencia     DATE         NOT NULL,  -- Data em que a ocorrência foi registrada
    codigo_ocorrencia   VARCHAR(5)   NOT NULL,  -- Código da ocorrência (ex: '101')
    percentual_desconto INTEGER      NOT NULL CHECK (percentual_desconto BETWEEN 0 AND 100), -- Desconto em folha
    created_at          TIMESTAMPTZ  DEFAULT NOW() -- Data de inserção do registro
);

-- Adicionar comentários explicativos para a tabela e colunas
COMMENT ON TABLE public.previas_frequencia IS 'Tabela que armazena os apontamentos brutos das prévias de frequência para análise de anomalias.';
COMMENT ON COLUMN public.previas_frequencia.periodo_referencia IS 'Período de referência da folha no formato YYYY-MM.';
COMMENT ON COLUMN public.previas_frequencia.secretaria_codigo IS 'Código numérico identificador da secretaria de origem.';
COMMENT ON COLUMN public.previas_frequencia.matricula IS 'Matrícula identificadora do servidor público.';
COMMENT ON COLUMN public.previas_frequencia.data_ocorrencia IS 'Data efetiva do registro do apontamento de frequência.';
COMMENT ON COLUMN public.previas_frequencia.codigo_ocorrencia IS 'Código de identificação da ocorrência (atraso, falta, etc.).';
COMMENT ON COLUMN public.previas_frequencia.percentual_desconto IS 'Percentual a ser descontado na folha de pagamento (de 0 a 100).';

-- 2. Índices de performance para otimização de queries analíticas
-- Índice composto para buscas agregadas por secretaria e período (usado no cálculo de Z-Score)
CREATE INDEX IF NOT EXISTS idx_previas_secretaria_periodo 
    ON public.previas_frequencia (secretaria_codigo, periodo_referencia);

-- Índice individual para filtros rápidos por período
CREATE INDEX IF NOT EXISTS idx_previas_periodo 
    ON public.previas_frequencia (periodo_referencia);

-- Índice individual para busca rápida por matrícula de servidor
CREATE INDEX IF NOT EXISTS idx_previas_matricula 
    ON public.previas_frequencia (matricula);


-- ==============================================================================
-- CONTROLE DE ACESSO & SEGURANÇA (Row Level Security - RLS)
-- ==============================================================================

-- Habilitar RLS (Row Level Security) na tabela
ALTER TABLE public.previas_frequencia ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Opção A: Acesso Público Simples (Recomendado se o dashboard utilizar a chave anon pública direto)
-- ------------------------------------------------------------------------------
CREATE POLICY "Permitir leitura para todos" 
    ON public.previas_frequencia 
    FOR SELECT 
    USING (true);

CREATE POLICY "Permitir inserção para todos" 
    ON public.previas_frequencia 
    FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Permitir deleção para todos" 
    ON public.previas_frequencia 
    FOR DELETE 
    USING (true);

-- ------------------------------------------------------------------------------
-- Opção B: Acesso Restrito a Usuários Autenticados (Remova os comentários abaixo se usar auth)
-- ------------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "Permitir leitura para todos" ON public.previas_frequencia;
-- DROP POLICY IF EXISTS "Permitir inserção para todos" ON public.previas_frequencia;
-- DROP POLICY IF EXISTS "Permitir deleção para todos" ON public.previas_frequencia;

-- CREATE POLICY "Permitir leitura para usuários autenticados" 
--     ON public.previas_frequencia 
--     FOR SELECT 
--     TO authenticated 
--     USING (true);

-- CREATE POLICY "Permitir inserção para usuários autenticados" 
--     ON public.previas_frequencia 
--     FOR INSERT 
--     TO authenticated 
--     WITH CHECK (true);

-- CREATE POLICY "Permitir deleção para usuários autenticados" 
--     ON public.previas_frequencia 
--     FOR DELETE 
--     TO authenticated 
--     USING (true);
