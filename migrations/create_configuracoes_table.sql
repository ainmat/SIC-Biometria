CREATE TABLE IF NOT EXISTS configuracoes (
    chave VARCHAR(50) PRIMARY KEY,
    valor TEXT NOT NULL,
    descricao TEXT
);

-- Ative o RLS (Row Level Security) mas permita leitura para autenticados
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de configuracoes para usuarios autenticados" 
ON configuracoes FOR SELECT 
TO authenticated 
USING (true);

-- Insira a chave da API do Gemini abaixo (substitua SUA_CHAVE_AQUI pela chave real)
-- E então rode este script no SQL Editor do Supabase
INSERT INTO configuracoes (chave, valor, descricao) 
VALUES ('gemini_api_key', 'SUA_CHAVE_AQUI', 'Chave de API do Google Gemini para IA')
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;
