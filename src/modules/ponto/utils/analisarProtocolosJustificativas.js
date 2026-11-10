import * as XLSX from 'xlsx';

/**
 * Padrão de protocolo de 12 dígitos iniciado em 2024, 2025 ou 2026
 * Exemplo: 202403001234, 202503025553, 202603080804
 */
export const REGEX_PROTOCOLO_PD = /202[4-6]\d{8}/g;

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
 * Normaliza nomes de colunas para facilitar matching flexível
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
  // Tenta por includes
  for (const cand of candidatos) {
    const cNorm = normalizarChave(cand);
    const idx = normHeaders.findIndex(h => h.includes(cNorm) || cNorm.includes(h));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Extrai e consolida o uso de protocolos nas justificativas
 * @param {Object} workbook - Objeto workbook retornado pelo XLSX.read
 * @param {string|string[]} abasSelecionadas - Nome da aba ou array de abas a processar
 */
export function analisarProtocolosJustificativas(workbook, abasSelecionadas) {
  const abas = Array.isArray(abasSelecionadas) ? abasSelecionadas : [abasSelecionadas];

  // Mapas de agregação
  const contagemPorProtocolo = new Map(); // protocolo -> { protocolo, totalUsos, servidores: Map(nome -> { nome, cartao, setor, cargo, qtd }), ocorrencias: [] }
  const contagemPorServidor = new Map();  // chaveServidor -> { nome, cartao, setor, cargo, totalUsos, protocolos: Map(proto -> qtd) }

  let totalLinhasAnalisadas = 0;
  let totalUsosIdentificados = 0;
  let linhasComProtocolo = 0;
  let linhasSemProtocolo = 0;

  for (const nomeAba of abas) {
    const sheet = workbook.Sheets[nomeAba];
    if (!sheet) continue;

    // Converter para matriz de dados (header na primeira linha não-vazia)
    const matriz = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!matriz || matriz.length < 2) continue;

    // Localizar cabeçalho (procura linha que contenha colunas chave como 'funcionarionome' ou 'calendarioobsusuario')
    let headerIdx = 0;
    for (let i = 0; i < Math.min(10, matriz.length); i++) {
      const linhaStr = matriz[i].map(c => normalizarChave(c)).join(' ');
      if (linhaStr.includes('calendarioobs') || linhaStr.includes('funcionarionome') || linhaStr.includes('observacao')) {
        headerIdx = i;
        break;
      }
    }

    const headers = matriz[headerIdx].map(c => String(c || '').trim());

    const idxObs = encontrarIndiceColuna(headers, ['calendarioobsusuario', 'observacao', 'obs', 'protocolo', 'justificativa']);
    const idxNome = encontrarIndiceColuna(headers, ['funcionarionome', 'nome', 'servidor', 'funcionario']);
    const idxCartao = encontrarIndiceColuna(headers, ['funcionariocartao', 'cartao', 'matricula', 'registro']);
    const idxSetor = encontrarIndiceColuna(headers, ['setordescricao', 'setor', 'departamento', 'lotacao']);
    const idxCargo = encontrarIndiceColuna(headers, ['cargodescricao', 'cargo', 'funcao']);
    const idxTipoAbono = encontrarIndiceColuna(headers, ['tipo_abono', 'tipoabono', 'tipo', 'motivo']);
    const idxData = encontrarIndiceColuna(headers, ['calendariodata', 'data', 'data_abono']);

    if (idxObs === -1) {
      console.warn(`Aba "${nomeAba}" não possui coluna identificável de observação/protocolo.`);
      continue;
    }

    // Processar cada linha de dados
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

      // Extrair todos os protocolos de 12 dígitos iniciados em 2024, 2025 ou 2026
      const protocolosEncontrados = obsTexto.match(REGEX_PROTOCOLO_PD);

      if (!protocolosEncontrados || protocolosEncontrados.length === 0) {
        linhasSemProtocolo++;
        continue;
      }

      linhasComProtocolo++;

      // Registro do servidor
      const chaveServidor = cartao ? `${cartao}-${nomeServidor}` : nomeServidor;
      if (!contagemPorServidor.has(chaveServidor)) {
        contagemPorServidor.set(chaveServidor, {
          chave: chaveServidor,
          cartao,
          nome: nomeServidor,
          setor,
          cargo,
          totalUsos: 0,
          protocolos: new Map(), // proto -> count
        });
      }
      const regServidor = contagemPorServidor.get(chaveServidor);
      if (!regServidor.setor && setor) regServidor.setor = setor;
      if (!regServidor.cargo && cargo) regServidor.cargo = cargo;

      for (const proto of protocolosEncontrados) {
        totalUsosIdentificados++;

        // 1. Agregação no Servidor
        regServidor.totalUsos++;
        regServidor.protocolos.set(proto, (regServidor.protocolos.get(proto) || 0) + 1);

        // 2. Agregação no Protocolo
        if (!contagemPorProtocolo.has(proto)) {
          contagemPorProtocolo.set(proto, {
            protocolo: proto,
            ano: proto.substring(0, 4),
            totalUsos: 0,
            servidores: new Map(), // chaveServidor -> { nome, cartao, setor, cargo, qtd }
            ocorrencias: [],
          });
        }
        const regProto = contagemPorProtocolo.get(proto);
        regProto.totalUsos++;

        if (!regProto.servidores.has(chaveServidor)) {
          regProto.servidores.set(chaveServidor, {
            chave: chaveServidor,
            nome: nomeServidor,
            cartao,
            setor,
            cargo,
            qtd: 0,
          });
        }
        regProto.servidores.get(chaveServidor).qtd++;

        regProto.ocorrencias.push({
          servidor: nomeServidor,
          cartao,
          setor,
          cargo,
          tipoAbono,
          data: dataAbono,
          aba: nomeAba,
          obsOriginal: obsTexto.trim(),
        });
      }
    }
  }

  // Converter Mapas para Arrays ordenados
  const listaProtocolos = Array.from(contagemPorProtocolo.values())
    .map(p => ({
      protocolo: p.protocolo,
      ano: p.ano,
      totalUsos: p.totalUsos,
      totalServidores: p.servidores.size,
      servidores: Array.from(p.servidores.values()).sort((a, b) => b.qtd - a.qtd),
      ocorrencias: p.ocorrencias,
    }))
    .sort((a, b) => b.totalUsos - a.totalUsos);

  const listaServidores = Array.from(contagemPorServidor.values())
    .map(s => ({
      chave: s.chave,
      nome: s.nome,
      cartao: s.cartao,
      setor: s.setor,
      cargo: s.cargo,
      totalUsos: s.totalUsos,
      totalProtocolosDistintos: s.protocolos.size,
      protocolos: Array.from(s.protocolos.entries())
        .map(([protocolo, qtd]) => ({ protocolo, qtd }))
        .sort((a, b) => b.qtd - a.qtd),
    }))
    .sort((a, b) => b.totalUsos - a.totalUsos);

  return {
    kpis: {
      totalUsosIdentificados,
      totalProtocolosDistintos: listaProtocolos.length,
      totalServidoresIdentificados: listaServidores.length,
      totalLinhasAnalisadas,
      linhasComProtocolo,
      linhasSemProtocolo,
    },
    listaProtocolos,
    listaServidores,
  };
}

/**
 * Exporta o resultado da contagem de protocolos para arquivo Excel (.xlsx)
 */
export function exportarProtocolosXLSX(resultado) {
  const wb = XLSX.utils.book_new();

  // Aba 1: Ranking por Protocolo
  const dadosProtocolos = resultado.listaProtocolos.map(p => ({
    'Protocolo (PD)': p.protocolo,
    'Ano': p.ano,
    'Total de Utilizações': p.totalUsos,
    'Qtd de Servidores Distintos': p.totalServidores,
    'Servidores': p.servidores.map(s => `${s.nome} (${s.qtd}x)`).join('; '),
  }));
  const wsProto = XLSX.utils.json_to_sheet(dadosProtocolos);
  XLSX.utils.book_append_sheet(wb, wsProto, 'Resumo por Protocolo');

  // Aba 2: Cruzamento por Servidor x Protocolo
  const dadosCruzados = [];
  for (const s of resultado.listaServidores) {
    for (const item of s.protocolos) {
      dadosCruzados.push({
        'Cartão/Matrícula': s.cartao,
        'Servidor': s.nome,
        'Setor': s.setor,
        'Cargo': s.cargo,
        'Protocolo (PD)': item.protocolo,
        'Qtd Utilizações pelo Servidor': item.qtd,
        'Total Geral do Servidor': s.totalUsos,
      });
    }
  }
  const wsCruzado = XLSX.utils.json_to_sheet(dadosCruzados);
  XLSX.utils.book_append_sheet(wb, wsCruzado, 'Servidor x Protocolo');

  // Aba 3: Resumo por Servidor
  const dadosServidores = resultado.listaServidores.map(s => ({
    'Cartão/Matrícula': s.cartao,
    'Servidor': s.nome,
    'Setor': s.setor,
    'Cargo': s.cargo,
    'Total de Justificativas com PD': s.totalUsos,
    'Qtd de Protocolos Distintos': s.totalProtocolosDistintos,
    'Protocolos Utilizados': s.protocolos.map(p => `${p.protocolo} (${p.qtd}x)`).join(', '),
  }));
  const wsServ = XLSX.utils.json_to_sheet(dadosServidores);
  XLSX.utils.book_append_sheet(wb, wsServ, 'Resumo por Servidor');

  XLSX.writeFile(wb, `Auditoria_Protocolos_Justificativas_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

