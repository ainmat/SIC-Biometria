# SIC-Biometria Dashboard

Dashboard de monitoramento de chamados do sistema de biometria da Prefeitura de Osasco.

## Estrutura do Projeto

```
Dashboard-Biometria/
├── index.html              # Página principal (HTML limpo e semântico)
├── css/
│   └── styles.css          # Estilos CSS organizados
├── js/
│   └── script.js           # Lógica JavaScript
├── assets/                 # Recursos estáticos (criar se necessário)
└── README.md               # Documentação do projeto
```

## Tecnologias Utilizadas

- **HTML5**: Estrutura semântica
- **CSS3**: Estilos modernos com variáveis CSS
- **JavaScript ES6+**: Lógica interativa
- **Chart.js**: Visualização de dados
- **Supabase**: Banco de dados e realtime
- **Google Fonts**: Tipografia (Sora e JetBrains Mono)

## Funcionalidades

- ✅ Dashboard em tempo real
- ✅ Filtros por secretaria
- ✅ KPIs dinâmicos
- ✅ Gráficos interativos
- ✅ Tabela de ocorrências
- ✅ Timeline de eventos
- ✅ Design responsivo
- ✅ Interface dark mode

## Como Usar

1. Abra o arquivo `index.html` em um navegador moderno
2. O dashboard se conectará automaticamente ao Supabase
3. Os dados serão carregados e atualizados em tempo real

## Personalização

### Cores
As cores estão definidas como variáveis CSS no arquivo `css/styles.css`:

```css
:root {
  --bg:       #070b14;    /* Fundo principal */
  --surface:  #0d1424;    /* Superfície */
  --card:     #111827;    /* Cards */
  --accent:   #3b82f6;    /* Cor primária */
  /* ... */
}
```

### Dados
Configure a conexão com o Supabase no arquivo `js/script.js`:

```javascript
const SUPABASE_URL = 'sua-url';
const SUPABASE_ANON_KEY = 'sua-chave';
```

## Melhorias Futuras

- [ ] Sistema de autenticação
- [ ] Exportação de relatórios
- [ ] Notificações push
- [ ] Modo offline
- [ ] Testes automatizados
