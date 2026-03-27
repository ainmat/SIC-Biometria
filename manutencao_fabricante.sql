-- Script de manutenção para a coluna fabricante
-- Use este script para atualizar ou verificar dados de fabricantes

-- 1. Verificar distribuição atual de fabricantes
SELECT 
  fabricante,
  COUNT(*) as total,
  STRING_AGG(id::text, ', ' ORDER BY id) as ids
FROM equipamentos 
GROUP BY fabricante 
ORDER BY total DESC;

-- 2. Atualizar fabricante de equipamentos específicos (exemplo)
-- UPDATE equipamentos SET fabricante = 'Control ID' WHERE id = X;
-- UPDATE equipamentos SET fabricante = 'Tommi' WHERE id = Y;

-- 3. Encontrar equipamentos sem fabricante definido
SELECT id, nome, modelo, localizacao 
FROM equipamentos 
WHERE fabricante IS NULL OR fabricante = '';

-- 4. Atualizar fabricante baseado em padrões de nome/modelo
UPDATE equipamentos 
SET fabricante = 'Control ID' 
WHERE fabricante IN ('Outros', 'Não identificado', '')
AND (
  LOWER(nome) LIKE '%control id%' 
  OR LOWER(modelo) LIKE '%control id%'
  OR LOWER(nome) LIKE '%biogate%'
  OR LOWER(modelo) LIKE '%biogate%'
  OR LOWER(nome) LIKE '%faceid%'
  OR LOWER(modelo) LIKE '%faceid%'
);

UPDATE equipamentos 
SET fabricante = 'Tommi' 
WHERE fabricante IN ('Outros', 'Não identificado', '')
AND (
  LOWER(nome) LIKE '%tommi%' 
  OR LOWER(modelo) LIKE '%tommi%'
);

-- 5. Verificar quais módulos ainda não têm fabricante definido
SELECT 
  id,
  nome,
  modelo,
  CASE 
    WHEN id BETWEEN 11 AND 16 THEN 'Deveria ser Tommi'
    WHEN id BETWEEN 17 AND 21 THEN 'Deveria ser Control ID'
    ELSE 'Verificar manualmente'
  END as sugestao
FROM equipamentos 
WHERE fabricante IS NULL OR fabricante = ''
ORDER BY id;
