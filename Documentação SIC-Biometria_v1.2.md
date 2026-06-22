# SIC-Biometria — Prefeitura de Osasco — Versão 1.2

## PREFEITURA MUNICIPAL DE OSASCO
### Setor de Biometria Facial
### Documentação Técnica
### Sistema de Inteligência de Chamados
### SIC-Biometria
### Versão 1.2 — Março de 2026
### Autor: Mateus Carvalho | Status: Em Produção

## 1. Sumário Executivo

O SIC-Biometria é uma solução de Data Pipeline e Observabilidade projetada para automatizar a gestão de incidentes técnicos do parque de equipamentos de biometria facial da Prefeitura de Osasco.

O sistema realiza a ingestão de dados estruturados através de planilhas semanais de chamados, processa-os através de Inteligência Artificial e disponibiliza métricas estratégicas em um Dashboard Realtime para apoio à decisão da gestão municipal.

O projeto opera integralmente em camadas gratuitas (Free Tier), sem custo algum para a prefeitura.

## 2. Arquitetura do Sistema

O sistema segue o modelo de Event-Driven Pipeline, onde cada etapa é disparada automaticamente pela anterior.

### 2.1 Visão Geral do Fluxo

1. Você exporta a planilha semanal de chamados do sistema AdvancisMax/Auvo
2. O n8n detecta automaticamente a nova planilha (via Upload de arquivo)
3. O n8n processa os dados da planilha e estrutura as informações
4. O Gemini Flash (IA gratuita do Google) interpreta e classifica os chamados semânticamente
5. O Supabase salva os dados via upsert — atualiza se o ticket já existir
6. O Dashboard web atualiza instantaneamente via Supabase Realtime

### 2.2 Camadas de Software

| Camada | Ferramenta | Função |
|--------|------------|--------|
| Ingestão | Google Sheets / Upload | Leitura de planilhas semanais de chamados |
| ETL & Orquestração | n8n (Local Host) | Lógica de negócio e movimentação de dados |
| Inteligência | Gemini Flash | Classificação semântica via IA |
| Persistência | Supabase PostgreSQL | Banco de dados com WebSockets Realtime |
| Apresentação | Vanilla JS/CSS — Vercel | Dashboard web com atualização em tempo real |

### 2.3 Infraestrutura e Custos

| Serviço | Plano | Custo | Limite Relevante |
|---------|-------|-------|------------------|
| Supabase | Free Tier | R$ 0,00 | 500 MB / 50k req/mês |
| n8n | self-hosted | R$ 0,00 | Execuções ilimitadas |
| Local Host / Infrastructure | Self-hosted | R$ 0,00 | Ambiente local dedicado |
| Gemini Flash | Free Tier | R$ 0,00 | 15 req/min, 1M tokens/min |
| Vercel | Hobby Free | R$ 0,00 | Ilimitado para estáticos |
| Google Sheets | Free | R$ 0,00 | Planilhas ilimitadas |
| **TOTAL MENSAL** | | **R$ 0,00** | **100% gratuito** |

## 3. Especificações da Base de Dados

### 3.1 Schema SQL

```sql
CREATE TABLE chamados (
    ticket INTEGER PRIMARY KEY,
    data_abertura DATE NOT NULL,
    secretaria VARCHAR(100),
    unidade VARCHAR(255),
    problema TEXT,
    motivo VARCHAR(50),
    status VARCHAR(50),
    severidade VARCHAR(20),
    fonte VARCHAR(20) DEFAULT 'planilha_semanal',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2 Valores Válidos por Campo

| Campo | Valores aceitos |
|-------|-----------------|
| motivo | Suporte / Fixação | Falha de Reconhecimento | Equipamento Inoperante | Configuração / Instalação |
| status | Aberto | Finalizado | Finalizado com Pendência |
| severidade | Alta | Média | Baixa |
| fonte | planilha_semanal | api_auvo |

## 4. Lógica de Processamento (IA)

### 4.1 Classificação de Motivo

| Motivo | Palavras-chave e contexto |
|--------|---------------------------|
| Suporte / Fixação | solto, frouxo, caído, risco de queda, suporte, fixação, pendurado, parede |
| Falha de Reconhecimento | enquadramento vermelho, não reconhece, leitura facial, não registra, espelho de ponto |
| Equipamento Inoperante | tela preta, não liga, offline, sem energia, inoperante, travado |
| Configuração / Instalação | configuração, instalação, substituição, sem configuração técnica |

### 4.2 Classificação de Severidade

| Severidade | Critério |
|------------|-----------|
| Alta | Equipamento completamente inoperante, risco físico de queda, ou múltiplas unidades afetadas |
| Média | Equipamento funcionando parcialmente ou com falha intermitente que impede registro de ponto |
| Baixa | Ajuste de configuração, suporte frouxo sem risco imediato, problemas estéticos |

### 4.3 Regra de Integridade: Upsert

```sql
INSERT INTO chamados (...) VALUES (...)
ON CONFLICT (ticket)
DO UPDATE SET
    status = EXCLUDED.status,
    problema = EXCLUDED.problema,
    severidade = EXCLUDED.severidade;
```

## 5. Workflow no n8n

### 5.1 Nós do Workflow

| # | Nó Função | Descrição |
|---|-----------|-----------|
| 1 | Google Sheets Trigger / File Upload | Monitora planilha ou recebe upload. Dispara ao detectar novos dados. |
| 2 | Tratamento de Dados | Processa e estrutura os dados da planilha semanal. |
| 3 | Google Gemini Chat | Envia os dados com o prompt. Recebe JSON estruturado com classificação. |
| 4 | Supabase — Upsert | Insere ou atualiza o registro na tabela chamados. |

### 5.2 Prompt de Extração

O seguinte prompt deve ser configurado no nó do Gemini (campo System Message ou User Message):

```
Você é um sistema de classificação de chamados técnicos. Leia os dados de um ticket de suporte e retorne APENAS um objeto JSON válido, sem texto adicional.

Campos: ticket (int), data_abertura (AAAA-MM-DD), secretaria, unidade, problema (máx 120 chars), motivo, status, severidade, fonte (sempre planilha_semanal).

Dados: {{ $json.dados }}
```

## 6. Segurança e Governança

### 6.1 Chaves de API

• **anon_key** (pública): usada no dashboard. Permite apenas leitura (SELECT).
• **service_role_key** (privada): armazenada no n8n. Permite escrita (INSERT/UPDATE).
• **Gemini API Key**: variável de ambiente no n8n. Nunca exposta no frontend.
• **Google Sheets API**: variável de ambiente no n8n para acesso às planilhas.

### 6.2 Políticas de RLS

• **Leitura pública**: qualquer usuário pode fazer SELECT (necessário para o dashboard).
• **Escrita restrita**: apenas a service_role pode fazer INSERT/UPDATE.

## 7. Roadmap

| Fase | Status | Descrição |
|------|--------|-----------|
| 1a | Concluído ✓ | Schema Supabase, 30 tickets inseridos, RLS configurado |
| 1b | Concluído ✓ | n8n instalado e acessível em ambiente local |
| 1c | Concluído ✓ | Workflow n8n: Planilha Semanal → Gemini → Supabase |
| 1d | Concluído ✓ | Dashboard publicado no Vercel com dados reais e Realtime |
| 2a | Em andamento | API Key do Auvo — substituição do trigger manual |
| 2b | Futuro | Integração com parque de equipamentos (Grafana + planilha) |
| 2c | Concluído ✓ | Migração de PDF isolados para planilhas semanais |

## 8. Principais Melhorias v1.2

### 8.1 Mudança na Ingestão de Dados
- **Antes**: Extração de PDFs isolados do Google Drive
- **Agora**: Processamento de planilha semanal de chamados
- **Benefício**: Maior eficiência, redução de erros de OCR, processamento mais rápido

### 8.2 Otimização de Infraestrutura
- **Antes**: Servidor dedicado na Oracle Cloud
- **Agora**: n8n self-hosted em ambiente local
- **Benefício**: Redução de complexidade, maior controle, zero dependência externa

### 8.3 Evolução do Workflow
- **Antes**: Monitoramento de arquivos PDF
- **Agora**: Leitura estruturada de planilhas
- **Benefício**: Dados mais consistentes, menor necessidade de processamento por IA

---

*Documento atualizado em Março de 2026 refletindo as melhorias implementadas na versão 1.2 do SIC-Biometria.*
