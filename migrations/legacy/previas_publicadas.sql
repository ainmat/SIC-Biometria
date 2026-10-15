-- ==============================================================================
-- DDL: Tabela de Prévias Publicadas
-- Armazena metadados e indicadores consolidados de cada prévia publicada.
-- Execute este script no Supabase SQL Editor antes de usar o Simulador.
-- ==============================================================================

-- Tabela principal de publicações
CREATE TABLE IF NOT EXISTS public.previas_publicadas (
    id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    secretaria_codigo        VARCHAR(10)   NOT NULL,
    secretaria_nome          VARCHAR(100)  NOT NULL,
    competencia              VARCHAR(7)    NOT NULL,       -- YYYY-MM
    data_publicacao          TIMESTAMPTZ   DEFAULT NOW(),
    usuario_responsavel      VARCHAR(100)  DEFAULT 'Sistema',
    total_ocorrencias        INTEGER       DEFAULT 0,
    servidores_impactados    INTEGER       DEFAULT 0,
    total_desconto_acumulado NUMERIC(12,2) DEFAULT 0,
    media_desconto           NUMERIC(5,2)  DEFAULT 0,
    z_score                  NUMERIC(5,2),
    classificacao_alerta     VARCHAR(30),                  -- 'normal' | 'elevado' | 'atencao' | 'anomalia_critica' | 'sem_historico'
    created_at               TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE (secretaria_codigo, competencia)
);

COMMENT ON TABLE public.previas_publicadas IS 'Metadados e indicadores de prévias de frequência publicadas pelo Simulador.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_pub_secretaria ON public.previas_publicadas (secretaria_codigo);
CREATE INDEX IF NOT EXISTS idx_pub_competencia ON public.previas_publicadas (competencia DESC);

-- RLS
ALTER TABLE public.previas_publicadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura pública" ON public.previas_publicadas FOR SELECT USING (true);
CREATE POLICY "Inserção pública" ON public.previas_publicadas FOR INSERT WITH CHECK (true);
CREATE POLICY "Atualização pública" ON public.previas_publicadas FOR UPDATE USING (true);
CREATE POLICY "Deleção pública" ON public.previas_publicadas FOR DELETE USING (true);


-- ==============================================================================
-- ALTER: Tornar colunas de previas_frequencia opcionais
-- Necessário para compatibilidade com o parser legado (apenas matrícula + percentual)
-- Execute somente se a tabela previas_frequencia já existir.
-- ==============================================================================

ALTER TABLE public.previas_frequencia ALTER COLUMN data_ocorrencia    DROP NOT NULL;
ALTER TABLE public.previas_frequencia ALTER COLUMN codigo_ocorrencia  DROP NOT NULL;
