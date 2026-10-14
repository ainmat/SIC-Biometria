-- ==============================================================================
-- Migração: Adicionar Histórico de Tramitação e Comentários aos Chamados
-- Arquivo: migrations/adicionar_historico_chamados.sql
-- ==============================================================================

-- 1. Adicionar coluna historico_tramitacao na tabela chamados
ALTER TABLE public.chamados 
ADD COLUMN IF NOT EXISTS historico_tramitacao JSONB DEFAULT '[]'::jsonb;

-- 2. Criar índice GIN para performance em consultas no histórico JSONB
CREATE INDEX IF NOT EXISTS idx_chamados_historico ON public.chamados USING gin (historico_tramitacao);
