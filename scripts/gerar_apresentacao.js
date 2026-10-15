/**
 * ============================================================
 * SIC-Biometria — Gerador de Apresentação PPTX
 * Prefeitura Municipal de Osasco
 * Execute: node gerar_apresentacao.js
 * ============================================================
 */
import PptxGenJS from 'pptxgenjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Paleta de Cores ───────────────────────────────────────
const COLORS = {
  dark:       '070B14',
  darkBlue:   '0D1424',
  card:       '111827',
  accent:     '3B82F6',
  accentDark: '1E40AF',
  purple:     '6366F1',
  emerald:    '10B981',
  amber:      'F59E0B',
  red:        'EF4444',
  white:      'FFFFFF',
  gray100:    'F1F5F9',
  gray300:    'CBD5E1',
  gray400:    '94A3B8',
  gray500:    '64748B',
  gray700:    '334155',
  transparent:'000000',
};

// ─── Helpers ───────────────────────────────────────────────
function addFooter(slide, slideNum, total) {
  slide.addText(`SIC-Biometria  ·  Prefeitura de Osasco  ·  Julho 2026`, {
    x: 0.3, y: 6.9, w: 8, h: 0.3,
    fontSize: 7, color: COLORS.gray500,
    fontFace: 'Arial',
  });
  slide.addText(`${slideNum}/${total}`, {
    x: 8.3, y: 6.9, w: 1.3, h: 0.3,
    fontSize: 7, color: COLORS.gray500, align: 'right',
    fontFace: 'Arial',
  });
}

function addSectionHeader(slide, title, subtitle) {
  // Barra de destaque
  slide.addShape('rect', {
    x: 0, y: 0, w: 0.08, h: 7.5,
    fill: { color: COLORS.accent },
  });
  
  slide.addText(title, {
    x: 0.5, y: 0.35, w: 9, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.white,
    fontFace: 'Arial',
  });
  
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.5, y: 0.85, w: 9, h: 0.35,
      fontSize: 11, color: COLORS.gray400,
      fontFace: 'Arial',
    });
  }
  
  // Linha separadora
  slide.addShape('rect', {
    x: 0.5, y: 1.25, w: 9, h: 0.015,
    fill: { color: COLORS.gray700 },
  });
}

function addCard(slide, x, y, w, h, opts = {}) {
  slide.addShape('roundRect', {
    x, y, w, h,
    rectRadius: 0.08,
    fill: { color: opts.fill || COLORS.card },
    shadow: {
      type: 'outer', blur: 6, offset: 2, angle: 270,
      color: '000000', opacity: 0.25,
    },
  });
  
  // Borda superior colorida
  if (opts.accentColor) {
    slide.addShape('rect', {
      x: x + 0.08, y, w: w - 0.16, h: 0.03,
      fill: { color: opts.accentColor },
    });
  }
}

function addKPICard(slide, x, y, w, h, { value, label, icon, accentColor }) {
  addCard(slide, x, y, w, h, { accentColor });
  
  // Ícone/emoji
  if (icon) {
    slide.addText(icon, {
      x: x + 0.12, y: y + 0.1, w: 0.4, h: 0.35,
      fontSize: 16,
    });
  }
  
  // Valor
  slide.addText(value, {
    x: x + 0.1, y: y + (icon ? 0.4 : 0.15), w: w - 0.2, h: 0.4,
    fontSize: 22, bold: true, color: accentColor || COLORS.accent,
    fontFace: 'Arial',
  });
  
  // Label
  slide.addText(label, {
    x: x + 0.1, y: y + (icon ? 0.75 : 0.5), w: w - 0.2, h: 0.3,
    fontSize: 8, color: COLORS.gray400,
    fontFace: 'Arial',
  });
}

function addBulletList(slide, x, y, w, items, opts = {}) {
  const textItems = items.map(item => ({
    text: item.text || item,
    options: {
      fontSize: opts.fontSize || 11,
      color: item.color || opts.color || COLORS.gray300,
      fontFace: 'Arial',
      bullet: { type: 'bullet', color: item.bulletColor || opts.bulletColor || COLORS.accent },
      breakLine: true,
      paraSpaceAfter: 6,
      ...(item.bold ? { bold: true } : {}),
    },
  }));
  
  slide.addText(textItems, {
    x, y, w, h: opts.h || 4,
    valign: 'top',
  });
}

// ─── Apresentação ──────────────────────────────────────────
const TOTAL_SLIDES = 14;
const pptx = new PptxGenJS();

pptx.author = 'Mateus Carvalho';
pptx.company = 'Prefeitura Municipal de Osasco';
pptx.subject = 'SIC-Biometria — Apresentação do Projeto';
pptx.title = 'SIC-Biometria — Sistema Integrado de Controle';

// Layout 16:9
pptx.defineLayout({ name: 'WIDE', width: 10, height: 7.5 });
pptx.layout = 'WIDE';

// ═══════════════════════════════════════════════════════════
// SLIDE 1 — CAPA
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  
  // Fundo gradiente simulado com camadas
  slide.background = { color: COLORS.dark };
  
  // Decoração — formas geométricas sutis
  slide.addShape('rect', {
    x: -1, y: -1, w: 5, h: 9.5,
    fill: { color: COLORS.darkBlue },
    rotate: -5,
  });
  
  slide.addShape('ellipse', {
    x: 7, y: 4.5, w: 5, h: 5,
    fill: { type: 'solid', color: COLORS.accentDark },
    transparency: 90,
  });
  
  // Logo da Prefeitura
  const logoPath = path.join(__dirname, 'img', 'logo-prefeitura-osasco.png');
  if (fs.existsSync(logoPath)) {
    slide.addImage({
      path: logoPath,
      x: 0.6, y: 0.5, w: 1.2, h: 1.2,
    });
  }
  
  // Logo DARH
  const logoDarh = path.join(__dirname, 'img', 'logo-darh.png');
  if (fs.existsSync(logoDarh)) {
    slide.addImage({
      path: logoDarh,
      x: 2.0, y: 0.55, w: 1.0, h: 1.0,
    });
  }
  
  // Título principal
  slide.addText('SIC · Biometria', {
    x: 0.6, y: 2.2, w: 8.5, h: 0.9,
    fontSize: 40, bold: true, color: COLORS.white,
    fontFace: 'Arial',
  });
  
  slide.addText('Sistema Integrado de Controle', {
    x: 0.6, y: 3.0, w: 8.5, h: 0.55,
    fontSize: 20, color: COLORS.accent,
    fontFace: 'Arial',
  });
  
  // Descrição
  slide.addText('Plataforma de Data Pipeline e Observabilidade para gestão inteligente\nde biometria facial, ponto biométrico, folha e servidores.', {
    x: 0.6, y: 3.7, w: 7, h: 0.8,
    fontSize: 11, color: COLORS.gray400,
    fontFace: 'Arial',
    lineSpacing: 18,
  });
  
  // Linha decorativa
  slide.addShape('rect', {
    x: 0.6, y: 4.7, w: 2.5, h: 0.04,
    fill: { color: COLORS.accent },
  });
  
  // Info
  slide.addText([
    { text: 'Prefeitura Municipal de Osasco\n', options: { fontSize: 11, bold: true, color: COLORS.gray300, fontFace: 'Arial' } },
    { text: 'Departamento de Administração e Recursos Humanos — DARH\n', options: { fontSize: 9, color: COLORS.gray500, fontFace: 'Arial' } },
    { text: 'Setor de Biometria Facial\n\n', options: { fontSize: 9, color: COLORS.gray500, fontFace: 'Arial' } },
    { text: 'Julho de 2026  ·  Versão 2.0', options: { fontSize: 9, color: COLORS.accent, fontFace: 'Arial' } },
  ], {
    x: 0.6, y: 5.0, w: 5, h: 1.5,
    valign: 'top',
  });
  
  // Badge "Custo Zero"
  addCard(slide, 7.2, 5.5, 2.2, 0.8, { accentColor: COLORS.emerald });
  slide.addText('💰 CUSTO TOTAL', {
    x: 7.3, y: 5.55, w: 2, h: 0.3,
    fontSize: 7, bold: true, color: COLORS.emerald, fontFace: 'Arial',
  });
  slide.addText('R$ 0,00 / mês', {
    x: 7.3, y: 5.85, w: 2, h: 0.35,
    fontSize: 16, bold: true, color: COLORS.emerald, fontFace: 'Arial',
  });
  
  addFooter(slide, 1, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 2 — VISÃO GERAL / PROBLEMA & SOLUÇÃO
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'O Problema e a Solução', 'Por que o SIC-Biometria foi criado');
  
  // Lado esquerdo — Problema
  addCard(slide, 0.5, 1.6, 4.2, 4.5, { accentColor: COLORS.red });
  slide.addText('❌  O PROBLEMA', {
    x: 0.7, y: 1.75, w: 3.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.red, fontFace: 'Arial',
  });
  
  addBulletList(slide, 0.7, 2.25, 3.8, [
    { text: 'Gestão de chamados feita manualmente em planilhas dispersas', bulletColor: COLORS.red },
    { text: 'Sem visibilidade em tempo real do estado dos equipamentos', bulletColor: COLORS.red },
    { text: 'Classificação de incidentes feita à mão, sujeita a erros', bulletColor: COLORS.red },
    { text: 'Prévias de frequência conferidas individualmente por secretaria', bulletColor: COLORS.red },
    { text: 'Folha de pagamento sem cruzamento automatizado com ponto', bulletColor: COLORS.red },
    { text: 'Informações de servidores fragmentadas em múltiplos sistemas', bulletColor: COLORS.red },
    { text: 'Protocolos internos sem rastreabilidade digital', bulletColor: COLORS.red },
  ], { fontSize: 10, h: 4, bulletColor: COLORS.red });
  
  // Lado direito — Solução
  addCard(slide, 5.3, 1.6, 4.2, 4.5, { accentColor: COLORS.emerald });
  slide.addText('✅  A SOLUÇÃO', {
    x: 5.5, y: 1.75, w: 3.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.emerald, fontFace: 'Arial',
  });
  
  addBulletList(slide, 5.5, 2.25, 3.8, [
    { text: 'Dashboard unificado com 6 módulos integrados', bulletColor: COLORS.emerald },
    { text: 'Pipeline automatizado com IA (Gemini Flash)', bulletColor: COLORS.emerald },
    { text: 'Classificação semântica automática de chamados', bulletColor: COLORS.emerald },
    { text: 'Simulador de prévias com processamento em lote', bulletColor: COLORS.emerald },
    { text: 'Conferência automatizada de folha × ponto', bulletColor: COLORS.emerald },
    { text: 'Painel completo de análise do quadro de servidores', bulletColor: COLORS.emerald },
    { text: 'Protocolo digital com tramitação e histórico', bulletColor: COLORS.emerald },
  ], { fontSize: 10, h: 4, bulletColor: COLORS.emerald });
  
  // Destaque inferior
  addCard(slide, 0.5, 6.25, 9, 0.5, { accentColor: COLORS.accent });
  slide.addText('🎯  100% gratuito  ·  Sem dependência de fornecedor  ·  Atualização em tempo real  ·  Desenvolvido internamente', {
    x: 0.7, y: 6.3, w: 8.6, h: 0.4,
    fontSize: 10, bold: true, color: COLORS.accent, fontFace: 'Arial',
    align: 'center',
  });
  
  addFooter(slide, 2, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 3 — MÓDULOS DO SISTEMA
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Módulos do Sistema', 'Visão geral dos 6 módulos integrados na plataforma');
  
  const modules = [
    { icon: '🔧', title: 'Equipamentos\ne Chamados', desc: 'Dashboard de chamados, parque de equipamentos, análise de tendências e unidades críticas', color: COLORS.accent, pages: '5 telas' },
    { icon: '⏱️', title: 'Ponto\nBiométrico', desc: 'Simulador de prévias, histórico de competências e BI/Indicadores de frequência', color: COLORS.purple, pages: '3 telas' },
    { icon: '💰', title: 'Folha de\nPagamento', desc: 'Importação, dashboard, simulador, comparativo mensal e conferência ponto × folha', color: COLORS.emerald, pages: '5 telas' },
    { icon: '👥', title: 'Servidores', desc: 'Diretório, aposentadoria, comissionados, escolaridade, perfil, saúde e simulador', color: COLORS.amber, pages: '10 telas' },
    { icon: '📋', title: 'Protocolo\nDigital', desc: 'Criação, consulta e painel de protocolos com tramitação e rastreabilidade', color: COLORS.red, pages: '3 telas' },
    { icon: '⚙️', title: 'Administração', desc: 'Gestão de usuários, controle de acesso por perfil (Master, Admin, Visitante)', color: COLORS.gray400, pages: '1 tela' },
  ];
  
  modules.forEach((mod, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.5 + col * 3.15;
    const y = 1.55 + row * 2.7;
    
    addCard(slide, x, y, 2.85, 2.4, { accentColor: mod.color });
    
    slide.addText(mod.icon, {
      x: x + 0.12, y: y + 0.12, w: 0.4, h: 0.35,
      fontSize: 18,
    });
    
    slide.addText(mod.pages, {
      x: x + 1.8, y: y + 0.12, w: 0.9, h: 0.22,
      fontSize: 7, bold: true, color: mod.color, fontFace: 'Arial',
      align: 'right',
    });
    
    slide.addText(mod.title, {
      x: x + 0.12, y: y + 0.5, w: 2.6, h: 0.55,
      fontSize: 12, bold: true, color: COLORS.white, fontFace: 'Arial',
      lineSpacing: 15,
    });
    
    slide.addText(mod.desc, {
      x: x + 0.12, y: y + 1.1, w: 2.6, h: 1.1,
      fontSize: 8.5, color: COLORS.gray400, fontFace: 'Arial',
      lineSpacing: 13,
    });
  });
  
  addFooter(slide, 3, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 4 — ARQUITETURA TÉCNICA
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Arquitetura do Sistema', 'Event-Driven Pipeline com 5 camadas de software');
  
  // Fluxo horizontal com setas
  const layers = [
    { icon: '📊', label: 'Ingestão', tool: 'Google Sheets\n+ Upload', color: COLORS.emerald },
    { icon: '⚡', label: 'ETL', tool: 'n8n\nSelf-hosted', color: COLORS.amber },
    { icon: '🤖', label: 'Inteligência', tool: 'Gemini Flash\nIA do Google', color: COLORS.purple },
    { icon: '🗄️', label: 'Persistência', tool: 'Supabase\nPostgreSQL', color: COLORS.accent },
    { icon: '📱', label: 'Apresentação', tool: 'React + Vite\nVercel', color: COLORS.red },
  ];
  
  layers.forEach((layer, i) => {
    const x = 0.35 + i * 1.95;
    const y = 1.55;
    
    addCard(slide, x, y, 1.65, 1.9, { accentColor: layer.color });
    
    slide.addText(layer.icon, {
      x: x + 0.55, y: y + 0.12, w: 0.55, h: 0.4,
      fontSize: 20, align: 'center',
    });
    
    slide.addText(layer.label, {
      x: x + 0.08, y: y + 0.55, w: 1.5, h: 0.3,
      fontSize: 10, bold: true, color: layer.color, fontFace: 'Arial',
      align: 'center',
    });
    
    slide.addText(layer.tool, {
      x: x + 0.08, y: y + 0.9, w: 1.5, h: 0.7,
      fontSize: 8, color: COLORS.gray400, fontFace: 'Arial',
      align: 'center', lineSpacing: 13,
    });
    
    // Seta →
    if (i < layers.length - 1) {
      slide.addText('→', {
        x: x + 1.62, y: y + 0.6, w: 0.35, h: 0.4,
        fontSize: 18, color: COLORS.gray500, fontFace: 'Arial',
        align: 'center',
      });
    }
  });
  
  // Descrição do fluxo
  addCard(slide, 0.5, 3.85, 9, 3.1);
  slide.addText('📡  Fluxo de Dados — Passo a Passo', {
    x: 0.7, y: 3.95, w: 8, h: 0.35,
    fontSize: 11, bold: true, color: COLORS.accent, fontFace: 'Arial',
  });
  
  const steps = [
    { text: '1.  Operador exporta planilha semanal de chamados do AdvancisMax/Auvo', color: COLORS.gray300 },
    { text: '2.  n8n detecta automaticamente a nova planilha via upload de arquivo', color: COLORS.gray300 },
    { text: '3.  n8n processa e estrutura os dados da planilha semanal', color: COLORS.gray300 },
    { text: '4.  Gemini Flash (IA) interpreta e classifica os chamados semanticamente', color: COLORS.gray300 },
    { text: '5.  Supabase salva via upsert — atualiza se ticket já existir (idempotente)', color: COLORS.gray300 },
    { text: '6.  Dashboard web atualiza instantaneamente via Supabase Realtime (WebSocket)', color: COLORS.gray300 },
  ];
  
  addBulletList(slide, 0.7, 4.35, 8.5, steps, { fontSize: 10, h: 2.5, bulletColor: COLORS.accent });
  
  addFooter(slide, 4, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 5 — MÓDULO: EQUIPAMENTOS E CHAMADOS
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Módulo: Equipamentos e Chamados', 'Gestão inteligente do parque de biometria facial');
  
  // Telas disponíveis
  const telas = [
    { title: 'Painel de Chamados', desc: 'Dashboard com KPIs em tempo real, filtros por secretaria, gráficos de distribuição por motivo/severidade, timeline de eventos e tabela de ocorrências.' },
    { title: 'Parque de Equipamentos', desc: 'Inventário completo do parque de biometria com status (ativo/manutenção/inativo), localização, modelo, série e histórico de manutenções.' },
    { title: 'Todos os Chamados', desc: 'Listagem completa com busca, filtros avançados e visualização detalhada de cada ticket com classificação IA.' },
    { title: 'Unidades Críticas', desc: 'Identificação automática de unidades com múltiplos chamados recorrentes, permitindo ação preventiva.' },
    { title: 'Análise de Tendências', desc: 'Gráficos de evolução temporal, projeções e detecção de padrões para planejamento estratégico.' },
  ];
  
  telas.forEach((tela, i) => {
    const y = 1.55 + i * 1.0;
    addCard(slide, 0.5, y, 9, 0.85, { accentColor: COLORS.accent });
    
    slide.addText(tela.title, {
      x: 0.7, y: y + 0.08, w: 2.5, h: 0.35,
      fontSize: 11, bold: true, color: COLORS.accent, fontFace: 'Arial',
    });
    
    slide.addText(tela.desc, {
      x: 3.3, y: y + 0.08, w: 6, h: 0.7,
      fontSize: 9, color: COLORS.gray400, fontFace: 'Arial',
      lineSpacing: 13,
    });
  });
  
  // Classificação IA
  addCard(slide, 0.5, 6.6, 9, 0.65, { accentColor: COLORS.purple });
  slide.addText('🤖  Classificação por IA:', {
    x: 0.7, y: 6.65, w: 2, h: 0.25,
    fontSize: 9, bold: true, color: COLORS.purple, fontFace: 'Arial',
  });
  slide.addText('Motivos: Suporte/Fixação  |  Falha de Reconhecimento  |  Equipamento Inoperante  |  Configuração/Instalação     ·     Severidade: Alta  |  Média  |  Baixa', {
    x: 0.7, y: 6.9, w: 8.6, h: 0.25,
    fontSize: 8, color: COLORS.gray400, fontFace: 'Arial',
  });
  
  addFooter(slide, 5, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 6 — MÓDULO: PONTO BIOMÉTRICO
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Módulo: Ponto Biométrico', 'Prévias de frequência com processamento em lote e indicadores');
  
  const features = [
    {
      icon: '📥', title: 'Importação Inteligente',
      desc: 'Upload de planilhas Excel (.xlsx) com processamento em lote server-side. Suporte a múltiplas competências com controle de duplicatas via upsert.',
      color: COLORS.purple,
    },
    {
      icon: '🧮', title: 'Simulador de Prévias',
      desc: 'Cruzamento automático de marcações do ponto com cadastro de servidores. Cálculo de faltas, atrasos, DSR e percentuais de desconto por secretaria.',
      color: COLORS.accent,
    },
    {
      icon: '📊', title: 'BI / Indicadores',
      desc: 'Dashboard analítico com ranking de secretarias, Z-Score estatístico, classificação de alertas e comparativo mensal de ocorrências.',
      color: COLORS.emerald,
    },
    {
      icon: '📅', title: 'Histórico de Competências',
      desc: 'Visualização temporal de todas as competências publicadas com métricas consolidadas e evolução por secretaria.',
      color: COLORS.amber,
    },
  ];
  
  features.forEach((feat, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.6;
    const y = 1.55 + row * 2.55;
    
    addCard(slide, x, y, 4.25, 2.2, { accentColor: feat.color });
    
    slide.addText(feat.icon + '  ' + feat.title, {
      x: x + 0.15, y: y + 0.12, w: 3.95, h: 0.35,
      fontSize: 12, bold: true, color: feat.color, fontFace: 'Arial',
    });
    
    slide.addText(feat.desc, {
      x: x + 0.15, y: y + 0.55, w: 3.95, h: 1.5,
      fontSize: 9.5, color: COLORS.gray400, fontFace: 'Arial',
      lineSpacing: 15,
    });
  });
  
  addFooter(slide, 6, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 7 — MÓDULO: FOLHA DE PAGAMENTO
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Módulo: Folha de Pagamento', 'Análise, simulação e conferência automatizada da folha processada');
  
  const features = [
    { icon: '📥', title: 'Importar Folha', desc: 'Upload de planilhas da folha processada com parsing inteligente. Extrai faltas, atrasos, HE 50/100%, adicional noturno e DSR.', color: COLORS.emerald },
    { icon: '📊', title: 'Dashboard Folha', desc: 'Visão consolidada por secretaria com totais de faltas, atrasos e horas extras. Filtros dinâmicos e cards de resumo.', color: COLORS.accent },
    { icon: '🧮', title: 'Simulador', desc: 'Simulação de cenários "what-if" sobre a folha. Projeção de impacto financeiro de faltas e atrasos por secretaria.', color: COLORS.purple },
    { icon: '📈', title: 'Comparativo', desc: 'Análise mês a mês com gráficos de evolução, variação percentual e detecção de anomalias entre competências.', color: COLORS.amber },
    { icon: '✅', title: 'Conferência Ponto × Folha', desc: 'Cruzamento automático dos dados de ponto biométrico com a folha processada. Identificação de divergências.', color: COLORS.red },
  ];
  
  features.forEach((feat, i) => {
    const y = 1.55 + i * 1.05;
    addCard(slide, 0.5, y, 9, 0.9, { accentColor: feat.color });
    
    slide.addText(feat.icon + '  ' + feat.title, {
      x: 0.7, y: y + 0.08, w: 2.5, h: 0.35,
      fontSize: 11, bold: true, color: feat.color, fontFace: 'Arial',
    });
    
    slide.addText(feat.desc, {
      x: 3.3, y: y + 0.08, w: 6, h: 0.7,
      fontSize: 9, color: COLORS.gray400, fontFace: 'Arial',
      lineSpacing: 13,
    });
  });
  
  addFooter(slide, 7, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 8 — MÓDULO: SERVIDORES
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Módulo: Servidores', 'Análise completa do quadro de pessoal — 10 telas de inteligência');
  
  const submodules = [
    { title: 'Painel Executivo', desc: 'KPIs consolidados do quadro', color: COLORS.accent },
    { title: 'Diretório', desc: 'Busca e consulta de servidores', color: COLORS.accent },
    { title: 'Radar de Aposentadoria', desc: 'Projeção de aposentadorias por período', color: COLORS.amber },
    { title: 'Comissionados × Efetivos', desc: 'Análise de proporção e distribuição', color: COLORS.purple },
    { title: 'Descompasso Escolaridade', desc: 'Servidores com escolaridade acima/abaixo do cargo', color: COLORS.emerald },
    { title: 'Perfil do Quadro', desc: 'Demografia, gênero e distribuição etária', color: COLORS.accent },
    { title: 'Saúde do Quadro', desc: 'Indicadores de absenteísmo e rotatividade', color: COLORS.red },
    { title: 'Auditoria', desc: 'Alertas e inconsistências detectadas', color: COLORS.amber },
    { title: 'Simulador de Cenários', desc: 'Projeções de impacto em aposentadorias', color: COLORS.purple },
    { title: 'Sentinel de Jornadas', desc: 'Monitoramento de jornadas de trabalho', color: COLORS.emerald },
  ];
  
  submodules.forEach((mod, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.5 + col * 4.8;
    const y = 1.55 + row * 1.05;
    
    addCard(slide, x, y, 4.4, 0.85, { accentColor: mod.color });
    
    slide.addText(mod.title, {
      x: x + 0.15, y: y + 0.08, w: 2, h: 0.3,
      fontSize: 10, bold: true, color: mod.color, fontFace: 'Arial',
    });
    
    slide.addText(mod.desc, {
      x: x + 0.15, y: y + 0.4, w: 4.1, h: 0.35,
      fontSize: 8.5, color: COLORS.gray400, fontFace: 'Arial',
    });
  });
  
  addFooter(slide, 8, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 9 — MÓDULO: PROTOCOLO DIGITAL
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Módulo: Protocolo Digital', 'Tramitação e rastreabilidade de solicitações internas');
  
  const features = [
    {
      icon: '📋', title: 'Painel de Protocolos',
      desc: 'Visão geral com KPIs de status (Aberto, Em Andamento, Concluído), filtros por secretaria, prioridade e responsável. Indicadores de SLA e prazo.',
      color: COLORS.accent,
    },
    {
      icon: '🔍', title: 'Consulta de Protocolos',
      desc: 'Busca avançada por número, requerente, matrícula ou secretaria. Visualização do histórico completo de tramitação com timeline detalhada.',
      color: COLORS.purple,
    },
    {
      icon: '➕', title: 'Novo Protocolo',
      desc: 'Formulário de abertura com geração automática de número, definição de prioridade, prazo estimado e anexo de documentos.',
      color: COLORS.emerald,
    },
  ];
  
  features.forEach((feat, i) => {
    const y = 1.55 + i * 1.7;
    addCard(slide, 0.5, y, 9, 1.4, { accentColor: feat.color });
    
    slide.addText(feat.icon + '  ' + feat.title, {
      x: 0.7, y: y + 0.1, w: 8, h: 0.35,
      fontSize: 13, bold: true, color: feat.color, fontFace: 'Arial',
    });
    
    slide.addText(feat.desc, {
      x: 0.7, y: y + 0.5, w: 8.6, h: 0.8,
      fontSize: 10, color: COLORS.gray400, fontFace: 'Arial',
      lineSpacing: 15,
    });
  });
  
  addFooter(slide, 9, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 10 — SEGURANÇA E GOVERNANÇA
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Segurança e Governança', 'Autenticação, controle de acesso e auditoria completa');
  
  // Autenticação
  addCard(slide, 0.5, 1.55, 4.25, 2.5, { accentColor: COLORS.accent });
  slide.addText('🔐  Autenticação', {
    x: 0.7, y: 1.65, w: 3.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.accent, fontFace: 'Arial',
  });
  addBulletList(slide, 0.7, 2.05, 3.8, [
    'Login com username e senha (bcrypt)',
    'Sessões com token UUID de 24h',
    'Validação server-side via RPC',
    'Todas as operações críticas autenticadas',
    'Senhas armazenadas com hash + salt',
  ], { fontSize: 9, h: 2, bulletColor: COLORS.accent });
  
  // Controle de Acesso
  addCard(slide, 5.25, 1.55, 4.25, 2.5, { accentColor: COLORS.purple });
  slide.addText('👥  Controle de Acesso (RBAC)', {
    x: 5.45, y: 1.65, w: 3.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.purple, fontFace: 'Arial',
  });
  addBulletList(slide, 5.45, 2.05, 3.8, [
    { text: 'Master: acesso total + gestão de usuários', bold: true },
    { text: 'Admin: importação de dados + operações', bold: true },
    { text: 'Visitante: visualização e consulta', bold: true },
    'Rotas protegidas com RequireAuth',
    'Menus filtrados por perfil no Sidebar',
  ], { fontSize: 9, h: 2, bulletColor: COLORS.purple });
  
  // Segurança de dados
  addCard(slide, 0.5, 4.3, 4.25, 2.5, { accentColor: COLORS.emerald });
  slide.addText('🛡️  Segurança de Dados', {
    x: 0.7, y: 4.4, w: 3.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.emerald, fontFace: 'Arial',
  });
  addBulletList(slide, 0.7, 4.8, 3.8, [
    'RLS (Row Level Security) em todas as tabelas',
    'anon_key: somente leitura no dashboard',
    'service_role_key: somente no backend (n8n)',
    'API Keys nunca expostas no frontend',
    'Sanitização de inputs contra XSS',
  ], { fontSize: 9, h: 2, bulletColor: COLORS.emerald });
  
  // Auditoria
  addCard(slide, 5.25, 4.3, 4.25, 2.5, { accentColor: COLORS.amber });
  slide.addText('📋  Auditoria', {
    x: 5.45, y: 4.4, w: 3.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.amber, fontFace: 'Arial',
  });
  addBulletList(slide, 5.45, 4.8, 3.8, [
    'Log de todas as operações (audit_log)',
    'Registro de usuário, operação e timestamp',
    'Contagem de registros afetados',
    'Rastreabilidade completa de importações',
    'Histórico de tramitação em protocolos',
  ], { fontSize: 9, h: 2, bulletColor: COLORS.amber });
  
  addFooter(slide, 10, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 11 — INFRAESTRUTURA E CUSTO ZERO
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Infraestrutura e Custo Zero', 'Operação 100% gratuita em camadas Free Tier');
  
  // Tabela de custos
  const tableData = [
    ['Serviço', 'Plano', 'Custo', 'Limite'],
    ['Supabase (PostgreSQL + Realtime)', 'Free Tier', 'R$ 0,00', '500 MB / 50k req/mês'],
    ['n8n (ETL + Orquestração)', 'Self-hosted', 'R$ 0,00', 'Execuções ilimitadas'],
    ['Gemini Flash (IA)', 'Free Tier', 'R$ 0,00', '15 req/min, 1M tokens'],
    ['Vercel (Hosting)', 'Hobby Free', 'R$ 0,00', 'Ilimitado p/ estáticos'],
    ['Google Sheets (Input)', 'Free', 'R$ 0,00', 'Planilhas ilimitadas'],
    ['TOTAL MENSAL', '', 'R$ 0,00', '100% GRATUITO'],
  ];
  
  const rows = tableData.map((row, rowIdx) => {
    return row.map((cell, colIdx) => {
      const isHeader = rowIdx === 0;
      const isTotal = rowIdx === tableData.length - 1;
      return {
        text: cell,
        options: {
          fontSize: isHeader ? 9 : 10,
          bold: isHeader || isTotal,
          color: isTotal ? COLORS.emerald : (isHeader ? COLORS.accent : COLORS.gray300),
          fontFace: 'Arial',
          align: colIdx === 2 ? 'center' : 'left',
          fill: { color: isHeader ? COLORS.darkBlue : (rowIdx % 2 === 0 ? COLORS.card : COLORS.dark) },
          border: { type: 'solid', pt: 0.5, color: COLORS.gray700 },
          valign: 'middle',
        },
      };
    });
  });
  
  slide.addTable(rows, {
    x: 0.5, y: 1.55, w: 9,
    colW: [3.2, 1.5, 1.3, 3],
    rowH: [0.35, 0.38, 0.38, 0.38, 0.38, 0.38, 0.42],
  });
  
  // Destaque de economia
  addCard(slide, 0.5, 4.85, 4.25, 2.2, { accentColor: COLORS.emerald });
  slide.addText('💰  Economia Projetada', {
    x: 0.7, y: 4.95, w: 3.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.emerald, fontFace: 'Arial',
  });
  addBulletList(slide, 0.7, 5.35, 3.8, [
    'Zero licenciamento de software',
    'Zero infraestrutura em nuvem paga',
    'Zero consultoria externa',
    'Desenvolvimento 100% interno',
    'Manutenção feita pela própria equipe',
  ], { fontSize: 9.5, h: 1.5, bulletColor: COLORS.emerald });
  
  // Tecnologias
  addCard(slide, 5.25, 4.85, 4.25, 2.2, { accentColor: COLORS.accent });
  slide.addText('🛠️  Stack Tecnológica', {
    x: 5.45, y: 4.95, w: 3.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.accent, fontFace: 'Arial',
  });
  addBulletList(slide, 5.45, 5.35, 3.8, [
    'Frontend: React 19 + Vite + TailwindCSS',
    'Backend: Supabase (PostgreSQL + RPC)',
    'ETL: n8n com workflows visuais',
    'IA: Google Gemini Flash (gratuito)',
    'Deploy: Vercel (CI/CD automático)',
  ], { fontSize: 9.5, h: 1.5, bulletColor: COLORS.accent });
  
  addFooter(slide, 11, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 12 — NÚMEROS E MÉTRICAS
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Números do Projeto', 'Escala e abrangência da plataforma');
  
  const kpis = [
    { value: '27+', label: 'Telas no sistema', icon: '📱', color: COLORS.accent },
    { value: '6', label: 'Módulos integrados', icon: '🧩', color: COLORS.purple },
    { value: '20+', label: 'RPCs seguras (PL/pgSQL)', icon: '🔒', color: COLORS.emerald },
    { value: 'R$ 0', label: 'Custo mensal total', icon: '💰', color: COLORS.amber },
    { value: '< 2s', label: 'Time to Interactive', icon: '⚡', color: COLORS.red },
    { value: '100%', label: 'Desenvolvimento interno', icon: '🏛️', color: COLORS.accent },
  ];
  
  kpis.forEach((kpi, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.5 + col * 3.15;
    const y = 1.55 + row * 2.15;
    
    addKPICard(slide, x, y, 2.85, 1.8, {
      value: kpi.value,
      label: kpi.label,
      icon: kpi.icon,
      accentColor: kpi.color,
    });
  });
  
  // Funcionalidades chave
  addCard(slide, 0.5, 5.85, 9, 1.3, { accentColor: COLORS.accent });
  slide.addText('🎯  Funcionalidades-Chave', {
    x: 0.7, y: 5.95, w: 8.5, h: 0.3,
    fontSize: 11, bold: true, color: COLORS.accent, fontFace: 'Arial',
  });
  
  const funcCols = [
    '✓ Dashboard Realtime\n✓ Classificação por IA\n✓ Upsert idempotente',
    '✓ Simulador de prévias\n✓ Conferência ponto×folha\n✓ BI com Z-Score',
    '✓ Radar de aposentadoria\n✓ Protocolo digital\n✓ Auditoria completa',
  ];
  
  funcCols.forEach((col, i) => {
    slide.addText(col, {
      x: 0.7 + i * 2.95, y: 6.3, w: 2.8, h: 0.75,
      fontSize: 8.5, color: COLORS.gray300, fontFace: 'Arial',
      lineSpacing: 13,
    });
  });
  
  addFooter(slide, 12, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 13 — ROADMAP E EVOLUÇÃO
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  addSectionHeader(slide, 'Roadmap de Evolução', 'Fases concluídas e próximos passos');
  
  // Fases concluídas
  addCard(slide, 0.5, 1.55, 9, 2.7, { accentColor: COLORS.emerald });
  slide.addText('✅  Fases Concluídas', {
    x: 0.7, y: 1.65, w: 8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.emerald, fontFace: 'Arial',
  });
  
  const concluidas = [
    'Fase 1a — Schema Supabase, tickets inseridos, RLS configurado',
    'Fase 1b — n8n instalado e acessível em ambiente local',
    'Fase 1c — Workflow n8n: Planilha Semanal → Gemini → Supabase',
    'Fase 1d — Dashboard publicado no Vercel com dados reais e Realtime',
    'Fase 2c — Migração de PDFs isolados para planilhas semanais',
    'Fase 2.0 — Migração completa para React 19 + módulos de Folha, Servidores, Protocolo e Admin',
  ];
  
  addBulletList(slide, 0.7, 2.05, 8.5, concluidas, { fontSize: 9.5, h: 2.2, bulletColor: COLORS.emerald });
  
  // Em andamento
  addCard(slide, 0.5, 4.5, 4.25, 1.5, { accentColor: COLORS.amber });
  slide.addText('🔄  Em Andamento', {
    x: 0.7, y: 4.6, w: 3.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.amber, fontFace: 'Arial',
  });
  addBulletList(slide, 0.7, 5.0, 3.8, [
    'API Key do Auvo — automação total',
    'Integração com parque de equipamentos',
  ], { fontSize: 9.5, h: 1.0, bulletColor: COLORS.amber });
  
  // Futuro
  addCard(slide, 5.25, 4.5, 4.25, 1.5, { accentColor: COLORS.purple });
  slide.addText('🚀  Próximos Passos', {
    x: 5.45, y: 4.6, w: 3.8, h: 0.35,
    fontSize: 12, bold: true, color: COLORS.purple, fontFace: 'Arial',
  });
  addBulletList(slide, 5.45, 5.0, 3.8, [
    'Notificações push para chamados críticos',
    'Exportação automatizada de relatórios',
  ], { fontSize: 9.5, h: 1.0, bulletColor: COLORS.purple });
  
  // Evolução v1.2 → v2.0
  addCard(slide, 0.5, 6.2, 9, 1.0, { accentColor: COLORS.accent });
  slide.addText('📈  Evolução v1.2 → v2.0:', {
    x: 0.7, y: 6.25, w: 2.3, h: 0.3,
    fontSize: 10, bold: true, color: COLORS.accent, fontFace: 'Arial',
  });
  slide.addText('PDFs → Planilhas estruturadas   ·   Oracle Cloud → Self-hosted local   ·   Vanilla JS → React 19   ·   1 módulo → 6 módulos integrados', {
    x: 0.7, y: 6.55, w: 8.6, h: 0.5,
    fontSize: 9, color: COLORS.gray300, fontFace: 'Arial',
    lineSpacing: 14,
  });
  
  addFooter(slide, 13, TOTAL_SLIDES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 14 — ENCERRAMENTO
// ═══════════════════════════════════════════════════════════
{
  const slide = pptx.addSlide();
  slide.background = { color: COLORS.dark };
  
  // Decoração
  slide.addShape('ellipse', {
    x: -2, y: -2, w: 6, h: 6,
    fill: { color: COLORS.accentDark },
    transparency: 92,
  });
  
  slide.addShape('ellipse', {
    x: 7, y: 4, w: 5, h: 5,
    fill: { color: COLORS.purple },
    transparency: 93,
  });
  
  // Logo
  const logoPath2 = path.join(__dirname, 'img', 'logo-prefeitura-osasco.png');
  if (fs.existsSync(logoPath2)) {
    slide.addImage({
      path: logoPath2,
      x: 4.2, y: 0.8, w: 1.5, h: 1.5,
    });
  }
  
  slide.addText('SIC · Biometria', {
    x: 1, y: 2.5, w: 8, h: 0.8,
    fontSize: 36, bold: true, color: COLORS.white, fontFace: 'Arial',
    align: 'center',
  });
  
  slide.addText('Sistema Integrado de Controle', {
    x: 1, y: 3.2, w: 8, h: 0.5,
    fontSize: 18, color: COLORS.accent, fontFace: 'Arial',
    align: 'center',
  });
  
  // Linha
  slide.addShape('rect', {
    x: 3.5, y: 3.9, w: 3, h: 0.03,
    fill: { color: COLORS.gray700 },
  });
  
  // Resumo
  slide.addText([
    { text: '6 módulos', options: { bold: true, color: COLORS.accent } },
    { text: '  ·  ', options: { color: COLORS.gray500 } },
    { text: '27+ telas', options: { bold: true, color: COLORS.purple } },
    { text: '  ·  ', options: { color: COLORS.gray500 } },
    { text: 'R$ 0,00/mês', options: { bold: true, color: COLORS.emerald } },
    { text: '  ·  ', options: { color: COLORS.gray500 } },
    { text: '100% interno', options: { bold: true, color: COLORS.amber } },
  ], {
    x: 1, y: 4.2, w: 8, h: 0.4,
    fontSize: 12, fontFace: 'Arial',
    align: 'center',
  });
  
  // Créditos
  slide.addText([
    { text: 'Prefeitura Municipal de Osasco\n', options: { fontSize: 12, bold: true, color: COLORS.gray300, fontFace: 'Arial' } },
    { text: 'Departamento de Administração e Recursos Humanos — DARH\n', options: { fontSize: 10, color: COLORS.gray500, fontFace: 'Arial' } },
    { text: 'Setor de Biometria Facial\n\n', options: { fontSize: 10, color: COLORS.gray500, fontFace: 'Arial' } },
    { text: 'Desenvolvido por Mateus Carvalho\n', options: { fontSize: 10, color: COLORS.gray400, fontFace: 'Arial' } },
    { text: 'Julho de 2026', options: { fontSize: 9, color: COLORS.gray500, fontFace: 'Arial' } },
  ], {
    x: 1, y: 5.0, w: 8, h: 2,
    align: 'center', valign: 'top',
  });
  
  addFooter(slide, 14, TOTAL_SLIDES);
}

// ─── Exportar ──────────────────────────────────────────────
const outputPath = path.join(__dirname, 'SIC-Biometria_Apresentacao.pptx');

pptx.writeFile({ fileName: outputPath })
  .then(() => {
    console.log('');
    console.log('══════════════════════════════════════════════════');
    console.log('  ✅  Apresentação gerada com sucesso!');
    console.log(`  📁  ${outputPath}`);
    console.log(`  📊  Total: ${TOTAL_SLIDES} slides`);
    console.log('══════════════════════════════════════════════════');
    console.log('');
  })
  .catch(err => {
    console.error('❌  Erro ao gerar apresentação:', err);
    process.exit(1);
  });
