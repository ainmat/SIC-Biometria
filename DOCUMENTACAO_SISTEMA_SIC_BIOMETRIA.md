# PREFEITURA DO MUNICÍPIO DE OSASCO
## Secretaria de Administração · Departamento de Administração de Recursos Humanos (DARH)
### Setor de Biometria Facial e Observabilidade de Pessoas

---

# SIC-Biometria v2.0 — Manual Completo de Operação e Arquitetura do Sistema
**Sistema Integrado de Controle de Biometria, Chamados e Gestão Funcional**  
*Documento Técnico e Operacional — Gerado do Zero — Versão 2.0 (Outubro de 2026)*  
**Responsável Técnico:** Setor de Biometria Facial / DARH  
**Ambiente:** Produção (Local & Cloud Supabase)  

---

## Sumário Executivo

O **SIC-Biometria v2.0** é a plataforma corporativa central da Prefeitura de Osasco projetada para unificar e monitorar em tempo real três dimensões críticas da administração municipal:
1. **Infraestrutura e Hardware (Ativos):** O parque distribuído de relógios de ponto biométrico facial espalhados por todas as Secretarias, Escolas e Unidades de Saúde do município.
2. **Helpdesk e Incidentes Técnicos (Chamados):** A esteira de suporte, manutenção preventiva e conciliação de chamados operacionais (sincronizando chamados de campo via **Auvo** e gerenciamento de tarefas via **Asana**).
3. **Pessoas, Ponto e Folha (Core HR & People Analytics):** A apuração de prévias de frequência biométrica, conferência cruzada de dados de ponto com a folha de pagamento, auditoria do quadro de servidores ativos e monitoramento previdenciário (EC 103/2019).

O sistema foi concebido sob o princípio de **Custo Zero em Infraestrutura (100% Free Tier Corporativo)**, com interface moderna inspirada nos sistemas consolidados de People Operations (**Workday, BambooHR, Rippling e Linear**).

---

## 1. Arquitetura Tecnológica e Engenharia de Dados

O SIC-Biometria opera em uma arquitetura desacoplada, reativa e orientada a eventos (*Event-Driven Realtime Pipeline*).

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FONTES DE DADOS BRUTOS                        │
│   • Planilhas Semanais de Chamados (Auvo / AdvancisMax)                │
│   • Tarefas e Seções Operacionais do Asana                             │
│   • Arquivos de Ponto Eletrônico (AFD / AFDT / Portaria 671)           │
│   • Cadastro Geral de Servidores Municipais (SEPLAG/RH)                │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     CAMADA DE INGESTÃO & ETL                           │
│   • Modal de Importação com Parser XLSX/CSV no Frontend (SheetJS/xlsx) │
│   • Script Automatizado de Sincronização Asana (`sync_asana.mjs`)       │
│   • Classificação Semântica via Inteligência Artificial (Gemini Flash) │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   BANCO DE DADOS & REALTIME ENGINE                     │
│                       Supabase (PostgreSQL 15)                         │
│   • Tabelas: `chamados`, `equipamentos`, `servidores`, `usuarios`      │
│   • WebSockets nativos (`supabase.channel`) para push instantâneo      │
│   • Autenticação e Controle de Acesso Baseado em Perfis (RBAC)         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       INTERFACE WEB DO USUÁRIO                         │
│                    React 19 + Vite 5 + Tailwind v4                     │
│   • Slide-Over Sheet Drawers para inspeção sem perda de contexto       │
│   • Design System Enterprise HR (sem ruídos visuais ou AI Slop)        │
│   • Mapas Geoespaciais Leaflet + Gráficos Recharts / Chart.js          │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Stack de Tecnologias

| Camada | Tecnologia | Propósito |
|---|---|---|
| **Linguagem & Runtime** | JavaScript Moderno (ESModules) / Node.js 18+ | Lógica de scripts de ingestão e execução local |
| **Framework Web** | React 19 + React Router v7 | Renderização declarativa SPA de alta performance |
| **Bundler & Dev Server** | Vite 5 | Compilação ultra-rápida e Hot Module Replacement |
| **Estilização** | Vanilla CSS Tokens + Tailwind CSS v4 | Controle estético fino, performance e temas claro/escuro |
| **Biblioteca de Movimento**| `motion` (`motion/react`) | Transições com física de molas (Springs) sem engasgos |
| **Banco de Dados** | Supabase PostgreSQL 15 | Banco relacional relacional em nuvem com RLS |
| **Mensageria Realtime** | WebSockets do Supabase | Atualização automática das telas sem necessidade de F5 |
| **Inteligência Artificial**| Google Gemini 2.0 Flash (`@google/genai`)| Categorização semântica e saneamento de relatos |
| **Visualização Geoespacial**| Leaflet + React-Leaflet | Mapa interativo com agrupamento (clusters) de pontos |
| **Gráficos e BI** | Chart.js 4 + Recharts 3 | Decks de distribuição, barras e pirâmides etárias |
| **Planilhas & Export** | SheetJS (`xlsx`) | Leitura de planilhas complexas e exportação em CSV |

### 1.2 Custos Operacionais

A infraestrutura foi desenhada para operar **sem custo financeiro** para os cofres públicos:
* **Supabase Free Tier:** 500 MB de armazenamento em nuvem e 50.000 requisições mensais.
* **Google Gemini API Free:** 15 requisições por minuto com cota generosa de tokens para classificação semântica de chamados.
* **Hospedagem Web:** Roda localmente na intranet municipal ou em planos estáticos corporativos.
* **Custo Total Mensal:** **R$ 0,00**.

---

## 2. Perfis de Acesso e Segurança (RBAC)

O sistema possui uma camada de controle de acesso baseada em papéis (*Role-Based Access Control*), configurada em `src/contexts/AuthContext.jsx`:

| Perfil | Nível | Permissões e Escopo |
|---|---|---|
| **Master** | Nível Total | Acesso irrestrito a todos os módulos, gerenciamento de administradores, edição de senhas e sincronizações brutas. |
| **Admin** | Gerencial | Visualização e edição de todos os módulos de chamados, folha de pagamento, importação de servidores e relatórios. |
| **Apoio** | Operacional / Setorial | Perfil restrito aos módulos de conferência de folha e consulta de ponto da própria secretaria ou unidade de lotação. As páginas de chamados técnicos são bloqueadas via `<BlockApoio>`. |
| **Viewer** | Consulta | Acesso de leitura aos painéis sem permissão de importação de arquivos ou modificação de registros. |

---

## 3. Guia Detalhado dos Módulos do Sistema

---

### MÓDULO 1: Ativos & Helpdesk Técnico (Equipamentos e Chamados)

Centraliza a saúde e a manutenção do parque biométrico facial da Prefeitura.

#### 1. Painel Geral de Chamados (`/`)
* **Objetivo:** Visão executiva em tempo real para tomada de decisão rápida da chefia.
* **Recursos:**
  * **Filtro Rápido:** Recorte instantâneo entre *Todos*, *Saúde (SS)*, *Educação (SED)* e *Outras Secretarias*.
  * **Deck de Indicadores (KPIs):** Volume total de chamados do período, Secretaria mais demandada e Principal Causa Raiz.
  * **Distribuição dos Incidentes:** Gráfico Donut com percentual de incidência por categoria.
  * **Taxonomia Operacional:** Lista executiva com número de ocorrências, percentual e barras de proporção para as 4 grandes categorias:
    * `EQUIPAMENTO`: Falhas físicas (aparelho quebrado, cabo solto, leitor queimado, suporte avariado).
    * `RECONHECIMENTO`: Problemas ópticos ou biométricos (face não enquadrada, luz inadequada, falha de validação).
    * `ESPELHO DE PONTO`: Batida efetuada no relógio mas ausente no sistema de ponto/espelho.
    * `CADASTRO`: Servidor não cadastrado, mudança de turno ou permissão de acesso.
  * **Tabela de Ocorrências Recentes:** Exibição das ocorrências em tempo real. Clicar em qualquer registro abre imediatamente o **Slide-Over Drawer** lateral de inspeção.
  * **Demandas por Secretaria:** Gráfico de barras horizontais indicando a concentração de chamados por pasta municipal.

#### 2. Central de Chamados (`/todos-chamados`)
* **Objetivo:** Console de operação diária, triagem, auditoria de conciliação e exportação.
* **Recursos:**
  * **Deck Operacional de Triagem:** 4 cartões com contagem automática: *Total Geral*, *Em Aberto / Fila*, *Divergências Auvo ⇄ Asana* e *Encerrados*.
  * **Filtros Segmentados Fluidos:** Alternância de visualização em 1 clique (*Todos*, *Em Aberto*, *Divergências*, *Encerrados*).
  * **Busca Universal (`/`):** Digite `/` no teclado para buscar instantaneamente por número do ticket, nome da escola/posto de saúde, motivo ou técnico responsável.
  * **Filtros de Precisão:** Menus suspensos compactos para filtrar por Secretaria, Motivo, Status do Auvo ou Origem.
  * **Auditoria de Divergência Auvo ⇄ Asana:** O sistema compara o status do chamado no sistema de campo (**Auvo**) com a esteira de projetos (**Asana**). Se o técnico encerrou no campo mas o Asana ainda consta como aberto (ou vice-versa), o chamado recebe uma **Pílula de Descompasso** (`⚠️ Descompasso`).
  * **Slide-Over Drawer Inspector:** Painel lateral de alta performance que se abre ao clicar no chamado:
    * Atalhos de teclado: `Esc` fecha o painel; setas `↑` e `↓` navegam entre os chamados da lista.
    * Quadro de alerta de divergência explicando a diferença de status entre os dois sistemas.
    * Botão **"Copiar Resumo"** para colar o chamado pronto no WhatsApp, Teams ou e-mail de suporte.
  * **Exportação CSV:** Botão para exportar os dados filtrados em planilha com 1 clique.
  * **Importação Integrada:** Modal com suporte a arrastar-e-soltar planilhas Excel (`.xlsx`) ou CSV.

#### 3. Parque de Equipamentos (`/parque-equipamentos`)
* **Objetivo:** Inventário completo de todos os relógios biométricos da Prefeitura.
* **Dados mapeados:** Código do relógio, Nome da Unidade, IP da rede interna, Fabricante (Control iD / Henry / Dimep), Secretaria proprietária e Endereço Físico.

#### 4. Mapa Georreferenciado (`/mapa-equipamentos`)
* **Objetivo:** Observabilidade geoespacial do parque instalado no município de Osasco.
* **Tecnologia:** Mapas Leaflet com OpenStreetMap e clustering inteligente para evitar sobreposição de marcadores em regiões com alta densidade de equipamentos (ex: Paço Municipal e Policlínicas).

#### 5. Unidades Críticas (`/unidades-multiplos-chamados`)
* **Objetivo:** Relatório de reincidência e priorização para manutenção preventiva.
* **Lógica:** Agrupa e classifica as unidades que acumularam mais de 3 chamados no período, permitindo identificar relógios defeituosos que precisam de troca definitiva.

#### 6. Análise de Tendências (`/analise-tendencias`)
* **Objetivo:** Inteligência preditiva para identificar variações temporais nos chamados (picos após tempestades, quedas de energia ou fechamento de folha).

---

### MÓDULO 2: Ponto Biométrico & Prévias de Frequência

Automatiza a apuração de frequência de milhares de servidores antes do fechamento oficial da folha de pagamento.

#### 1. Simulador de Prévias (`/previas/simulador`)
* **Objetivo:** Processar os arquivos AFD (Arquivo de Fonte de Dados) e AFDT dos relógios biométricos.
* **Lógica de Cálculo:** Aplica as regras da legislação municipal e Portaria 671 do MTE:
  * Apuração de batidas pares e ímpares.
  * Tolerâncias legais de atraso (tolerância diária de 10 a 15 minutos).
  * Separação de atrasos fracionários (< 1h) e atrasos que geram perda de dia integral (≥ 1h).
  * Identificação de DSR (Descanso Semanal Remunerado) afetado por faltas não justificadas.
  * Apuração de Horas Extras a 50% (dias úteis) e 100% (finais de semana e feriados).

#### 2. Histórico de Prévias (`/previas/historico`)
* **Objetivo:** Arquivo digital com o resultado consolidado das prévias de cada competência (mês/ano), permitindo comparar se determinada unidade melhorou seus índices de assiduidade ao longo do tempo.

#### 3. BI e Indicadores de Ponto (`/previas/bi`)
* **Objetivo:** Painel analítico de absenteísmo, assiduidade e impacto das ocorrências por secretaria municipal.

---

### MÓDULO 3: Folha de Pagamento & Descontos

Faz a ponte essencial entre as batidas de ponto dos servidores e os descontos financeiros na folha de pagamento.

#### 1. Dashboard da Folha (`/folha/dashboard`)
* **Objetivo:** Visão consolidada da competência ativa (mês/ano) para a gestão de recursos humanos.
* **Métricas Principais:**
  * Volume total de servidores apurados na competência.
  * Total acumulado de faltas injustificadas.
  * Atrasos fracionados (< 1h) e atrasos graves (≥ 1h).
  * Quantidade total de horas extras apuradas (50% e 100%).
  * Ranking das Secretarias e Unidades com maior índice de apontamentos negativos.

#### 2. Conferência de Ponto vs. Folha (`/folha/conferencia`)
* **Objetivo:** Cruzamento e auditoria preventiva entre o que foi registrado no leitor biométrico e o que foi processado no holerite do servidor.
* **Finalidade:** Evitar descontos indevidos em servidores com atestados abonados ou inconsistências sistêmicas antes do envio para o banco pagador.

#### 3. Mapa de Descontos (`/folha/mapa`)
* **Objetivo:** Visualização tabular e matricial demonstrando a dispersão financeira de faltas e atrasos pelas secretarias municipais.

#### 4. Comparativo entre Meses (`/folha/comparativo`)
* **Objetivo:** Comparativo direto entre a competência atual e as anteriores para identificar anomalias sazonais na folha de pessoal.

---

### MÓDULO 4: Gestão de Pessoas (Core HR & People Analytics)

Estruturado segundo as melhores práticas do **Workday** e **BambooHR** para a administração de recursos humanos.

#### 1. Painel Geral de Pessoas (`/servidores/painel`)
* **Objetivo:** Cockpit demográfico e analítico do quadro funcional do município.
* **Componentes:**
  * **Deck de Métricas:** Total do Quadro Ativo, Admissões nos últimos 12 meses, Idade Média do Quadro e Níveis de Escolaridade distintos.
  * **Alertas Estratégicos de Governança:**
    * *Percentual de Comissionados:* Monitora a proporção de cargos de comissão em relação ao quadro efetivo para conformidade com a legislação.
    * *Aposentadorias Iminentes (EC 103/2019):* Identifica servidores que já cumpriram os requisitos ou que se aposentarão nos próximos 2 anos, permitindo que a Prefeitura planeje concursos públicos e transições de liderança sem interrupção dos serviços essenciais.
    * *Auditoria de Cadastros:* Rastreia registros funcionais com campos mandatórios ausentes.
  * **Gráficos Analíticos:** Pirâmide etária do município, composição por gênero, regimes jurídicos e distribuição por pasta.

#### 2. Diretório Geral de Servidores (`/servidores/diretorio`)
* **Objetivo:** Catálogo funcional completo de consulta rápida para o DARH e secretarias.
* **Padrão Visual:**
  * **Avatares de Iniciais:** Gerados automaticamente com base no nome do servidor em cores harmônicas.
  * **Matrícula Funcional:** Pílula monoespaçada (`#12345`) com botão de cópia com 1 clique.
  * **Busca Universal (`/`):** Pesquisa instantânea por nome, matrícula, cargo ou local de trabalho.
  * **Filtros por Regime:** Filtro rápido por Estatutário, CLT ou Comissionado.
* **Ficha Funcional do Servidor (*Slide-Over Drawer*):**
  * Ao clicar no servidor, uma gaveta lateral desliza suavemente com:
    * Dados de Lotação Oficial (Secretaria, Centro de Custeio, Código, Local e Escala de Trabalho).
    * Vida Funcional e Contrato (Cargo, Padrão Administrativo, Regime, Carga Horária Semanal, Datas de Nomeação, Posse, Admissão e Início de Exercício).
    * **Cálculo Exato do Tempo de Serviço:** O sistema calcula dinamicamente o tempo de carreira no município exibindo o resultado por extenso (ex: *14 anos, 3 meses e 12 dias*).
    * Dados Pessoais (Idade, Gênero e Escolaridade).
    * Botão de **Copiar Resumo da Ficha** para abertura de processos ou respostas a memorandos.

#### 3. Radar de Aposentadoria (`/servidores/aposentadoria`)
* **Objetivo:** Detalhamento nominal e por cargo dos servidores elegíveis à aposentadoria, com base nas regras de transição vigentes.

#### 4. Auditoria de Servidores (`/servidores/auditoria`)
* **Objetivo:** Higienização cadastral em massa para encontrar CPFs duplicados, cargos divergentes da tabela salarial ou lotações inexistentes.

---

### MÓDULO 5: Protocolo Digital

Digitalização do trâmite de requerimentos e documentos dos servidores.

#### 1. Painel de Protocolos (`/protocolos/painel`)
* **Objetivo:** Indicadores de protocolos abertos, em andamento, deferidos e pendentes de análise técnica.

#### 2. Consulta de Processos (`/protocolos/consulta`)
* **Objetivo:** Localização de protocolos por número de documento, CPF ou nome do requerente.

#### 3. Novo Protocolo (`/protocolos/novo`)
* **Objetivo:** Formalização de solicitações como abono de faltas, solicitação de férias, certidões de tempo de serviço e correções de ponto.

---

### MÓDULO 6: Monitoramento TV (NOC em Tela Cheia)

* **Rota:** `/tv` ou `/monitoramento-tv`
* **Objetivo:** Modo de exibição contínua para TVs e monitores de grandes dimensões na sala de operações técnicas (NOC - Network Operations Center).
* **Características:**
  * Layout escuro de alto contraste com fontes ampliadas.
  * Ausência de barras de navegação ou botões de edição.
  * Atualização automática a cada novo chamado inserido no banco sem requisições manuais.

---

## 4. Rotinas Operacionais e Procedimentos Padrão (SOP)

### Procedimento 1: Importação de Nova Planilha de Chamados Técnicos
1. Acesse o menu lateral e clique em **Chamados** (`/todos-chamados`).
2. No canto superior direito, clique no botão verde **"Importar Planilha"**.
3. Arraste para o modal o arquivo Excel (`.xlsx`, `.xls`) ou CSV exportado do sistema **Auvo** ou **AdvancisMax**.
4. O sistema lerá e validará as colunas: Ticket, Unidade, Secretaria, Motivo, Data de Abertura, Status e Descrição.
5. Clique em **"Processar e Importar"**.
6. O sistema executará o *upsert* no Supabase: chamados novos serão inseridos e chamados existentes terão seus status atualizados.
7. A tela se atualizará instantaneamente com as novas métricas.

---

### Procedimento 2: Sincronização Automática com o Asana
Para sincronizar as seções e tarefas operacionais da equipe no Asana com a base de dados central:
1. Abra o terminal no diretório do projeto.
2. Execute o comando:
   ```bash
   npm run sync:asana
   ```
3. O script (`scripts/sync_asana.mjs`) consultará a API do Asana, identificará o status de cada ticket (ex: *Em andamento*, *Aguardando Peça*, *Concluído*) e atualizará a tabela de chamados no Supabase.
4. Qualquer divergência entre o status registrado no campo (Auvo) e o status registrado no projeto (Asana) será imediatamente sinalizada na Central de Chamados com a tag de alerta.

---

### Procedimento 3: Consulta Rápida e Emissão de Resumo Funcional do Servidor
1. Acesse **Gestão de Pessoas → Diretório** (`/servidores/diretorio`).
2. Pressione a tecla `/` no teclado para focar no campo de busca.
3. Digite a matrícula (ex: `12345`) ou parte do nome do servidor.
4. Clique na linha do servidor correspondente.
5. O painel lateral deslizará exibindo a ficha completa e o tempo de carreira calculado.
6. Clique em **"Copiar Resumo"** no rodapé para obter o texto formatado e colá-lo na resposta ao processo.

---

## 5. Padrões de Design e Ergonomia de Interface

A interface do SIC-Biometria segue rigorosamente os princípios do **Emil Kowalski Design Engineering** e do **Apple Human Interface Guidelines**:

1. **Eliminação de AI Slop:** Não são utilizados fundos animados que causem perda de quadros (FPS), textos em gradiente multicolorido ou cards com sombras difusas falsas.
2. **Uso de Formatos Tabulares:** Todos os valores numéricos, datas, matrículas e percentuais utilizam fontes tabulares (`font-variant-numeric: tabular-nums`) garantindo alinhamento perfeito em relatórios.
3. **Física de Molas (*Spring Motion*):** Todas as transições de abertura de gavetas, filtros segmentados e hovers utilizam curvas de aceleração física realistas sem atrasos de clique (`active: scale(0.98)`).
4. **Foco e Teclado:** Suporte aos atalhos universais:
   * `/` : Foca no campo de busca principal.
   * `Esc` : Fecha qualquer gaveta lateral ou modal aberto.
   * `↑` / `↓` : Percorre os registros da lista com a gaveta aberta.

---

## 6. Governança e Boas Práticas

* **Persistência de Dados:** O Supabase armazena os dados com backups automáticos da infraestrutura em nuvem.
* **Segurança de Acesso:** Nenhuma chave com privilégios de escrita (*Service Role Key*) é exposta no código do cliente. Toda a comunicação pública utiliza a *Anon Key* com regras de validação em nível de linha (RLS).
* **Exportação Livre:** Todos os módulos contam com exportadores nativos para o formato aberto CSV, garantindo que a Administração Municipal nunca fique dependente de um formato proprietário para auditar seus próprios dados.

---

*Prefeitura do Município de Osasco — Secretaria de Administração / Setor de Biometria Facial*  
*SIC-Biometria v2.0 — Sistema em Produção e Operação Contínua.*
