-- ====================================================================
-- Migração: Suporte a Múltiplos Anexos nos Protocolos
-- Cria a tabela protocolo_anexos e o bucket no Storage
-- ====================================================================

-- 1. Criar tabela protocolo_anexos
CREATE TABLE IF NOT EXISTS protocolo_anexos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  protocolo_id BIGINT NOT NULL REFERENCES protocolo_digital(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  caminho_storage TEXT NOT NULL,
  tamanho_bytes INT NOT NULL,
  tipo_mime TEXT NOT NULL,
  enviado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE protocolo_anexos ENABLE ROW LEVEL SECURITY;

-- Como as operações de protocolo permitem acesso anônimo (com controle na aplicação),
-- abrimos o acesso aos anexos de forma análoga.
CREATE POLICY "anexos_read_public" ON protocolo_anexos FOR SELECT USING (true);
CREATE POLICY "anexos_insert_public" ON protocolo_anexos FOR INSERT WITH CHECK (true);
CREATE POLICY "anexos_delete_public" ON protocolo_anexos FOR DELETE USING (true);

-- 2. Criar Bucket no Supabase Storage
-- Nota: Caso receba erro de permissão ao rodar esta parte, crie o bucket manualmente 
-- no painel do Supabase com o nome "protocolos" e deixe-o como Público.
INSERT INTO storage.buckets (id, name, public)
VALUES ('protocolos', 'protocolos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de Segurança do Storage
-- Permitir select e insert irrestrito (o frontend faz o filtro)
CREATE POLICY "Storage - Leitura Publica Protocolos" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'protocolos');

CREATE POLICY "Storage - Escrita Publica Protocolos" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'protocolos');

CREATE POLICY "Storage - Delete Publica Protocolos" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'protocolos');
