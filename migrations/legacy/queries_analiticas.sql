-- ==============================================================================
-- Queries Analíticas para Relatórios, BI e Detecção de Anomalias (Z-Score)
-- Nome do Arquivo: queries_analiticas.sql
-- Localização: Raiz do projeto
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. CONSULTA DE SUPORTE AO FRONTEND: Histórico para Cálculo de Z-Score
-- Esta query retorna a contagem de ocorrências dos últimos 3 meses anteriores ao
-- período de referência selecionado para uma determinada secretaria.
-- Usado pelo frontend para alimentar a função `calcularZScore`.
-- ------------------------------------------------------------------------------
SELECT 
    periodo_referencia, 
    COUNT(*) AS total_ocorrencias
FROM public.previas_frequencia
WHERE secretaria_codigo = '589' -- Substituir dinamicamente via parâmetro
  AND periodo_referencia < '2025-12' -- Período atual a ser analisado (exclui ele mesmo)
GROUP BY periodo_referencia
ORDER BY periodo_referencia DESC
LIMIT 3;


-- ------------------------------------------------------------------------------
-- 2. PAINEL DE ANOMALIAS GLOBAL: Cálculo de Z-Score Nativo no Banco de Dados
-- Esta query calcula de forma dinâmica o Z-Score de cada lote (secretaria + período)
-- utilizando funções de janela (window functions) para obter a média e o desvio
-- padrão amostral (STDDEV_SAMP) das ocorrências nos 3 meses anteriores.
-- Ideal para conectar diretamente a ferramentas de BI (Looker Studio, Power BI, Metabase).
-- ------------------------------------------------------------------------------
WITH historico_lotes AS (
    -- Etapa 1: Agrupa e sumariza dados por secretaria e período de referência
    SELECT
        secretaria_codigo,
        periodo_referencia,
        COUNT(*) AS total_ocorrencias,
        COUNT(DISTINCT matricula) AS servidores_afetados,
        SUM(percentual_desconto) AS desconto_acumulado,
        ROUND(AVG(percentual_desconto), 1) AS media_desconto_individual
    FROM public.previas_frequencia
    GROUP BY secretaria_codigo, periodo_referencia
),
estatisticas_moveis AS (
    -- Etapa 2: Calcula a média móvel e o desvio padrão móvel dos 3 meses anteriores
    SELECT
        secretaria_codigo,
        periodo_referencia,
        total_ocorrencias,
        servidores_afetados,
        desconto_acumulado,
        media_desconto_individual,
        -- Média móvel dos 3 meses anteriores (exclui o mês atual)
        AVG(total_ocorrencias) OVER (
            PARTITION BY secretaria_codigo
            ORDER BY periodo_referencia
            ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING
        ) AS media_historica_3m,
        -- Desvio padrão amostral dos 3 meses anteriores (exclui o mês atual)
        STDDEV_SAMP(total_ocorrencias) OVER (
            PARTITION BY secretaria_codigo
            ORDER BY periodo_referencia
            ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING
        ) AS desvio_padrao_3m,
        -- Quantidade de períodos anteriores disponíveis (mínimo 2 necessários para Z-Score confiável)
        COUNT(total_ocorrencias) OVER (
            PARTITION BY secretaria_codigo
            ORDER BY periodo_referencia
            ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING
        ) AS meses_historico_disponiveis
    FROM historico_lotes
)
-- Etapa 3: Calcula o Z-Score e classifica a anomalia conforme o threshold
SELECT
    secretaria_codigo,
    periodo_referencia,
    total_ocorrencias,
    servidores_afetados,
    desconto_acumulado,
    media_desconto_individual,
    ROUND(media_historica_3m::numeric, 1) AS media_historica_3m,
    ROUND(desvio_padrao_3m::numeric, 2) AS desvio_padrao_3m,
    -- Z-Score só é calculado se houver desvio padrão válido e no mínimo 2 meses de histórico
    CASE
        WHEN desvio_padrao_3m = 0 OR desvio_padrao_3m IS NULL OR meses_historico_disponiveis < 2 THEN NULL
        ELSE ROUND(((total_ocorrencias - media_historica_3m) / desvio_padrao_3m)::numeric, 2)
    END AS z_score,
    -- Classificação de Alerta baseada no desvio padrão (Z-Score >= 2.0 é Anomalia Crítica)
    CASE
        WHEN meses_historico_disponiveis < 2 THEN 'Sem Histórico Suficiente'
        WHEN desvio_padrao_3m = 0 THEN 'Desvio Padrão Zero'
        WHEN ((total_ocorrencias - media_historica_3m) / desvio_padrao_3m) >= 2.0 THEN '🚨 ANOMALIA CRÍTICA'
        WHEN ((total_ocorrencias - media_historica_3m) / desvio_padrao_3m) >= 1.5 THEN '⚠️ ATENÇÃO'
        ELSE '✅ NORMAL'
    END AS classificacao_alerta
FROM estatisticas_moveis
ORDER BY secretaria_codigo, periodo_referencia DESC;


-- ------------------------------------------------------------------------------
-- 3. RANKING DE SECRETARIAS POR VOLUME E DESCONTO ACUMULADO
-- Permite identificar quais secretarias demandam maior atenção ou possuem 
-- maior impacto no orçamento público por conta dos apontamentos de frequência.
-- ------------------------------------------------------------------------------
SELECT
    secretaria_codigo,
    COUNT(*) AS total_ocorrencias,
    COUNT(DISTINCT matricula) AS servidores_afetados,
    SUM(percentual_desconto) AS total_descontos_percentuais,
    ROUND(AVG(percentual_desconto), 2) AS media_desconto_por_ocorrencia,
    COUNT(DISTINCT periodo_referencia) AS total_meses_com_registro,
    MAX(periodo_referencia) AS ultimo_periodo_importado
FROM public.previas_frequencia
GROUP BY secretaria_codigo
ORDER BY total_ocorrencias DESC, total_descontos_percentuais DESC;


-- ------------------------------------------------------------------------------
-- 4. DETECÇÃO DE CASOS EXTREMOS (Servidores com Altos Descontos no Mês)
-- Retorna os servidores que acumularam descontos expressivos em um único mês.
-- Útil para auditorias internas de folhas de pagamento a fim de evitar descontos indevidos.
-- ------------------------------------------------------------------------------
SELECT
    periodo_referencia,
    secretaria_codigo,
    matricula,
    COUNT(*) AS qtd_ocorrencias,
    SUM(percentual_desconto) AS total_desconto_acumulado,
    STRING_AGG(DISTINCT codigo_ocorrencia, ', ') AS codigos_ocorrencias,
    STRING_AGG(TO_CHAR(data_ocorrencia, 'DD/MM/YYYY'), ', ' ORDER BY data_ocorrencia) AS datas_ocorrencias
FROM public.previas_frequencia
GROUP BY periodo_referencia, secretaria_codigo, matricula
HAVING SUM(percentual_desconto) >= 50 -- Filtra servidores com 50% ou mais de desconto acumulado
ORDER BY total_desconto_acumulado DESC, qtd_ocorrencias DESC;


-- ------------------------------------------------------------------------------
-- 5. EVOLUÇÃO TEMPORAL MENSAL (Consolidado para Gráficos de BI)
-- Retorna a evolução mensal agregada de todas as secretarias. Utilizada para
-- alimentar gráficos de linha ou de barras demonstrando a variação de faltas/atrasos.
-- ------------------------------------------------------------------------------
SELECT
    periodo_referencia,
    COUNT(DISTINCT secretaria_codigo) AS secretarias_ativas,
    COUNT(*) AS total_ocorrencias,
    COUNT(DISTINCT matricula) AS total_servidores_afetados,
    SUM(percentual_desconto) AS soma_desconto_acumulado,
    ROUND(AVG(percentual_desconto), 2) AS media_desconto_geral
FROM public.previas_frequencia
GROUP BY periodo_referencia
ORDER BY periodo_referencia ASC;
