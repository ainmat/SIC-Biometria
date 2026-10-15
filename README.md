# 🏛️ SIC-Biometria · Prefeitura de Osasco

> **Sistema Integrado de Controle de Biometria, Gestão Operacional de Chamados e Inteligência de RH**  
> Desenvolvido para o Departamento de Administração de Recursos Humanos (**DARH**) e Secretaria de Planejamento e Gestão (**SEPLAG**).

---

## 📋 Visão Geral

O **SIC-Biometria** é a plataforma central da Prefeitura de Osasco para supervisão do parque tecnológico de pontos biométricos, conciliação de chamados técnicos de manutenção e automação de rotinas de gestão de pessoas e folha de pagamento.

A plataforma unifica fluxos operacionais que antes eram dispersos entre planilhas manuais, e-mails e plataformas terceiras (Auvo e Asana), fornecendo visibilidade em tempo real com inteligência artificial aplicada.

---

## 🚀 Módulos Principais

### 1. Central de Chamados Operacionais
- **Sincronização Bidirecional em Tempo Real:** Conexão direta com **Asana** e **Auvo** via Webhooks serverless (`/api/webhook-asana`).
- **Triagem Inteligente com IA:** Classificação automática de chamados utilizando **Google Gemini 2.5 Flash** (identificação de secretaria, unidade escolar/posto e categorização por motivo: *Equipamento, Reconhecimento Facial, Espelho de Ponto, Cadastro*).
- **Comentários Bi-direcionais (SIC ⇄ Asana):** Publicação instantânea de atividades do painel direto para a tarefa do Asana via Stories API (`/api/comentar-asana`).
- **Semáforo de SLA & Aging:** Monitoramento de tempo de resolução com buckets de envelhecimento:
  - 🟢 **SLA Regular:** $\le$ 2 dias (48h)
  - 🟡 **SLA em Atenção:** 3 a 7 dias
  - 🔴 **SLA Crítico:** > 7 dias com alertas visuais pulsantes
- **Detecção de Reincidência (Hotspots):** Alerta proativo no Drawer e na página de detalhes quando uma mesma escola/unidade registra múltiplos chamados nos últimos 30 dias.
- **Slide-Over Sheet (Drawer):** Inspecione detalhes, copie resumos operacionais e navegue via teclado (setas $\uparrow/\downarrow$ e `Esc`).

### 2. Parque de Equipamentos Biométricos
- Mapa e inventário geolocalizado de relógios de ponto faciais e biométricos espalhados pelas secretarias municipais.
- Acompanhamento de status (*Ativo, Manutenção, Inativo*), modelo, número de série e fabricante.

### 3. Prévias de Frequência & Ponto
- Leitura, parsing e validação automatizada de arquivos de ponto (`IMP*`).
- Identificação precoce de inconsistências e conferência antes da consolidação definitiva.

### 4. Folha de Pagamento & Mapa de Descontos
- Processamento de arquivos de movimento mensal (verbas VB 335, faltas injustificadas, DSR, atrasos e frações).
- Conciliação entre registros do ponto e lançamentos de folha.

### 5. Radar de Aposentadoria & Servidores
- Simulação previdenciária individual e em lote (regras RGPS, compulsória aos 75 anos e regras especiais para o magistério).
- Projeção de penhasco de aposentadorias para planejamento de concursos e reposição de quadro de servidores.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologias Utilizadas |
|---|---|
| **Frontend** | React 18, Vite 5, React Router 6, Tailwind CSS v4, Motion (Framer), Radix UI, Lucide Icons |
| **Backend / DB** | Supabase (PostgreSQL, Realtime Database, Row Level Security, RPC Functions) |
| **Serverless API** | Vercel Serverless Functions (Node.js runtime) |
| **Inteligência Artificial** | Google Gemini (`@google/genai` — Gemini 2.5 Flash) |
| **Integrações Externas** | Asana REST & Webhook API v1.0, Auvo API |
| **Testes Automatizados** | Jest, Testing Library (159 testes unitários) |

---

## 📁 Estrutura do Repositório

```
Dashboard-Biometria/
├── api/                   # Serverless Functions (Webhook Asana, Envio de Comentários)
├── docs/                  # Manuais e documentações técnicas organizadas
│   ├── arquitetura.md     # Arquitetura completa e dicionário de dados
│   ├── equipamentos.md    # Especificações do parque de equipamentos
│   ├── institucional.md   # Documento institucional e memorial descritivo
│   ├── troubleshooting.md # Solução de problemas operacionais e FAQs
│   └── institucional/     # Apresentações executivas (.pptx, .docx)
├── migrations/            # Migrações SQL e scripts de banco de dados
│   └── legacy/            # Histórico de tabelas e funções antigas
├── public/                # Assets públicos estáticos (logos, favicons)
├── scripts/               # Scripts operacionais (geocoding, reconciliação, sincronização)
├── src/                   # Aplicação React
│   ├── components/        # Componentes reutilizáveis (Drawer, Topbar, Modais)
│   ├── contexts/          # Provedores de estado global (AuthContext)
│   ├── lib/               # Clientes e utilitários (Supabase, Asana, SLA, formatadores)
│   ├── modules/           # Módulos verticais (previas, folha, servidores, protocolo)
│   ├── pages/             # Páginas principais (Dashboard, Chamados, Detalhes)
│   └── styles/            # Folhas de estilo CSS com tokens de design
└── tests/                 # Suíte de testes automatizados unitários
```

---

## ⚙️ Como Executar Localmente

### Pré-requisitos
- **Node.js** $\ge$ 18.0.0
- **npm** $\ge$ 9.0.0

### Instalação

```bash
# 1. Clonar o repositório
git clone https://github.com/ainmat/SIC-Biometria.git
cd Dashboard-Biometria

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# Preencha suas credenciais do Supabase, Asana e Gemini no arquivo .env
```

### Comandos Disponíveis

```bash
# Iniciar servidor de desenvolvimento (Vite)
npm run dev

# Executar testes unitários
npm test

# Validar linting e formatação
npm run lint

# Gerar bundle otimizado de produção
npm run build

# Executar sincronização manual com Asana
npm run sync:asana
```

---

## 📚 Documentação Complementar

- [Arquitetura Técnica & Banco de Dados](docs/arquitetura.md)
- [Inventário do Parque de Equipamentos](docs/equipamentos.md)
- [Documento Institucional Prefeitura de Osasco](docs/institucional.md)
- [Guia de Solução de Problemas (Troubleshooting)](docs/troubleshooting.md)

---

**Prefeitura do Município de Osasco**  
*Secretaria de Planejamento e Gestão (SEPLAG) · Departamento de Administração de Recursos Humanos (DARH)*
