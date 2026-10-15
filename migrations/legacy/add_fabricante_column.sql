-- Script para adicionar coluna fabricante na tabela equipamentos
-- e popular com dados existentes baseados nos módulos

-- 1. Adicionar coluna fabricante à tabela equipamentos
ALTER TABLE equipamentos 
ADD COLUMN fabricante VARCHAR(50);

-- 2. Popular coluna fabricante baseado nos módulos existentes
-- Módulos Tommi: 11, 12, 13, 14, 15, 16
UPDATE equipamentos 
SET fabricante = 'Tommi' 
WHERE id IN (11, 12, 13, 14, 15, 16);

-- Módulos Control ID: 17, 18, 19, 20, 21
UPDATE equipamentos 
SET fabricante = 'Control ID' 
WHERE id IN (17, 18, 19, 20, 21);

-- 3. Para equipamentos sem módulo definido, tentar identificar pelo nome/modelo
UPDATE equipamentos 
SET fabricante = 'Control ID' 
WHERE fabricante IS NULL 
AND (
  LOWER(nome) LIKE '%control id%' 
  OR LOWER(modelo) LIKE '%control id%'
  OR LOWER(modelo) LIKE '%biogate%'
  OR LOWER(modelo) LIKE '%faceid%'
  OR LOWER(modelo) LIKE '%digitalscan%'
);

UPDATE equipamentos 
SET fabricante = 'Tommi' 
WHERE fabricante IS NULL 
AND (
  LOWER(nome) LIKE '%tommi%' 
  OR LOWER(modelo) LIKE '%tommi%'
);

-- 4. Para os demais, marcar como 'Outros'
UPDATE equipamentos 
SET fabricante = 'Outros' 
WHERE fabricante IS NULL;

-- 5. Adicionar restrição NOT NULL após popular dados
ALTER TABLE equipamentos 
ALTER COLUMN fabricante SET NOT NULL;

-- 6. Criar índice para melhor performance em joins
CREATE INDEX idx_equipamentos_fabricante ON equipamentos(fabricante);

-- 7. Verificar resultado
SELECT 
  fabricante,
  COUNT(*) as total_equipamentos,
  STRING_AGG(id::text, ', ' ORDER BY id) as equipamentos_ids
FROM equipamentos 
GROUP BY fabricante 
ORDER BY fabricante;
