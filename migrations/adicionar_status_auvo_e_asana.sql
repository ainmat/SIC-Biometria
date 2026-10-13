-- ==============================================================================
-- Migração: Separação de Status entre AUVO e ASANA
-- Arquivo: migrations/adicionar_status_auvo_e_asana.sql
-- ==============================================================================

-- 1. Adicionar colunas para rastrear status e seção independentemente
ALTER TABLE public.chamados 
ADD COLUMN IF NOT EXISTS status_auvo VARCHAR(50),
ADD COLUMN IF NOT EXISTS status_asana VARCHAR(50),
ADD COLUMN IF NOT EXISTS secao_asana VARCHAR(100);

-- 2. Inicializar status_auvo com o status atual histórico de todos os chamados
UPDATE public.chamados 
SET status_auvo = COALESCE(status, 'Aguardando Atendimento')
WHERE status_auvo IS NULL;

-- 3. Criar índices para otimizar filtros no Dashboard e nas rotinas de sincronização
CREATE INDEX IF NOT EXISTS idx_chamados_status_auvo ON public.chamados(status_auvo);
CREATE INDEX IF NOT EXISTS idx_chamados_status_asana ON public.chamados(status_asana);
CREATE INDEX IF NOT EXISTS idx_chamados_secao_asana ON public.chamados(secao_asana);
