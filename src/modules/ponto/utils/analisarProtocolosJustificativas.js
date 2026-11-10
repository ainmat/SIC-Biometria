import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';

/**
 * Padrão de protocolo de 12 dígitos iniciado em 2024, 2025 ou 2026 (ou anos futuros)
 * Exemplo: 202403001234, 202503025553, 202603080804
 */
export const REGEX_PROTOCOLO_PD = /202[4-9]\d{8}/g;

/**
 * Paleta de cores institucional idêntica ao módulo de Horas Extras
 */
const COR = {
  azulEscuro:   '1F3864', // Fundo dos cabeçalhos executivos
  azulPetroleo: '0E7490', // Destaque para protocolos
  azulMedio:    '2E5090',
  branco:       'FFFFFF',
  cinzaZebra:   'F8FAFC',
  cinzaBorda:   'CBD5E1',
  cinzaTotais:  'F1F5F9',
  vermelhoFundo:'FEF2F2',
  vermelho:     'C0392B',
  amareloFundo: 'FEFCE8',
  amarelo:      '856404',
  cinzaTexto:   '475569',
  pretoCel:     '0F172A',
};

function bordaThin(cor = COR.cinzaBorda) {
  const b = { style: 'thin', color: { rgb: cor } };
  return { left: b, right: b, top: b, bottom: b };
}

function estCabecalho(opts = {}) {
  return {
    font:  { name: 'Calibri', sz: 11, bold: true, color: { rgb: COR.branco } },
    fill:  { patternType: 'solid', fgColor: { rgb: opts.cor || COR.azulEscuro } },
    alignment: { horizontal: opts.align || 'center', vertical: 'center', wrapText: true },
    border: bordaThin(COR.cinzaBorda),
  };
}

function estDado(opts = {}) {
  return {
    font:  { name: 'Calibri', sz: 10, bold: opts.bold || false, color: { rgb: opts.fontColor || COR.pretoCel } },
    fill:  opts.fill ? { patternType: 'solid', fgColor: { rgb: opts.fill } } : { patternType: 'none' },
    alignment: { horizontal: opts.align || 'left', vertical: 'center', wrapText: opts.wrapText || false },
    border: bordaThin(COR.cinzaBorda),
    numFmt: opts.numFmt || 'General',
  };
}

function criarSheetFormatada(dados, colsDef, estLinhaFn, corCabecalho = COR.azulEscuro) {
  const ws = XLSXStyle.utils.aoa_to_sheet(dados);
  const nCols = colsDef.length;
  const nRows = dados.length;

  ws['!cols'] = colsDef.map(c => ({ wch: c.w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!autofilter'] = { ref: `A1:${XLSXStyle.utils.encode_col(nCols - 1)}1` };
  ws['!rows'] = Array.from({ length: nRows }, (_, i) => ({
    hpt: i === 0 ? 38 : 19,
  }));

  for (let r = 0; r < nRows; r++) {
    for (let c = 0; c < nCols; c++) {
      const addr = XLSXStyle.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };

      if (r === 0) {
        ws[addr].s = estCabecalho({ cor: corCabecalho, align: colsDef[c].align || 'center' });
      } else {
        const linhaOpts = estLinhaFn ? estLinhaFn(r, dados[r], c) : {};
        const fillBase = r % 2 === 0 ? COR.cinzaZebra : null;

        ws[addr].s = estDado({
          fill: linhaOpts?.fill !== undefined ? linhaOpts.fill : fillBase,
          fontColor: linhaOpts?.fontColor,
          bold: linhaOpts?.bold || false,
          align: colsDef[c].align || 'left',
          numFmt: colsDef[c].numFmt || 'General',
          wrapText: colsDef[c].wrapText || linhaOpts?.wrapText || false,
        });
      }
    }
  }

  return ws;
}

/**
 * Lê arquivo Excel (.xlsx, .xlsm, .csv) e retorna as abas disponíveis
 */
export async function obterAbasArquivo(arquivo) {
  const buffer = await arquivo.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  return {
    workbook,
    sheetNames: workbook.SheetNames,
  };
}

/**
 * Normaliza nomes de colunas para matching flexível
 */
function normalizarChave(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Encontra o índice da melhor coluna compatível
 */
function encontrarIndiceColuna(headers, candidatos) {
  const normHeaders = headers.map(normalizarChave);
  for (const cand of candidatos) {
    const idx = normHeaders.indexOf(normalizarChave(cand));
    if (idx !== -1) return idx;
  }
  for (const cand of candidatos) {
    const cNorm = normalizarChave(cand);
    const idx = normHeaders.findIndex(h => h.includes(cNorm) || cNorm.includes(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Extrai e consolida o uso de protocolos nas justificativas por ano e consolidado geral
 */
export function analisarProtocolosJustificativas(workbook, abasSelecionadas) {
  const abas = Array.isArray(abasSelecionadas) ? abasSelecionadas : [abasSelecionadas];

  // Dados consolidados gerais
  const contagemPorProtocolo = new Map();
  const contagemPorServidor = new Map();

  // Dados particionados por ano dinamicamente (ano -> { contagemPorProtocolo, contagemPorServidor, kpis })
  const analisePorAno = new Map();

  let totalLinhasAnalisadas = 0;
  let totalUsosIdentificados = 0;
  let linhasComProtocolo = 0;
  let linhasSemProtocolo = 0;

  for (const nomeAba of abas) {
    const sheet = workbook.Sheets[nomeAba];
    if (!sheet) continue;

    const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!matriz || matriz.length < 2) continue;

    let headerIdx = 0;
    for (let i = 0; i < Math.min(10, matriz.length); i++) {
      const linhaStr = matriz[i].map(c => normalizarChave(c)).join(' ');
      if (linhaStr.includes('calendarioobs') || linhaStr.includes('funcionarionome') || linhaStr.includes('observacao')) {
        headerIdx = i;
        break;
      }
    }

    const headers = matriz[headerIdx].map(c => String(c || '').trim());

    const idxObs = encontrarIndiceColuna(headers, ['calendarioobsusuario', 'observacao', 'obs', 'descricao', 'protocolo', 'justificativa']);
    const idxNome = encontrarIndiceColuna(headers, ['funcionarionome', 'nome', 'servidor', 'funcionario']);
    const idxCartao = encontrarIndiceColuna(headers, ['funcionariocartao', 'cartao', 'matricula', 'registro']);
    const idxSetor = encontrarIndiceColuna(headers, ['setordescricao', 'setor', 'departamento', 'lotacao']);
    const idxCargo = encontrarIndiceColuna(headers, ['cargodescricao', 'cargo', 'funcao']);
    const idxTipoAbono = encontrarIndiceColuna(headers, ['tipo_abono', 'tipoabono', 'tipo', 'motivo']);
    const idxData = encontrarIndiceColuna(headers, ['calendariodata', 'data', 'data_abono']);

    if (idxObs === -1) continue;

    // Detectar ano da aba caso o nome da aba especifique (ex: "PGM JUSTIFICADO EM 2025" -> "2025")
    const matchAnoAba = nomeAba.match(/\b(202\d)\b/);
    const anoAbaPadrao = matchAnoAba ? matchAnoAba[1] : null;

    for (let r = headerIdx + 1; r < matriz.length; r++) {
      const row = matriz[r];
      if (!row || row.length === 0 || row.every(c => c === '' || c === null || c === undefined)) {
        continue;
      }

      totalLinhasAnalisadas++;

      const obsTexto = String(row[idxObs] || '');
      const nomeServidor = (idxNome !== -1 && row[idxNome]) ? String(row[idxNome]).trim().toUpperCase() : 'NÃO INFORMADO';
      const cartao = (idxCartao !== -1 && row[idxCartao]) ? String(row[idxCartao]).trim() : '';
      const setor = (idxSetor !== -1 && row[idxSetor]) ? String(row[idxSetor]).trim() : '';
      const cargo = (idxCargo !== -1 && row[idxCargo]) ? String(row[idxCargo]).trim() : '';
      const tipoAbono = (idxTipoAbono !== -1 && row[idxTipoAbono]) ? String(row[idxTipoAbono]).trim() : '';
      const dataAbono = (idxData !== -1 && row[idxData]) ? String(row[idxData]).trim() : '';

      // Determinar ano do registro: 1º por data da justificativa, 2º pelo ano da aba
      let anoRegistro = anoAbaPadrao;
      if (dataAbono && dataAbono.length >= 4 && dataAbono.substring(0, 4).match(/^202\d$/)) {
        anoRegistro = dataAbono.substring(0, 4);
      }

      const protocolosEncontrados = obsTexto.match(REGEX_PROTOCOLO_PD);

      if (!protocolosEncontrados || protocolosEncontrados.length === 0) {
        linhasSemProtocolo++;
        continue;
      }

      linhasComProtocolo++;

      // Se não identificou ano pela data nem pela aba, usa o ano do primeiro protocolo
      if (!anoRegistro) {
        anoRegistro = protocolosEncontrados[0].substring(0, 4);
      }

      // Inicializa partição do ano se não existir
      if (!analisePorAno.has(anoRegistro)) {
        analisePorAno.set(anoRegistro, {
          ano: anoRegistro,
          totalUsos: 0,
          contagemPorProtocolo: new Map(),
          contagemPorServidor: new Map(),
        });
      }
      const particAno = analisePorAno.get(anoRegistro);

      // Chave única do servidor
      const chaveServidor = cartao ? `${cartao}-${nomeServidor}` : nomeServidor;

      // 1. Registro geral do servidor
      if (!contagemPorServidor.has(chaveServidor)) {
        contagemPorServidor.set(chaveServidor, {
          chave: chaveServidor,
          cartao,
          nome: nomeServidor,
          setor,
          cargo,
          totalUsos: 0,
          protocolos: new Map(),
          porAno: new Map(), // ano -> totalUsos
        });
      }
      const regServidor = contagemPorServidor.get(chaveServidor);
      if (!regServidor.setor && setor) regServidor.setor = setor;
      if (!regServidor.cargo && cargo) regServidor.cargo = cargo;

      // 2. Registro do servidor na partição do ano
      if (!particAno.contagemPorServidor.has(chaveServidor)) {
        particAno.contagemPorServidor.set(chaveServidor, {
          chave: chaveServidor,
          cartao,
          nome: nomeServidor,
          setor,
          cargo,
          totalUsos: 0,
          protocolos: new Map(),
        });
      }
      const regServidorAno = particAno.contagemPorServidor.get(chaveServidor);

      for (const proto of protocolosEncontrados) {
        totalUsosIdentificados++;
        particAno.totalUsos++;

        // A. Geral Servidor
        regServidor.totalUsos++;
        regServidor.protocolos.set(proto, (regServidor.protocolos.get(proto) || 0) + 1);
        regServidor.porAno.set(anoRegistro, (regServidor.porAno.get(anoRegistro) || 0) + 1);

        // B. Servidor no Ano
        regServidorAno.totalUsos++;
        regServidorAno.protocolos.set(proto, (regServidorAno.protocolos.get(proto) || 0) + 1);

        // C. Geral Protocolo
        if (!contagemPorProtocolo.has(proto)) {
          contagemPorProtocolo.set(proto, {
            protocolo: proto,
            ano: proto.substring(0, 4),
            totalUsos: 0,
            servidores: new Map(),
            ocorrencias: [],
          });
        }
        const regProto = contagemPorProtocolo.get(proto);
        regProto.totalUsos++;
        if (!regProto.servidores.has(chaveServidor)) {
          regProto.servidores.set(chaveServidor, { chave: chaveServidor, nome: nomeServidor, cartao, setor, cargo, qtd: 0 });
        }
        regProto.servidores.get(chaveServidor).qtd++;

        // D. Protocolo no Ano
        if (!particAno.contagemPorProtocolo.has(proto)) {
          particAno.contagemPorProtocolo.set(proto, {
            protocolo: proto,
            ano: proto.substring(0, 4),
            totalUsos: 0,
            servidores: new Map(),
          });
        }
        const regProtoAno = particAno.contagemPorProtocolo.get(proto);
        regProtoAno.totalUsos++;
        if (!regProtoAno.servidores.has(chaveServidor)) {
          regProtoAno.servidores.set(chaveServidor, { chave: chaveServidor, nome: nomeServidor, cartao, setor, cargo, qtd: 0 });
        }
        regProtoAno.servidores.get(chaveServidor).qtd++;
      }
    }
  }

  // Função auxiliar para ordenar listas de protocolos e servidores
  function formatarListas(mapProto, mapServ) {
    const listaProtocolos = Array.from(mapProto.values())
      .map(p => ({
        protocolo: p.protocolo,
        ano: p.ano,
        totalUsos: p.totalUsos,
        totalServidores: p.servidores.size,
        servidores: Array.from(p.servidores.values()).sort((a, b) => b.qtd - a.qtd),
      }))
      .sort((a, b) => b.totalUsos - a.totalUsos);

    const listaServidores = Array.from(mapServ.values())
      .map(s => ({
        chave: s.chave,
        nome: s.nome,
        cartao: s.cartao,
        setor: s.setor,
        cargo: s.cargo,
        totalUsos: s.totalUsos,
        totalProtocolosDistintos: s.protocolos.size,
        porAno: s.porAno ? Object.fromEntries(s.porAno) : {},
        protocolos: Array.from(s.protocolos.entries())
          .map(([protocolo, qtd]) => ({ protocolo, qtd }))
          .sort((a, b) => b.qtd - a.qtd),
      }))
      .sort((a, b) => b.totalUsos - a.totalUsos);

    return { listaProtocolos, listaServidores };
  }

  // Formatação consolidada geral
  const geral = formatarListas(contagemPorProtocolo, contagemPorServidor);

  // Formatação de cada ano detectado
  const anosDetalhados = {};
  const anosDetectados = Array.from(analisePorAno.keys()).sort();

  for (const ano of anosDetectados) {
    const part = analisePorAno.get(ano);
    const { listaProtocolos, listaServidores } = formatarListas(part.contagemPorProtocolo, part.contagemPorServidor);
    anosDetalhados[ano] = {
      ano,
      totalUsos: part.totalUsos,
      totalProtocolosDistintos: listaProtocolos.length,
      totalServidoresIdentificados: listaServidores.length,
      listaProtocolos,
      listaServidores,
    };
  }

  return {
    kpis: {
      totalUsosIdentificados,
      totalProtocolosDistintos: geral.listaProtocolos.length,
      totalServidoresIdentificados: geral.listaServidores.length,
      totalLinhasAnalisadas,
      linhasComProtocolo,
      linhasSemProtocolo,
      anosDetectados,
    },
    listaProtocolos: geral.listaProtocolos,
    listaServidores: geral.listaServidores,
    anosDetalhados,
    anosDetectados,
  };
}

/**
 * Monta as tabelas formatadas de uma visão (por protocolo ou por servidor)
 */
function gerarPlanilhasAno(wb, tituloAno, listaProtocolos, listaServidores, totalGeralUsos) {
  // Aba Protocolos
  const cabecalhoProtocolos = [
    'Protocolo Digital (PD)',
    'Ano do PD',
    'Total de Usos',
    '% do Volume Total',
    'Qtd Servidores Distintos',
    'Servidor Mais Frequente',
    'Matrícula Princ.',
    'Usos Servidor Princ.',
    '% Concentração no Princ.',
    'Demais Servidores Envolvidos'
  ];

  const linhasProtocolos = listaProtocolos.map(p => {
    const servPrincipal = p.servidores[0] || null;
    const usosPrincipal = servPrincipal ? servPrincipal.qtd : 0;
    const concPrincipal = p.totalUsos > 0 ? usosPrincipal / p.totalUsos : 0;
    
    // Demais servidores organizados de forma clara
    const demais = p.servidores.slice(1);
    let textoDemais = '-';
    if (demais.length > 0) {
      const topDemais = demais.slice(0, 3).map(s => `${s.nome}: ${s.qtd}x`).join('\n');
      const restante = demais.length > 3 ? `\n(+${demais.length - 3} outros servidores)` : '';
      textoDemais = topDemais + restante;
    }

    return [
      p.protocolo,
      p.ano,
      p.totalUsos,
      totalGeralUsos > 0 ? p.totalUsos / totalGeralUsos : 0,
      p.totalServidores,
      servPrincipal ? servPrincipal.nome : '-',
      servPrincipal?.cartao || '-',
      usosPrincipal,
      concPrincipal,
      textoDemais,
    ];
  });

  const dadosProtocolosComTotais = [
    cabecalhoProtocolos,
    ...linhasProtocolos,
    [],
    [
      `TOTAIS ${tituloAno.toUpperCase()}`,
      '',
      totalGeralUsos,
      1.0,
      listaServidores.length,
      '',
      '',
      '',
      '',
      `Total de ${listaProtocolos.length} protocolos distintos`,
    ],
  ];

  const colsProtocolos = [
    { w: 22, align: 'center' },
    { w: 12, align: 'center' },
    { w: 16, align: 'right', numFmt: '#,##0' },
    { w: 18, align: 'right', numFmt: '0.0%' },
    { w: 22, align: 'right', numFmt: '#,##0' },
    { w: 36, align: 'left' },
    { w: 16, align: 'center' },
    { w: 20, align: 'right', numFmt: '#,##0' },
    { w: 24, align: 'right', numFmt: '0.0%' },
    { w: 45, align: 'left', wrapText: true },
  ];

  const wsProtocolos = criarSheetFormatada(
    dadosProtocolosComTotais,
    colsProtocolos,
    (rowIdx, row, colIdx) => {
      if (rowIdx > linhasProtocolos.length + 1) {
        return { fill: COR.cinzaTotais, bold: true, fontColor: COR.pretoCel };
      }
      if (rowIdx === linhasProtocolos.length + 1) return { fill: null };
      const totalUso = typeof row[2] === 'number' ? row[2] : 0;
      if (totalUso >= 50 && (colIdx === 0 || colIdx === 2)) {
        return { fill: COR.vermelhoFundo, fontColor: COR.vermelho, bold: true };
      }
      return {};
    },
    COR.azulEscuro
  );
  XLSXStyle.utils.book_append_sheet(wb, wsProtocolos, `Protocolos (${tituloAno})`);

  // Aba Servidor x Protocolo
  const cabecalhoCruzado = [
    'Matrícula/Cartão', 'Servidor', 'Setor / Gerência', 'Cargo',
    'Protocolo (PD)', 'Ano PD', 'Qtd Usos pelo Servidor', 'Total no Período', '% das Justificativas do Servidor'
  ];

  const linhasCruzadas = [];
  for (const s of listaServidores) {
    for (const item of s.protocolos) {
      linhasCruzadas.push([
        s.cartao || '-',
        s.nome,
        s.setor || '-',
        s.cargo || '-',
        item.protocolo,
        item.protocolo.substring(0, 4),
        item.qtd,
        s.totalUsos,
        s.totalUsos > 0 ? item.qtd / s.totalUsos : 0,
      ]);
    }
  }

  const dadosCruzadosComTotais = [
    cabecalhoCruzado,
    ...linhasCruzadas,
    [],
    [
      `TOTAL REGISTROS (${tituloAno})`,
      linhasCruzadas.length,
      '',
      '',
      '',
      '',
      totalGeralUsos,
      '',
      '',
    ]
  ];

  const colsCruzado = [
    { w: 18, align: 'center' },
    { w: 38, align: 'left' },
    { w: 35, align: 'left' },
    { w: 32, align: 'left' },
    { w: 22, align: 'center' },
    { w: 10, align: 'center' },
    { w: 22, align: 'right', numFmt: '#,##0' },
    { w: 20, align: 'right', numFmt: '#,##0' },
    { w: 22, align: 'right', numFmt: '0.0%' },
  ];

  const wsCruzado = criarSheetFormatada(
    dadosCruzadosComTotais,
    colsCruzado,
    (rowIdx, row, colIdx) => {
      if (rowIdx > linhasCruzadas.length + 1) {
        return { fill: COR.cinzaTotais, bold: true, fontColor: COR.pretoCel };
      }
      if (rowIdx === linhasCruzadas.length + 1) return { fill: null };
      return {};
    },
    COR.azulEscuro
  );
  XLSXStyle.utils.book_append_sheet(wb, wsCruzado, `Servidores (${tituloAno})`);
}

/**
 * Exporta o resultado da contagem de protocolos separando por ano e consolidado geral
 */
export function exportarProtocolosXLSX(resultado) {
  const wb = XLSXStyle.utils.book_new();

  // 1. Aba Consolidada Multi-Anual por Servidor (com colunas analíticas e pódio de PDs)
  const anos = resultado.anosDetectados || [];
  const cabecalhoComparativo = [
    'Matrícula/Cartão', 'Servidor', 'Setor / Gerência', 'Cargo',
    ...anos.map(a => `Total ${a}`),
    'TOTAL GERAL',
    'Qtd PDs Distintos',
    'Protocolo Principal (Top 1)',
    'Usos Top 1',
    '% Concentração Top 1',
    'Protocolo Top 2',
    'Usos Top 2',
    'Protocolo Top 3',
    'Usos Top 3',
    'Outros Protocolos Utilizados'
  ];

  const totalGeralUsos = resultado.kpis.totalUsosIdentificados || 1;

  const linhasComparativo = resultado.listaServidores.map(s => {
    const p1 = s.protocolos[0] || null;
    const p2 = s.protocolos[1] || null;
    const p3 = s.protocolos[2] || null;

    const usosP1 = p1 ? p1.qtd : 0;
    const concP1 = s.totalUsos > 0 ? usosP1 / s.totalUsos : 0;

    const outros = s.protocolos.slice(3);
    let textoOutros = '-';
    if (outros.length > 0) {
      const topOutros = outros.slice(0, 3).map(p => `${p.protocolo} (${p.qtd}x)`).join('\n');
      const restante = outros.length > 3 ? `\n(+${outros.length - 3} outros)` : '';
      textoOutros = topOutros + restante;
    }

    return [
      s.cartao || '-',
      s.nome,
      s.setor || '-',
      s.cargo || '-',
      ...anos.map(a => s.porAno[a] || 0),
      s.totalUsos,
      s.totalProtocolosDistintos,
      p1 ? p1.protocolo : '-',
      usosP1,
      concP1,
      p2 ? p2.protocolo : '-',
      p2 ? p2.qtd : 0,
      p3 ? p3.protocolo : '-',
      p3 ? p3.qtd : 0,
      textoOutros,
    ];
  });

  const totaisAnos = anos.map(a =>
    resultado.listaServidores.reduce((acc, s) => acc + (s.porAno[a] || 0), 0)
  );

  const dadosComparativoComTotais = [
    cabecalhoComparativo,
    ...linhasComparativo,
    [],
    [
      'TOTAIS CONSOLIDADOS',
      `${resultado.kpis.totalServidoresIdentificados} servidores auditados`,
      '',
      '',
      ...totaisAnos,
      totalGeralUsos,
      resultado.kpis.totalProtocolosDistintos,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ]
  ];

  const colsComparativo = [
    { w: 18, align: 'center' },
    { w: 38, align: 'left' },
    { w: 35, align: 'left' },
    { w: 32, align: 'left' },
    ...anos.map(() => ({ w: 15, align: 'right', numFmt: '#,##0' })),
    { w: 18, align: 'right', numFmt: '#,##0' },
    { w: 18, align: 'right', numFmt: '#,##0' },
    { w: 24, align: 'center' },
    { w: 14, align: 'right', numFmt: '#,##0' },
    { w: 20, align: 'right', numFmt: '0.0%' },
    { w: 22, align: 'center' },
    { w: 14, align: 'right', numFmt: '#,##0' },
    { w: 22, align: 'center' },
    { w: 14, align: 'right', numFmt: '#,##0' },
    { w: 35, align: 'left', wrapText: true },
  ];

  const wsComparativo = criarSheetFormatada(
    dadosComparativoComTotais,
    colsComparativo,
    (rowIdx, row, colIdx) => {
      if (rowIdx > linhasComparativo.length + 1) {
        return { fill: COR.cinzaTotais, bold: true, fontColor: COR.pretoCel };
      }
      if (rowIdx === linhasComparativo.length + 1) return { fill: null };
      return {};
    },
    COR.azulEscuro
  );
  XLSXStyle.utils.book_append_sheet(wb, wsComparativo, 'Consolidado Comparativo');

  // 2. Abas Individuais por Ano Detectado (ex: 2025, 2026, ...)
  for (const ano of anos) {
    const dadosAno = resultado.anosDetalhados[ano];
    if (dadosAno) {
      gerarPlanilhasAno(wb, ano, dadosAno.listaProtocolos, dadosAno.listaServidores, dadosAno.totalUsos);
    }
  }

  // 3. Abas Consolidadas Gerais (Todos os Anos combinados)
  gerarPlanilhasAno(wb, 'Geral Todos Anos', resultado.listaProtocolos, resultado.listaServidores, totalGeralUsos);

  // Grava e dispara download
  const nomeArquivo = `Auditoria_Protocolos_Justificativas_${anos.join('_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSXStyle.writeFile(wb, nomeArquivo);
}
