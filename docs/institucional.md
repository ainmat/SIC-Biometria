# PREFEITURA MUNICIPAL DE OSASCO
## Secretaria de Administração
### Setor de Biometria Facial

---

# SIC-Biometria
## Sistema de Inteligência e Controle — Biometria
### Documento de Apresentação Institucional

---

**Elaborado por:** Mateus Carvalho — Setor de Biometria Facial  
**Data:** Agosto de 2026  
**Versão do documento:** 1.0  
**Destinatário:** Secretário Adjunto de Administração

---

## Sumário

1. [Apresentação](#1-apresentação)
2. [Contexto e Problema](#2-contexto-e-problema)
3. [Objetivo do SIC-Biometria](#3-objetivo-do-sic-biometria)
4. [Visão Geral do Sistema](#4-visão-geral-do-sistema)
5. [Funcionalidades](#5-funcionalidades)
6. [Gestão de Chamados e Ocorrências](#6-gestão-de-chamados-e-ocorrências)
7. [Gestão dos Equipamentos de Biometria](#7-gestão-dos-equipamentos-de-biometria)
8. [Gestão de Frequência e Prévias](#8-gestão-de-frequência-e-prévias)
9. [Inteligência e Análise de Dados](#9-inteligência-e-análise-de-dados)
10. [Benefícios para a Administração Pública](#10-benefícios-para-a-administração-pública)
11. [Benefícios para a Equipe de Biometria](#11-benefícios-para-a-equipe-de-biometria)
12. [Benefícios para Gestores e Administração](#12-benefícios-para-gestores-e-administração)
13. [Governança, Controle e Rastreabilidade](#13-governança-controle-e-rastreabilidade)
14. [Situação Atual do Projeto](#14-situação-atual-do-projeto)
15. [Possibilidades de Evolução](#15-possibilidades-de-evolução)
16. [Conclusão](#16-conclusão)

---

## 1. Apresentação

O **SIC-Biometria** — Sistema de Inteligência e Controle da Biometria — é uma plataforma desenvolvida internamente pelo Setor de Biometria Facial da Prefeitura de Osasco para centralizar, organizar e transformar em informação gerencial os dados relacionados à gestão do ponto biométrico facial, ao controle do parque de equipamentos, ao acompanhamento de chamados técnicos, à análise de prévias de frequência, ao gerenciamento da folha de pagamento e ao cadastro de servidores.

O sistema foi concebido como uma resposta à necessidade de superar controles manuais e informações dispersas, consolidando em uma única ferramenta os processos operacionais e administrativos relacionados à biometria e ao controle de frequência no âmbito da Prefeitura.

O SIC-Biometria opera integralmente em plataformas de custo zero para a Administração, sem a necessidade de aquisição de licenças ou contratação de serviços externos.

---

## 2. Contexto e Problema

Anteriormente ao SIC-Biometria, a gestão das atividades do Setor de Biometria Facial enfrentava um conjunto de dificuldades que comprometiam a eficiência operacional e a capacidade de acompanhamento por parte da Administração:

**Dispersão de informações.** Os dados sobre chamados técnicos, situação dos equipamentos, prévias de frequência, folha de pagamento e cadastro de servidores encontravam-se em planilhas avulsas, arquivos individuais e controles paralelos, sem um ponto único de consulta ou acompanhamento.

**Dificuldade de acompanhamento das solicitações.** As ocorrências e chamados técnicos relacionados aos equipamentos de biometria não possuíam um registro centralizado que permitisse visualizar, de forma consolidada, quais unidades apresentavam problemas, qual o tipo de ocorrência e qual o status de atendimento.

**Dependência de controles manuais.** O processamento de prévias de frequência, a conferência entre dados do ponto e dados da folha de pagamento e a análise de ocorrências exigiam tratamento manual e repetitivo, consumindo tempo da equipe e aumentando o risco de inconsistências.

**Dificuldade de rastrear solicitações.** Não havia mecanismo estruturado para registrar e acompanhar o ciclo de vida de protocolos e solicitações internas relacionadas ao ponto biométrico, como abonos de faltas, retificações de batida de ponto e solicitações de acesso biométrico.

**Dificuldade de gerar informações gerenciais.** A ausência de consolidação dos dados impedia a produção de indicadores, comparativos e análises que pudessem subsidiar decisões administrativas, como a identificação de secretarias com maior volume de ocorrências ou a evolução mensal de faltas e atrasos.

**Dificuldade de visualizar o parque de equipamentos.** Não existia uma visão organizada da totalidade dos equipamentos de biometria facial instalados, suas localizações, fabricantes e condição operacional.

**Necessidade de melhorar o acompanhamento da infraestrutura.** A identificação de unidades com problemas recorrentes, equipamentos de fabricantes específicos e concentração geográfica dos equipamentos dependia de consultas manuais.

Essas dificuldades motivaram o desenvolvimento do SIC-Biometria como uma iniciativa de organização, centralização e modernização dos processos de trabalho do Setor.

---

## 3. Objetivo do SIC-Biometria

### Objetivo Geral

Oferecer ao Setor de Biometria Facial e à Secretaria de Administração uma ferramenta centralizada de gestão, acompanhamento e análise das atividades relacionadas à biometria facial e ao controle de frequência, transformando dados operacionais em informações úteis para a tomada de decisão.

### Objetivos Específicos

- **Centralizar** o registro e o acompanhamento de chamados técnicos relacionados aos equipamentos de biometria.
- **Catalogar** e permitir a consulta ao parque de equipamentos de biometria, com informações sobre localização, fabricante e módulo.
- **Organizar** o processamento e a análise de prévias de frequência, substituindo controles manuais por um fluxo estruturado.
- **Consolidar** dados de folha de pagamento para identificar faltas, atrasos e horas extras, permitindo análise por secretaria, unidade e servidor.
- **Disponibilizar** indicadores e dashboards que permitam à equipe e à gestão visualizar, de forma imediata, a situação operacional.
- **Criar** um registro histórico e rastreável das ocorrências, prévias publicadas e dados processados.
- **Permitir** a análise de tendências e a identificação de padrões nas ocorrências, apoiando decisões administrativas baseadas em dados.
- **Registrar e acompanhar** protocolos e solicitações internas do Setor.

O SIC-Biometria não se limita a ser uma interface de consulta. Trata-se de uma ferramenta de apoio à gestão que organiza processos, automatiza análises e produz informação gerencial a partir dos dados do dia a dia.

---

## 4. Visão Geral do Sistema

O SIC-Biometria está organizado em sete grandes áreas funcionais, acessíveis por meio de um painel único com autenticação por usuário e controle de permissões:

| Área Funcional | Descrição | Usuário Principal |
|---|---|---|
| **Equipamentos e Chamados** | Gestão de chamados técnicos, visão do parque de equipamentos e análise de tendências. | Equipe de Biometria e Gestão |
| **Ponto Biométrico (Prévias)** | Simulação, publicação e análise de prévias de frequência por secretaria. | Equipe de Biometria |
| **Folha de Pagamento** | Importação, análise e comparativo de dados de folha (faltas, atrasos, horas extras). | Equipe de Biometria e Gestão |
| **Servidores** | Painel de análise do quadro de servidores, com dados demográficos e funcionais. | Gestão |
| **Análise do Quadro** | Módulos de aposentadoria, escolaridade, perfil e saúde do quadro de servidores. | Gestão |
| **Protocolo Digital** | Registro, consulta e tramitação de protocolos e solicitações internas. | Equipe de Biometria |
| **Administração** | Gestão de usuários do sistema e controle de acesso. | Administradores |

O sistema possui três perfis de acesso:
- **Master**: acesso completo a todas as funcionalidades e à administração de usuários.
- **Administrador**: acesso às funcionalidades de importação de dados e publicação.
- **Visitante**: acesso somente leitura aos dashboards e consultas.

---

## 5. Funcionalidades

As funcionalidades implementadas no SIC-Biometria são apresentadas a seguir, organizadas por área funcional, sob a perspectiva dos processos administrativos que atendem.

---

### 5.1. Painel de Chamados (Dashboard Principal)

O painel de chamados é a tela inicial do sistema e oferece uma visão consolidada e em tempo real das ocorrências técnicas registradas. A equipe pode visualizar, em um único local:

- O **total de chamados** registrados, com indicação do período coberto.
- A **secretaria com maior volume de chamados** (secretaria crítica), permitindo identificar rapidamente onde concentrar esforços.
- O **principal motivo** dos chamados, indicando qual tipo de problema é mais frequente.
- Um **gráfico de distribuição por motivo**, classificando os chamados em quatro categorias: Equipamento, Reconhecimento, Espelho de Ponto e Cadastro.
- Um **ranking de chamados por secretaria**, com barras horizontais que evidenciam a distribuição do volume.
- Uma **tabela das últimas ocorrências**, com acesso direto aos detalhes de cada chamado (ticket, unidade, secretaria, motivo, status e descrição).
- **Filtros rápidos** por grupo de secretarias (Saúde, Educação e Outros).

O painel se atualiza automaticamente em tempo real, sem necessidade de recarregar a página.

---

### 5.2. Listagem e Consulta de Todos os Chamados

A tela de listagem completa permite à equipe consultar a totalidade dos chamados registrados, com capacidade de aplicar múltiplos filtros simultâneos:

- Filtro por **secretaria** (Saúde, Educação, Outros ou todas).
- Filtro por **motivo** (Equipamento, Reconhecimento, Espelho de Ponto, Cadastro).
- Filtro por **status** (Aguardando Atendimento ou Atendimento Encerrado).
- **Busca por número de ticket** ou **por nome da unidade**.

Cada chamado pode ser selecionado para exibição de seus detalhes em uma janela modal, incluindo ticket, status, unidade, secretaria, motivo, data de abertura e descrição do problema.

A tela também oferece a funcionalidade de **importação de chamados** a partir de planilhas, permitindo atualizar a base de dados a partir dos registros do sistema de chamados externo.

---

### 5.3. Análise de Tendências

O módulo de análise de tendências transforma o histórico de chamados em indicadores visuais que apoiam a identificação de padrões:

- **Gráfico de evolução mensal** dos chamados, mostrando a variação do volume ao longo do tempo.
- **Indicador de crescimento trimestral**, comparando o volume dos últimos três meses com o trimestre anterior.
- **Gráfico de distribuição por dia da semana**, revelando se há concentração de abertura de chamados em dias específicos.
- **Ranking das 10 secretarias com maior volume** de chamados.

Essa funcionalidade permite, por exemplo, identificar se há uma tendência de aumento ou redução nos chamados, quais secretarias geram mais demandas e se há padrões sazonais.

---

### 5.4. Unidades com Múltiplos Chamados

Esta funcionalidade identifica automaticamente as **unidades que possuem mais de um chamado registrado**, sinalizando locais com problemas recorrentes. Para cada unidade identificada, o sistema apresenta:

- O número total de chamados daquela unidade.
- O número de chamados ainda abertos.
- A possibilidade de expandir a lista e visualizar cada chamado individualmente.

Essa visão é relevante para a Administração, pois permite priorizar ações corretivas nas unidades que concentram maior quantidade de ocorrências.

---

### 5.5. Parque de Equipamentos

O módulo de equipamentos oferece um inventário completo e consultável de todos os equipamentos de biometria facial instalados na Prefeitura. Para cada equipamento, o sistema apresenta:

- Código identificador.
- Nome do equipamento (unidade onde está instalado).
- Endereço IP (informação restrita, não exibida para perfis de visitante).
- Secretaria responsável.
- Endereço e CEP de instalação.
- Módulo do equipamento.
- Fabricante (com distinção visual entre fabricantes — atualmente Tommi e Control ID).

O painel inclui:
- **Indicadores totais** (total de equipamentos, quantidade por fabricante).
- **Filtro por fabricante** e **busca por texto** (código, nome, IP, secretaria, endereço).

Essa funcionalidade permite à Administração ter uma visão clara da dimensão e da distribuição do parque de equipamentos.

---

### 5.6. Mapa de Equipamentos

O sistema disponibiliza uma **visualização geográfica do parque de equipamentos** sobre um mapa interativo, com marcadores que indicam a localização de cada equipamento. Ao clicar em um marcador, são exibidas as informações do equipamento e os chamados associados àquela unidade.

O mapa permite dois modos de visualização (pinos individuais ou agrupamento por proximidade) e possibilita, para usuários com permissão de administrador, a **edição da localização** dos equipamentos diretamente no mapa.

---

### 5.7. Simulador de Prévias de Frequência

O módulo de prévias é uma das funcionalidades mais complexas do sistema. Ele permite à equipe de biometria **importar, analisar e publicar as prévias de frequência** das secretarias, substituindo um processo anteriormente manual.

O simulador opera em quatro modos:

| Modo | Descrição |
|---|---|
| **Ponto Unificado** | Processa um arquivo único contendo os dados de todas as secretarias. |
| **Por Secretaria** | Processa o arquivo de prévia de uma secretaria específica, com seleção de competência e secretaria. |
| **Lote** | Processa múltiplos arquivos simultaneamente, detectando automaticamente a secretaria pelo nome do arquivo. |
| **Comparar TXT** | Compara dois arquivos de prévia para identificar diferenças entre versões. |

Para cada prévia processada, o sistema realiza:

- **Contagem de ocorrências** (faltas, atrasos e demais códigos).
- **Classificação das ocorrências** por tipo (falta, atraso, DSR).
- **Detecção de duplicatas** (matrículas repetidas no mesmo arquivo).
- **Análise comparativa com o histórico**, calculando variações em relação aos meses anteriores.
- **Detecção de anomalias**, como volumes de ocorrências significativamente acima da média histórica.
- **Cálculo de Z-Score** por tipo de ocorrência (indicador estatístico que sinaliza se o volume está dentro ou fora do padrão esperado).

Após a análise, o operador pode **publicar a prévia**, registrando-a na base do sistema para consulta histórica.

---

### 5.8. Histórico de Prévias Publicadas

O sistema armazena todas as prévias que foram publicadas, permitindo:

- Consultar o **registro de todas as prévias publicadas**, com informações de competência, secretaria, total de ocorrências, faltas, atrasos, servidores impactados e data de publicação.
- **Filtrar por ano** e **buscar por nome de secretaria**.
- **Expandir** cada registro para visualizar os detalhes (total de linhas válidas, descartadas e classificação das ocorrências).
- Exibir **badge de alerta** quando a prévia apresentou variação significativa em relação ao histórico (dentro do esperado, atenção, alerta ou anomalia crítica).

---

### 5.9. BI de Prévias (Business Intelligence)

O módulo de BI de prévias oferece **dashboards analíticos avançados** a partir dos dados das prévias publicadas. Existem dois níveis de visualização:

**Dashboard Consolidado** (todas as secretarias):
- Total de prévias publicadas, ocorrências acumuladas, faltas, atrasos e servidores impactados.
- Gráfico de **evolução mensal** de ocorrências e servidores afetados.
- **Distribuição por secretaria** (gráfico de rosca).
- **Ranking de ocorrências por secretaria** (gráfico de barras).
- **Top 10 matrículas** com maior número de ocorrências (global).
- **Heatmap de secretaria × período**, mostrando a intensidade das ocorrências ao longo dos meses, com código de cores por gravidade (Nenhuma, Baixa, Média, Alta, Crítica).

**Dashboard por Secretaria**:
- Indicadores específicos de uma secretaria selecionada.
- Evolução mensal de ocorrências, faltas e atrasos.
- Composição mensal de faltas × atrasos (gráfico de barras empilhadas).
- Top 10 matrículas com mais ocorrências naquela secretaria.

---

### 5.10. Folha de Pagamento — Painel e Análise

O módulo de folha de pagamento permite importar e analisar os dados de ocorrências da folha (faltas, atrasos e horas extras). As funcionalidades implementadas incluem:

**Importação de Folha** (acesso restrito a administradores):
- Importação de dados de folha de pagamento a partir de arquivo.

**Painel da Folha**:
- Visualização de indicadores por competência (mês/ano).
- **Ranking de secretarias** por métrica selecionada (faltas, atrasos total, atrasos < 1h, atrasos ≥ 1h, horas extras).
- **Ranking de unidades** dentro de uma secretaria.
- **Detalhamento por servidor** ao clicar em uma unidade, exibindo os dados individuais de cada funcionário.
- Possibilidade de alternar entre diferentes métricas e gráficos com classificação de dados.

**Simulador de Folha**:
- Permite selecionar competência e secretaria para análise detalhada.

**Comparativo de Folha**:
- Compara dados entre **múltiplas competências** (meses), permitindo visualizar a evolução de faltas, atrasos, DSR e horas extras ao longo do tempo.
- Apresenta os dados em formato de tabela com indicadores de variação (aumento ou redução entre meses).
- Permite comparar no nível de secretaria ou unidade.
- Oferece exportação dos dados para CSV.

**Conferência de Ponto × Folha**:
- Cruza os dados do ponto biométrico (prévias) com os dados da folha de pagamento, identificando divergências:
  - Servidores com ocorrências apenas no ponto.
  - Servidores com ocorrências apenas na folha.
  - Servidores com ocorrências em ambos (concordantes).
  - Servidores sem ocorrências.

**Mapa de Descontos**:
- Visualização geográfica dos descontos de folha por unidade, cruzando dados de localização dos equipamentos com dados de ocorrências da folha.

---

### 5.11. Servidores — Análise do Quadro

O SIC-Biometria conta com um módulo amplo de análise do quadro de servidores, que inclui:

**Painel de Servidores**:
- Indicadores gerais: total de servidores, comissionados, efetivos, idade média, tempo médio de serviço.
- Distribuição por **secretaria**, **faixa etária**, **tipo de vínculo** e **escolaridade**.
- Gráficos interativos com possibilidade de filtragem.

**Diretório de Servidores**:
- Consulta individual com busca paginada e filtros avançados.
- Exibição de dados do servidor: nome, matrícula, cargo, secretaria, data de admissão, idade, escolaridade, tempo de serviço.
- Exportação para CSV.

**Radar de Aposentadoria**:
- Identifica servidores em situação de elegibilidade para aposentadoria em diferentes horizontes temporais (atual, 3, 5 e 10 anos).
- Classifica a elegibilidade em faixas: Provável, Possível (requer CNIS) e Compulsória (75 anos).
- Apresenta o **gráfico de penhasco** (quantos novos elegíveis surgem a cada ano futuro).
- Ranking de secretarias mais expostas à aposentadoria.
- Lista de servidores-chave em situação de atenção.

**Comissionados e Efetivos**:
- Análise da composição do quadro entre servidores comissionados e efetivos, por secretaria.

**Descompasso de Escolaridade**:
- Identifica servidores cujo nível de escolaridade formal é superior ao exigido pelo cargo que ocupam, ou inferior ao esperado.

**Perfil do Quadro**:
- Análise demográfica do quadro (distribuição por gênero, faixa etária, ondas de contratação).

**Índice de Saúde do Quadro**:
- Calcula um score composto para cada secretaria com base em indicadores como idade média, percentual de comissionados, tempo médio de serviço e nível de escolaridade médio.
- Permite comparar a "saúde organizacional" de diferentes secretarias.

**Simulador de Cenários**:
- Permite projetar o impacto de aposentadorias, cortes de comissionados e novas admissões no quadro de servidores de cada secretaria, em diferentes horizontes temporais.

**Sentinel de Jornadas**:
- Analisa a coerência entre a jornada de trabalho cadastrada para os servidores e os padrões esperados, identificando irregularidades, jornadas atípicas e possíveis inconsistências.

**Auditoria de Servidores**:
- Identifica automaticamente registros com anomalias nos dados cadastrais: servidores sem nome, sem cargo, sem secretaria, com data de admissão inválida ou com idade atípica (menor de 18 ou acima de 90 anos).

---

### 5.12. Protocolo Digital

O módulo de Protocolo Digital permite registrar, consultar e acompanhar solicitações internas do Setor de Biometria. As funcionalidades incluem:

**Abertura de Protocolo**:
- Formulário para registro de novo protocolo, com campos: requerente, matrícula, secretaria, tipo de solicitação, descrição, documento anexo e prazo estimado.
- Tipos de solicitação disponíveis: Abono de Faltas (Atestado Médico), Retificação de Batida de Ponto, Solicitação de Acesso Biométrico, Licença Prêmio, Opção por Acúmulo de Cargo e Outros.
- Importação de protocolos em lote a partir de planilha.

**Consulta de Protocolos**:
- Listagem completa de protocolos com filtros por status (Aberto, Em Análise, Concluído), secretaria, tipo e busca textual.
- Visualização de detalhes de cada protocolo, com indicação de número do protocolo, status, requerente, secretaria, tipo, datas e prioridade.
- **Tramitação**: possibilidade de alterar o status do protocolo com registro de observação e nome do operador responsável pela movimentação.

**Painel de Protocolos**:
- Dashboard com indicadores: total de protocolos, protocolos abertos, em análise e concluídos.
- Distribuição por secretaria, por tipo de solicitação e evolução mensal.

---

### 5.13. Gestão de Usuários

O módulo de administração permite:

- **Criar** novos usuários com definição de nome, username, senha e perfil de acesso.
- **Visualizar** a lista de usuários cadastrados, com indicação de perfil.
- **Controlar** permissões de acesso (Master pode criar administradores e visitantes; Administrador pode criar visitantes).

---

## 6. Gestão de Chamados e Ocorrências

O SIC-Biometria contribui significativamente para o acompanhamento das solicitações relacionadas à biometria por meio de um fluxo estruturado:

**Registro**: os chamados são registrados no sistema com informações de ticket, data de abertura, unidade, secretaria, motivo e descrição do problema. A importação pode ser feita a partir de planilhas do sistema de chamados externo.

**Classificação**: cada chamado é automaticamente classificado em uma das quatro categorias de motivo: Equipamento (problema físico no aparelho), Reconhecimento (falha na leitura facial), Espelho de Ponto (registro não refletido no sistema) e Cadastro (problema de configuração ou cadastro do servidor).

**Acompanhamento de Status**: os chamados possuem indicação de status (Aguardando Atendimento ou Atendimento Encerrado), permitindo acompanhar o ciclo de vida de cada ocorrência.

**Localização**: os chamados estão vinculados à unidade e à secretaria onde ocorreram, permitindo localizar geograficamente as ocorrências.

**Identificação de Padrões**: a análise de tendências e a listagem de unidades com múltiplos chamados permitem identificar recorrências e concentrar esforços nas localidades mais problemáticas.

**Histórico**: todos os chamados registrados ficam armazenados e consultáveis, criando um histórico que pode ser utilizado para análises futuras e para subsidiar decisões sobre manutenção e substituição de equipamentos.

> **Nota:** O sistema registra o status e o motivo dos chamados. Funcionalidades como responsável pelo atendimento, prioridade e prazo não estão implementadas no módulo de chamados no momento atual. O módulo de Protocolo Digital, por sua vez, contempla campos de prazo estimado e prioridade para solicitações internas.

---

## 7. Gestão dos Equipamentos de Biometria

A centralização do inventário de equipamentos no SIC-Biometria representa um avanço na organização da infraestrutura de biometria. O sistema permite que a Administração:

- **Conheça a dimensão do parque de equipamentos**, com indicadores de totais e distribuição por fabricante.
- **Consulte rapidamente** as informações de qualquer equipamento por código, nome, IP, secretaria, endereço ou fabricante.
- **Identifique a distribuição por fabricante**, distinguindo visualmente equipamentos Tommi e Control ID, o que é relevante para contratos de manutenção e análise de desempenho por fornecedor.
- **Visualize a distribuição geográfica** no mapa, entendendo a cobertura territorial dos equipamentos.
- **Cruze informações de equipamentos com chamados**, identificando se determinado equipamento ou localidade concentra problemas técnicos.

O valor administrativo dessa centralização está na capacidade de planejar a expansão, a manutenção e a substituição do parque com base em dados consolidados, em vez de depender de controles dispersos.

---

## 8. Gestão de Frequência e Prévias

### O que é a prévia no contexto do sistema

No SIC-Biometria, a **prévia de frequência** refere-se ao arquivo gerado pelo sistema de ponto biométrico contendo o registro das ocorrências de frequência dos servidores em uma determinada competência (mês/ano). Esse arquivo lista, por matrícula, as ocorrências registradas — como faltas (código 171), atrasos (código 335) e demais códigos de ponto.

A prévia é o insumo que o Setor de Biometria processa mensalmente para cada secretaria, e que alimenta os processos subsequentes de folha de pagamento.

### Quais informações são analisadas

Ao processar uma prévia, o sistema extrai e organiza:

- **Total de ocorrências** (todas as linhas válidas do arquivo).
- **Total de faltas** (código 171) e **total de atrasos** (código 335).
- **Quantidade de servidores impactados** (matrículas únicas com ocorrências).
- **Duplicatas** (matrículas que aparecem mais de uma vez).
- **Registros descartados** (linhas inválidas no arquivo).

### Como os dados são organizados

As prévias processadas são publicadas no sistema e ficam disponíveis para consulta histórica. Os dados são organizados por:

- **Competência** (mês/ano).
- **Secretaria** (código e sigla).
- **Tipo de ocorrência** (falta, atraso, outros).

### Como a informação apoia a equipe

O simulador de prévias automatiza a análise que antes era feita manualmente pela equipe, oferecendo:

- **Comparação automática com o histórico**, indicando se o volume de ocorrências do mês corrente está dentro do padrão ou se há variação significativa.
- **Detecção de anomalias**, que alerta quando o volume de faltas ou atrasos excede significativamente a média histórica daquela secretaria.
- **Processamento em lote**, permitindo analisar e publicar prévias de múltiplas secretarias simultaneamente.
- **Comparação entre versões** de arquivos, útil quando há reprocessamento ou retificação de prévias.

### Como os dados geram visão gerencial

O dashboard de BI de prévias consolida os dados publicados e oferece:

- **Evolução mensal** de ocorrências, faltas e atrasos — permitindo verificar se há tendência de aumento ou redução.
- **Ranking de secretarias por volume de ocorrências** — evidenciando quais órgãos concentram maior quantidade de faltas e atrasos.
- **Heatmap de secretaria × período** — uma matriz visual que cruza secretarias com meses, usando cores para indicar a intensidade das ocorrências, facilitando a identificação rápida de concentrações.
- **Top 10 matrículas** com maior número de ocorrências — relevante para identificar servidores com padrão recorrente de faltas ou atrasos.
- **Indicadores acumulados e por período** — faltas, atrasos e servidores impactados.

---

## 9. Inteligência e Análise de Dados

O SIC-Biometria possui, em sua versão atual, um conjunto relevante de funcionalidades de análise de dados que transformam registros operacionais em informações gerenciais. A seguir, são apresentadas as capacidades efetivamente implementadas e as possibilidades de evolução.

### Capacidades implementadas

| Capacidade | Status | Descrição |
|---|---|---|
| Secretarias com maior volume de chamados | ✅ Implementado | Ranking e gráfico por secretaria no painel de chamados e análise de tendências. |
| Evolução mensal de chamados | ✅ Implementado | Gráfico de linha mostrando volume por mês ao longo do tempo. |
| Crescimento trimestral de chamados | ✅ Implementado | Indicador que compara volume dos últimos 3 meses com o trimestre anterior. |
| Distribuição por dia da semana | ✅ Implementado | Gráfico de barras indicando se há concentração em dias específicos. |
| Concentração de chamados por unidade | ✅ Implementado | Identificação automática de unidades com múltiplos chamados. |
| Secretarias com mais ocorrências de ponto | ✅ Implementado | Ranking e heatmap no BI de prévias. |
| Evolução de faltas e atrasos | ✅ Implementado | Gráficos no BI de prévias (consolidado e por secretaria). |
| Matrículas com mais ocorrências | ✅ Implementado | Top 10 global e por secretaria no BI de prévias. |
| Heatmap secretaria × período | ✅ Implementado | Matriz visual com código de cores por intensidade. |
| Comparativo entre competências da folha | ✅ Implementado | Tabela com variações mês a mês por secretaria/unidade. |
| Conferência ponto × folha | ✅ Implementado | Cruzamento de dados para identificar divergências. |
| Detecção de anomalias nas prévias | ✅ Implementado | Z-Score e alertas por tipo de ocorrência. |
| Análise de aposentadoria | ✅ Implementado | Projeção de elegíveis em diferentes horizontes. |
| Simulação de cenários de quadro | ✅ Implementado | Projeção de impacto de aposentadorias, cortes e admissões. |
| Auditoria de dados cadastrais | ✅ Implementado | Identificação automática de anomalias nos registros de servidores. |
| Índice de saúde do quadro | ✅ Implementado | Score composto por secretaria baseado em múltiplos indicadores. |
| Análise de jornadas | ✅ Implementado | Verificação de coerência nas jornadas cadastradas. |

### Possibilidades de evolução

| Possibilidade | Descrição |
|---|---|
| Indicadores preditivos | Utilização do histórico para projetar volumes futuros de ocorrências. |
| Alertas automáticos | Notificações quando determinados indicadores ultrapassarem limites definidos. |
| Relatórios automatizados | Geração periódica de relatórios consolidados para envio à Administração. |
| Análise de tempo de atendimento | Cálculo do tempo entre abertura e encerramento de chamados (requer campo de data de encerramento). |
| Correlação equipamento × ocorrências | Identificar se determinados equipamentos concentram mais falhas que outros. |

---

## 10. Benefícios para a Administração Pública

Os benefícios proporcionados pelo SIC-Biometria estão diretamente relacionados às funcionalidades implementadas:

**Centralização da informação.** Chamados, equipamentos, prévias, folha, servidores e protocolos são acessados em um único sistema, eliminando a necessidade de consultar planilhas avulsas e controles paralelos.

**Padronização dos processos.** O processamento de prévias, a importação de dados de folha e o registro de chamados seguem fluxos definidos pelo sistema, reduzindo a variabilidade nos procedimentos.

**Rastreabilidade.** Cada chamado possui número de ticket, cada prévia publicada possui registro de competência, secretaria e data de publicação, e cada protocolo possui número único e histórico de tramitação. É possível consultar o que foi feito, quando e em qual contexto.

**Transparência interna.** Os dashboards são acessíveis a diferentes perfis de usuários, permitindo que gestores acompanhem a situação operacional sem depender de relatórios elaborados manualmente pela equipe.

**Redução de controles paralelos.** A centralização no SIC-Biometria substitui planilhas individuais, anotações e controles informais por um registro estruturado e persistente.

**Melhoria no acompanhamento das solicitações.** O módulo de Protocolo Digital cria um registro formal das solicitações internas, com possibilidade de acompanhar status, prazo e tramitação.

**Disponibilidade de informações gerenciais.** Os dashboards e gráficos produzem informação consolidada que pode ser utilizada em reuniões de gestão, apresentações e tomada de decisão.

**Apoio à tomada de decisão.** A identificação de secretarias com maior volume de faltas, unidades com chamados recorrentes e evolução mensal dos indicadores fornece subsídio para decisões sobre alocação de recursos, manutenção de equipamentos e acompanhamento de servidores.

**Melhoria da gestão da infraestrutura.** O inventário de equipamentos e o mapa geográfico permitem planejar a expansão, manutenção e substituição do parque de biometria.

**Identificação de problemas recorrentes.** A listagem de unidades com múltiplos chamados e a análise de tendências evidenciam padrões que demandam atenção.

**Histórico das ocorrências.** Todos os dados permanecem armazenados e consultáveis, criando memória institucional das atividades do Setor.

---

## 11. Benefícios para a Equipe de Biometria

O SIC-Biometria transforma o trabalho cotidiano da equipe de Biometria de diversas formas:

**Do controle disperso para o acompanhamento centralizado.** Em vez de consultar múltiplas planilhas para verificar a situação dos chamados, a equipe visualiza tudo em um único painel com atualização em tempo real.

**Da análise manual para a análise automatizada.** O processamento de prévias, que antes exigia leitura manual de arquivos e contagem de ocorrências, é realizado automaticamente pelo simulador, incluindo classificação, detecção de anomalias e comparação com o histórico.

**Do processamento unitário para o processamento em lote.** A equipe pode importar e analisar prévias de múltiplas secretarias de uma só vez, reduzindo o tempo necessário para o processamento mensal.

**Do registro informal para o registro estruturado.** Protocolos e solicitações que antes podiam ser acompanhados por anotações ou e-mails passam a ter registro formal com número, status, prazo e histórico de tramitação.

**Da informação isolada para a visão integrada.** A equipe pode, por exemplo, verificar se uma secretaria com alto volume de faltas também apresenta chamados recorrentes nos equipamentos daquela localidade, cruzando informações que antes estavam em controles separados.

---

## 12. Benefícios para Gestores e Administração

O SIC-Biometria produz informações em diferentes níveis, atendendo a necessidades distintas:

### Informação Operacional

É a informação do dia a dia, necessária para o trabalho da equipe:
- Quais chamados estão abertos.
- Qual o status de cada prévia.
- Quais unidades possuem equipamentos.
- Quais protocolos estão pendentes.

O sistema disponibiliza essa informação de forma imediata, em tempo real.

### Informação Gerencial

É a informação consolidada, necessária para o acompanhamento por parte de coordenadores e diretores:
- Quantos chamados foram registrados no mês e como esse número se compara com meses anteriores.
- Quais secretarias concentram mais faltas e atrasos.
- Qual a evolução mensal das ocorrências de ponto.
- Quantos protocolos estão abertos, em análise ou concluídos.
- Qual a composição do quadro de servidores por secretaria, vínculo e escolaridade.

Os dashboards do sistema produzem essa informação automaticamente.

### Informação Estratégica

É a informação que subsidia decisões de médio e longo prazo:
- O volume de chamados está aumentando? É necessário expandir a equipe de manutenção?
- Quantos servidores serão elegíveis à aposentadoria nos próximos 5 anos? Em quais secretarias?
- Há concentração de faltas em determinadas unidades que possa indicar problemas locais?
- Qual o índice de saúde organizacional de cada secretaria?

Os módulos de análise de tendências, radar de aposentadoria, simulador de cenários e índice de saúde do quadro produzem insumos para essa reflexão.

---

## 13. Governança, Controle e Rastreabilidade

O SIC-Biometria contribui para a governança das atividades do Setor de Biometria nos seguintes aspectos:

**Controle de acesso.** O sistema possui autenticação por usuário e três perfis de permissão (Master, Administrador e Visitante), garantindo que operações sensíveis (como importação de dados e publicação de prévias) sejam restritas a usuários autorizados.

**Histórico de dados.** Chamados, prévias publicadas, dados de folha e protocolos permanecem armazenados e consultáveis, criando um registro histórico que pode ser utilizado para auditoria interna ou para responder a demandas de informação.

**Rastreabilidade de protocolos.** Cada protocolo recebe número único, registra o operador responsável pela tramitação e armazena as observações de cada movimentação.

**Padronização de classificação.** A classificação de chamados por motivo (Equipamento, Reconhecimento, Espelho de Ponto e Cadastro) segue critérios definidos, reduzindo a subjetividade na categorização.

**Detecção de anomalias.** A identificação automática de registros com dados cadastrais inconsistentes (auditoria de servidores) e de prévias com volumes fora do padrão esperado contribui para a integridade das informações.

**Gestão baseada em dados.** A disponibilidade de indicadores e comparativos reduz a dependência de percepções informais e permite que decisões sejam fundamentadas em dados concretos.

> **Nota:** O sistema não implementa, na versão atual, funcionalidades de log de auditoria detalhado (registro de cada ação realizada por cada usuário com data e hora). Essa é uma possibilidade de evolução futura.

---

## 14. Situação Atual do Projeto

### Funcionalidades Concluídas

| Módulo | Funcionalidade | Status |
|---|---|---|
| Chamados | Painel de chamados com KPIs, gráficos e filtros | ✅ Concluído |
| Chamados | Listagem completa com filtros múltiplos e busca | ✅ Concluído |
| Chamados | Importação de chamados via planilha | ✅ Concluído |
| Chamados | Detalhes do chamado em modal | ✅ Concluído |
| Chamados | Análise de tendências (mensal, semanal, ranking) | ✅ Concluído |
| Chamados | Unidades com múltiplos chamados | ✅ Concluído |
| Chamados | Atualização em tempo real | ✅ Concluído |
| Equipamentos | Parque de equipamentos com inventário e filtros | ✅ Concluído |
| Equipamentos | Mapa geográfico com marcadores interativos | ✅ Concluído |
| Prévias | Simulador de prévias (único, lote, comparação) | ✅ Concluído |
| Prévias | Importação de ponto unificado | ✅ Concluído |
| Prévias | Análise com histórico, anomalias e Z-Score | ✅ Concluído |
| Prévias | Publicação e histórico de prévias | ✅ Concluído |
| Prévias | BI de prévias (consolidado e por secretaria) | ✅ Concluído |
| Prévias | Heatmap secretaria × período | ✅ Concluído |
| Folha | Importação de dados de folha | ✅ Concluído |
| Folha | Painel da folha com ranking e detalhamento | ✅ Concluído |
| Folha | Comparativo entre competências | ✅ Concluído |
| Folha | Conferência ponto × folha | ✅ Concluído |
| Folha | Mapa de descontos geográfico | ✅ Concluído |
| Servidores | Painel de servidores com indicadores | ✅ Concluído |
| Servidores | Diretório com busca e exportação | ✅ Concluído |
| Servidores | Radar de aposentadoria | ✅ Concluído |
| Servidores | Comissionados × efetivos | ✅ Concluído |
| Servidores | Descompasso de escolaridade | ✅ Concluído |
| Servidores | Perfil do quadro | ✅ Concluído |
| Servidores | Índice de saúde do quadro | ✅ Concluído |
| Servidores | Simulador de cenários | ✅ Concluído |
| Servidores | Sentinel de jornadas | ✅ Concluído |
| Servidores | Auditoria de dados cadastrais | ✅ Concluído |
| Protocolo | Abertura individual e em lote | ✅ Concluído |
| Protocolo | Consulta com filtros e tramitação | ✅ Concluído |
| Protocolo | Painel com indicadores | ✅ Concluído |
| Sistema | Autenticação e controle de acesso | ✅ Concluído |
| Sistema | Gestão de usuários | ✅ Concluído |
| Sistema | Temas claro e escuro | ✅ Concluído |

### Pontos que Dependem de Evolução Futura

| Item | Descrição |
|---|---|
| Integração com o sistema Auvo/AdvancisMax | A importação de chamados ainda depende de upload manual de planilha. A integração direta via API com o sistema de chamados externo está prevista mas não implementada. |
| Exportação de relatórios | Alguns módulos oferecem exportação para CSV; a geração de relatórios automatizados em formato PDF ainda não está implementada. |
| Notificações e alertas | O sistema não envia notificações por e-mail ou alertas automáticos. Os alertas existentes são visuais, exibidos nos dashboards. |
| Log de auditoria | Não existe registro detalhado de cada ação realizada por cada usuário no sistema. |
| Dados de servidores | Os dados de servidores são importados e analisados, mas dependem da disponibilidade e atualização dos dados fornecidos. |

---

## 15. Possibilidades de Evolução

Com base na estrutura já implementada, o SIC-Biometria possui potencial para evoluções que ampliariam sua contribuição para a gestão:

**Ampliação dos indicadores.** Criação de novos indicadores gerenciais a partir do cruzamento de dados já disponíveis — por exemplo, correlação entre o volume de chamados de uma unidade e o volume de faltas dos servidores daquela mesma unidade.

**Novos dashboards gerenciais.** Desenvolvimento de painéis específicos para a Administração, com visão consolidada dos principais indicadores de biometria, frequência e servidores em uma única tela.

**Análise histórica aprofundada.** À medida que o sistema acumula mais dados, torna-se possível realizar análises de longo prazo, identificando tendências anuais e padrões sazonais.

**Alertas automáticos.** Implementação de alertas que notifiquem a equipe quando determinados indicadores ultrapassem limites definidos — por exemplo, quando uma secretaria apresentar volume de faltas significativamente acima da média.

**Relatórios automatizados.** Geração periódica de relatórios consolidados em formato PDF para envio à Administração, eliminando a necessidade de elaboração manual.

**Integração com o sistema de chamados externo.** Conexão direta via API com o sistema Auvo/AdvancisMax para importação automática de chamados, eliminando o upload manual de planilhas.

**Expansão para outras áreas.** A estrutura modular do sistema permite, no futuro, incorporar funcionalidades relacionadas a outros processos da Secretaria de Administração que se beneficiem de centralização e análise de dados.

**Melhoria da tomada de decisão.** Com dados consolidados de chamados, equipamentos, frequência, folha e servidores em um único ambiente, a Administração passa a contar com uma base integrada para decisões mais fundamentadas.

---

## 16. Conclusão

O SIC-Biometria representa uma iniciativa de transformação dos processos de gestão da biometria facial na Prefeitura de Osasco. O sistema evolui de controles operacionais dispersos para uma estrutura centralizada de informação e apoio à gestão.

O projeto consolidou em uma única plataforma a gestão de chamados técnicos, o inventário de equipamentos, o processamento de prévias de frequência, a análise de dados de folha de pagamento, a consulta ao quadro de servidores e o registro de protocolos internos — funcionalidades que antes dependiam de controles manuais, planilhas avulsas e processos fragmentados.

Além da organização operacional, o SIC-Biometria produz informação gerencial que permite à Administração acompanhar indicadores, identificar padrões, comparar períodos e fundamentar decisões com base em dados concretos.

O sistema opera integralmente com custo zero para a Prefeitura e foi desenvolvido internamente pelo Setor de Biometria Facial, demonstrando a capacidade da equipe de utilizar recursos disponíveis para produzir soluções que agreguem valor à gestão municipal.

Com uma base sólida de funcionalidades já implementadas e com possibilidades concretas de evolução, o SIC-Biometria posiciona-se como uma ferramenta relevante para a modernização da gestão administrativa no âmbito da Secretaria de Administração.

---

*Documento elaborado em agosto de 2026.*  
*Prefeitura Municipal de Osasco — Secretaria de Administração — Setor de Biometria Facial.*
