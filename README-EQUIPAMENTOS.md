# Como Criar a Tabela de Equipamentos no Supabase

## Passo 1: Acessar o Supabase

1. Faça login no [painel do Supabase](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para a seção **SQL Editor**

## Passo 2: Executar o Script SQL

1. Clique em **"New query"**
2. Copie e cole o conteúdo do arquivo `create_equipamentos_table.sql`
3. Clique em **"Run"** para executar o script

## Estrutura da Tabela

A tabela `equipamentos` terá os seguintes campos:

| Campo | Tipo | Descrição |
|-------|------|----------|
| id | BIGINT | ID único (auto-incremento) |
| nome | VARCHAR(255) | Nome do equipamento |
| tipo | VARCHAR(100) | Tipo (Catraca, Leitor Facial, etc.) |
| localizacao | VARCHAR(255) | Local de instalação |
| status | VARCHAR(20) | Status (active, maintenance, inactive) |
| data_instalacao | DATE | Data de instalação |
| data_ultima_manutencao | DATE | Data da última manutenção |
| modelo | VARCHAR(100) | Modelo do equipamento |
| numero_serie | VARCHAR(100) | Número de série (único) |
| descricao | TEXT | Descrição adicional |
| secretaria | VARCHAR(100) | Secretaria responsável |
| responsavel | VARCHAR(100) | Responsável pelo equipamento |
| created_at | TIMESTAMP | Data de criação |
| updated_at | TIMESTAMP | Data de atualização |

## Passo 3: Configurar Variáveis de Ambiente

Certifique-se de que seu arquivo `.env` contenha as credenciais do Supabase:

```env
VITE_SUPABASE_URL=seu_supabase_url
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

## Passo 4: Importar Dados da Planilha (Opcional)

Se você tem uma planilha Excel com dados existentes, você pode:

1. Exportar a planilha como CSV
2. Importar o CSV através do **Table Editor** do Supabase
3. Ou usar a função `loadEquipmentFromExcel()` que será implementada futuramente

## Campos Obrigatórios

Os seguintes campos são obrigatórios:
- `nome`
- `tipo`
- `localizacao`
- `status`
- `data_instalacao`

## Validações

- O campo `status` só aceita os valores: `active`, `maintenance`, `inactive`
- O campo `numero_serie` deve ser único
- Datas devem estar no formato YYYY-MM-DD

## Segurança

- RLS (Row Level Security) está habilitado
- Políticas de acesso configuradas para usuários autenticados
- Todos os dados são sanitizados automaticamente

## Teste

Após criar a tabela, você pode testar acessando:
`http://localhost:5173/parque-equipamentos.html`

A página irá:
1. Carregar os dados do banco de dados
2. Exibir os equipamentos em cards
3. Permitir filtragem e busca
4. Atualizar em tempo real se houver alterações

## Solução de Problemas

### Erro de conexão
- Verifique as credenciais no arquivo `.env`
- Confirme que o projeto Supabase está ativo

### Tabela não encontrada
- Verifique se o script SQL foi executado sem erros
- Confirme o nome da tabela está exatamente `equipamentos`

### Dados não aparecem
- Verifique o console do navegador para erros
- Confirme que há dados na tabela através do Table Editor do Supabase
