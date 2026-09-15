-- ==============================================================================
-- Migração: Permitir o status 'Aguardando Retorno' na tabela protocolo_digital
-- ==============================================================================

-- 1. Remove a restrição CHECK antiga que aceitava apenas ('Aberto', 'Em Análise', 'Concluído')
ALTER TABLE IF EXISTS protocolo_digital 
DROP CONSTRAINT IF EXISTS protocolo_digital_status_check;

-- 2. Recria a restrição CHECK incluindo 'Aguardando Retorno'
ALTER TABLE IF EXISTS protocolo_digital 
ADD CONSTRAINT protocolo_digital_status_check 
CHECK (status IN ('Aberto', 'Em Análise', 'Aguardando Retorno', 'Concluído'));
