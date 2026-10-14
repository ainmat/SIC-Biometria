// Utilitário de exportação CSV e Excel — compatível com Excel pt-BR (BOM + separador ;)
// Com suporte a estilos visuais avançados no Excel (cores, fontes, negrito, auto-filtro e zebra)
import * as XLSXStyle from 'xlsx-js-style';

/**
 * Formata datas ISO ou strings no padrão brasileiro DD/MM/YYYY
 * @param {string|Date} dataStr
 * @returns {string}
 */
export function formatarDataBR(dataStr) {
  if (!dataStr) return '';
  const str = String(dataStr).trim();
  // Se já estiver no formato DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    return str.slice(0, 10);
  }
  // Se for YYYY-MM-DD ou ISO
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    const dia = String(dt.getDate()).padStart(2, '0');
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const ano = dt.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  return str;
}

/**
 * Limpa quebras de linha e espaços excessivos para células de CSV/planilhas
 * evitando que linhas se fragmentem no leitor de CSV/Excel
 * @param {any} valor
 * @returns {string}
 */
export function limparTextoQuebras(valor) {
  if (valor == null) return '';
  return String(valor)
    .replace(/\r\n|\r|\n/g, '\n')
    .replace(/\n\s*\n+/g, ' | ')
    .replace(/\n+/g, ' | ')
    .replace(/[\t]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Escapa valores para CSV no formato RFC 4180
 * @param {any} valor
 * @param {boolean} sanitizarQuebras
 * @returns {string}
 */
export function escaparCSV(valor, sanitizarQuebras = true) {
  if (valor == null) return '';
  let s = String(valor);
  if (sanitizarQuebras) {
    s = limparTextoQuebras(s);
  }
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Exporta dados para arquivo CSV formatado para Excel Brasil
 * @param {string} nomeArquivo
 * @param {string[]} cabecalhos
 * @param {any[][]} linhas
 * @param {object} [opcoes]
 */
export function baixarCSV(nomeArquivo, cabecalhos, linhas, opcoes = {}) {
  const sep = opcoes.sep || ';';
  const sanitizar = opcoes.sanitizarQuebras !== false;

  const conteudo = [
    cabecalhos.map((c) => escaparCSV(c, sanitizar)).join(sep),
    ...linhas.map((linha) => linha.map((v) => escaparCSV(v, sanitizar)).join(sep)),
  ].join('\r\n');

  // \uFEFF é o Byte Order Mark (BOM) para o Excel reconhecer UTF-8 automaticamente
  const bom = '\uFEFF';
  const blob = new Blob([bom + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Cores corporativas institucionais (Hex sem '#')
const PALETA = {
  verdeEscuro: '0D5C2E',    // Topo Banner
  verdePrefeitura: '0D7C3D',// Cabeçalho da Tabela
  verdeBorda: '065F46',
  branco: 'FFFFFF',
  cinzaSub: 'F1F5F9',
  cinzaZebra: 'F8FAFC',
  cinzaBorda: 'E2E8F0',
  textoPrincipal: '1E293B',
  textoSecundario: '475569',
  
  // Status Encerrado (Menta suave)
  statusVerdeBg: 'DCFCE7',
  statusVerdeTxt: '166534',
  
  // Status Aberto (Âmbar suave)
  statusAmbarBg: 'FEF3C7',
  statusAmbarTxt: '92400E',
  
  // Em Andamento (Azul suave)
  statusAzulBg: 'DBEAFE',
  statusAzulTxt: '1E40AF',
  
  // Divergente SIM (Vermelho suave)
  divergSimBg: 'FEE2E2',
  divergSimTxt: '991B1B',
  
  // Divergente NÃO (Neutro suave)
  divergNaoBg: 'F1F5F9',
  divergNaoTxt: '475569',
  
  // Tags Secretarias
  secSED: { bg: 'EFF6FF', txt: '1D4ED8' },
  secSS: { bg: 'ECFDF5', txt: '047857' },
  secSETRAN: { bg: 'FFFBEB', txt: 'B45309' },
  secSECULT: { bg: 'FAF5FF', txt: '7E22CE' },
  secPGM: { bg: 'F8FAFC', txt: '334155' },
};

/**
 * Exporta dados diretamente para arquivo Excel (.xlsx) altamente profissional,
 * com cabeçalho institucional estilizado, metadados, formatação zebra,
 * cores de status semânticas, bordas finas, colunas auto-ajustadas e auto-filtro.
 * 
 * @param {string} nomeArquivo
 * @param {string[]} cabecalhos
 * @param {any[][]} linhas
 * @param {object} [opcoes]
 */
export function baixarExcel(nomeArquivo, cabecalhos, linhas, opcoes = {}) {
  const wb = XLSXStyle.utils.book_new();
  const sanitizar = opcoes.sanitizarQuebras !== false;
  const totalCols = cabecalhos.length;

  const linhasTratadas = sanitizar
    ? linhas.map((linha) => linha.map((v) => (typeof v === 'string' ? limparTextoQuebras(v) : v)))
    : linhas;

  const agora = new Date();
  const dataExtracao =
    agora.toLocaleDateString('pt-BR') +
    ' às ' +
    agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  const tituloBanner =
    opcoes.titulo || 'PREFEITURA DO MUNICÍPIO DE OSASCO — SIC BIOMETRIA';
  const subtituloBanner =
    opcoes.subtitulo ||
    `Relatório Operacional de Chamados e Ocorrências | Extraído em: ${dataExtracao} | Total: ${linhasTratadas.length} registro(s)`;

  // Montagem da matriz completa da planilha
  // Linha 1: Banner Principal
  // Linha 2: Subtítulo e Metadados
  // Linha 3: Respiro (espaçador)
  // Linha 4: Cabeçalho da Tabela
  // Linhas 5+: Registros
  const matriz = [
    [tituloBanner, ...Array(totalCols - 1).fill('')],
    [subtituloBanner, ...Array(totalCols - 1).fill('')],
    Array(totalCols).fill(''),
    cabecalhos,
    ...linhasTratadas,
  ];

  // Cálculo de estatísticas para a linha de rodapé (se for relatório de chamados)
  let totalEncerrados = 0;
  let totalAbertos = 0;
  let totalDivergentes = 0;

  linhasTratadas.forEach((row) => {
    // Procura status nas colunas correspondentes (ou por valor)
    const stAuvo = String(row[6] || '');
    if (stAuvo === 'Atendimento Encerrado') totalEncerrados++;
    else if (stAuvo) totalAbertos++;

    const div = String(row[9] || '');
    if (div === 'SIM') totalDivergentes++;
  });

  // Linha de Rodapé (Resumo Estatístico)
  const linhaEspacador = Array(totalCols).fill('');
  const linhaTotais = [
    'RESUMO',
    `${linhasTratadas.length} Chamados Listados`,
    '',
    '',
    '',
    '',
    `Encerrados: ${totalEncerrados}`,
    `Abertos: ${totalAbertos}`,
    '',
    `Divergências: ${totalDivergentes}`,
    '',
  ];

  matriz.push(linhaEspacador);
  matriz.push(linhaTotais);

  const ws = XLSXStyle.utils.aoa_to_sheet(matriz);

  // 1. Merges das Linhas de Título e Subtítulo
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: totalCols - 1 } },
  ];

  // 2. Altura das Linhas (em pontos)
  const rowsConfig = [
    { hpt: 32 }, // Linha 1: Banner de Título
    { hpt: 20 }, // Linha 2: Subtítulo
    { hpt: 8 },  // Linha 3: Espaçador
    { hpt: 28 }, // Linha 4: Cabeçalho da Tabela
    ...linhasTratadas.map(() => ({ hpt: 24 })), // Linhas de Dados
    { hpt: 10 }, // Espaçador antes do rodapé
    { hpt: 24 }, // Linha de Totais
  ];
  ws['!rows'] = rowsConfig;

  // 3. Largura Inteligente das Colunas
  const largurasPadrao = [
    { wch: 13 }, // Ticket
    { wch: 44 }, // Unidade
    { wch: 15 }, // Secretaria
    { wch: 22 }, // Motivo
    { wch: 24 }, // Responsavel
    { wch: 15 }, // Data Abertura
    { wch: 25 }, // Status AUVO
    { wch: 25 }, // Status ASANA
    { wch: 20 }, // Seção ASANA
    { wch: 15 }, // Divergente
    { wch: 70 }, // Problema Relatado
  ];

  // Auto-ajuste para colunas customizadas ou dinâmicas
  const larguras = cabecalhos.map((cab, colIdx) => {
    if (largurasPadrao[colIdx]) return largurasPadrao[colIdx];
    let maxLen = String(cab || '').length;
    const maxLinhasAvaliadas = Math.min(linhasTratadas.length, 200);
    for (let r = 0; r < maxLinhasAvaliadas; r++) {
      const val = linhasTratadas[r]?.[colIdx];
      if (val != null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    }
    return { wch: Math.min(Math.max(maxLen + 3, 12), 65) };
  });

  ws['!cols'] = opcoes.largurasColunas || larguras;

  // 4. Estilização do Banner de Título (A1)
  ws['A1'].s = {
    font: { name: 'Segoe UI', sz: 12.5, bold: true, color: { rgb: PALETA.branco } },
    fill: { fgColor: { rgb: PALETA.verdeEscuro } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  };

  // 5. Estilização do Subtítulo (A2)
  ws['A2'].s = {
    font: { name: 'Segoe UI', sz: 9, italic: true, color: { rgb: PALETA.textoSecundario } },
    fill: { fgColor: { rgb: PALETA.cinzaSub } },
    alignment: { vertical: 'center', horizontal: 'left', indent: 1 },
  };

  // 6. Estilização do Cabeçalho da Tabela (Linha 4, índice r=3)
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSXStyle.utils.encode_cell({ r: 3, c });
    if (!ws[ref]) continue;

    // Alinhamento à esquerda em Unidade (col 1) e Problema (col final), centralizado nos demais
    const isEsquerda = c === 1 || c === totalCols - 1;

    ws[ref].s = {
      font: { name: 'Segoe UI', sz: 10, bold: true, color: { rgb: PALETA.branco } },
      fill: { fgColor: { rgb: PALETA.verdePrefeitura } },
      alignment: {
        vertical: 'center',
        horizontal: isEsquerda ? 'left' : 'center',
        indent: isEsquerda ? 1 : 0,
      },
      border: {
        top: { style: 'thin', color: { rgb: PALETA.verdeBorda } },
        bottom: { style: 'medium', color: { rgb: PALETA.verdeBorda } },
        left: { style: 'thin', color: { rgb: PALETA.verdeBorda } },
        right: { style: 'thin', color: { rgb: PALETA.verdeBorda } },
      },
    };
  }

  // 7. Estilização das Linhas de Dados (Linha 5 em diante, índice r=4)
  for (let r = 0; r < linhasTratadas.length; r++) {
    const rowIdx = r + 4;
    const isEven = r % 2 === 0;
    const bgLinha = isEven ? PALETA.branco : PALETA.cinzaZebra;

    for (let c = 0; c < totalCols; c++) {
      const ref = XLSXStyle.utils.encode_cell({ r: rowIdx, c });
      if (!ws[ref]) continue;

      let fontColor = PALETA.textoPrincipal;
      let cellBg = bgLinha;
      let isBold = false;
      const val = String(ws[ref].v ?? '');

      // Coluna 0: Ticket (#Número)
      if (c === 0) {
        isBold = true;
        fontColor = '0F172A';
      }

      // Coluna 1: Unidade (Destaque sutil)
      if (c === 1) {
        fontColor = '0F172A';
      }

      // Coluna 2: Secretaria (Tag colorida sutil)
      if (c === 2) {
        const secUpper = val.toUpperCase();
        if (PALETA[`sec${secUpper}`]) {
          cellBg = PALETA[`sec${secUpper}`].bg;
          fontColor = PALETA[`sec${secUpper}`].txt;
          isBold = true;
        }
      }

      // Colunas 6 e 7: Status AUVO e Status ASANA
      if (c === 6 || c === 7) {
        if (val === 'Atendimento Encerrado') {
          cellBg = PALETA.statusVerdeBg;
          fontColor = PALETA.statusVerdeTxt;
          isBold = true;
        } else if (val === 'Aguardando Atendimento') {
          cellBg = PALETA.statusAmbarBg;
          fontColor = PALETA.statusAmbarTxt;
          isBold = true;
        } else if (
          val.toLowerCase().includes('andamento') ||
          val.toLowerCase().includes('atendimento')
        ) {
          cellBg = PALETA.statusAzulBg;
          fontColor = PALETA.statusAzulTxt;
          isBold = true;
        }
      }

      // Coluna 9: Divergente (SIM = Alerta Vermelho / NÃO = Neutro)
      if (c === 9) {
        if (val === 'SIM') {
          cellBg = PALETA.divergSimBg;
          fontColor = PALETA.divergSimTxt;
          isBold = true;
        } else {
          cellBg = PALETA.divergNaoBg;
          fontColor = PALETA.divergNaoTxt;
        }
      }

      const isEsquerda = c === 1 || c === totalCols - 1;

      ws[ref].s = {
        font: { name: 'Segoe UI', sz: 9.5, bold: isBold, color: { rgb: fontColor } },
        fill: { fgColor: { rgb: cellBg } },
        alignment: {
          vertical: 'center',
          horizontal: isEsquerda ? 'left' : 'center',
          indent: isEsquerda ? 1 : 0,
          wrapText: c === totalCols - 1, // Quebra de linha no Problema Relatado
        },
        border: {
          top: { style: 'thin', color: { rgb: PALETA.cinzaBorda } },
          bottom: { style: 'thin', color: { rgb: PALETA.cinzaBorda } },
          left: { style: 'thin', color: { rgb: PALETA.cinzaBorda } },
          right: { style: 'thin', color: { rgb: PALETA.cinzaBorda } },
        },
      };
    }
  }

  // 8. Estilização da Linha de Totais / Rodapé
  const rodapéRowIdx = linhasTratadas.length + 5;
  for (let c = 0; c < totalCols; c++) {
    const ref = XLSXStyle.utils.encode_cell({ r: rodapéRowIdx, c });
    if (!ws[ref]) continue;

    ws[ref].s = {
      font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: PALETA.textoPrincipal } },
      fill: { fgColor: { rgb: PALETA.cinzaSub } },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: {
        top: { style: 'double', color: { rgb: '94A3B8' } },
        bottom: { style: 'thin', color: { rgb: '94A3B8' } },
        left: { style: 'thin', color: { rgb: PALETA.cinzaBorda } },
        right: { style: 'thin', color: { rgb: PALETA.cinzaBorda } },
      },
    };
  }

  // 9. Auto-filtro na linha do cabeçalho da tabela (Linha 4)
  const colFinalLetra = XLSXStyle.utils.encode_col(totalCols - 1);
  ws['!autofilter'] = {
    ref: `A4:${colFinalLetra}${linhasTratadas.length + 4}`,
  };

  XLSXStyle.utils.book_append_sheet(wb, ws, opcoes.nomePlanilha || 'Chamados');

  const wbout = XLSXStyle.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo.endsWith('.xlsx') ? nomeArquivo : `${nomeArquivo}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
