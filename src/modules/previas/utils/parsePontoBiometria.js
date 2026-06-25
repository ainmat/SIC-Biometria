/**
 * Parser do arquivo unificado de biometria / prévia de ponto.
 *
 * Layout: texto de largura fixa, 29 caracteres por linha, terminação CRLF.
 * Parsear SEMPRE por posição de caractere — nunca por separador.
 *
 * Pos  1– 8 (0-7  JS): matricula  — inteiro zero-padded, remover zeros à esquerda
 * Pos  9–10 (8-9  JS): vinculo    — "01" neste arquivo, mas tratar como variável
 * Pos 11–20 (10-19 JS): data      — "DD/MM/YYYY" (Tipo 1) ou 10 espaços (Tipo 2)
 * Pos 21–29 (20-28 JS): codigo    — código bruto de 9 dígitos (significado ⚠️ CONFIRMAR)
 *
 * Tipo 1 (marcação diária)    — posição 11-20 contém data válida
 * Tipo 2 (consolidação mensal)— posição 11-20 contém 10 espaços
 *
 * ⚠️ Códigos Tipo 1 (p.ex. 033500020) e prefixo Tipo 2 (0024…) devem ser confirmados
 *    com o setor de ponto. Até lá, armazenar brutos e exibir "—" no significado.
 */

/** Extrai competência (YYYY-MM) do nome do arquivo (ex.: IMP052026_unificado.txt). */
export function extrairCompetencia(nomeArquivo) {
  const m = nomeArquivo.match(/IMP(\d{2})(\d{4})/i);
  if (!m) return null;
  return { mes: m[1], ano: m[2], competencia: `${m[2]}-${m[1]}` };
}

/**
 * Parseia uma única linha. Retorna:
 *   null                          — linha vazia (ignorar silenciosamente)
 *   { valida: false, motivo, nLinha, raw } — linha rejeitada
 *   { valida: true, tipo: 1, matricula, vinculo, data, codigo, nLinha }
 *   { valida: true, tipo: 2, matricula, vinculo, codigo, nLinha }
 */
export function parseLinha(linhaRaw, nLinha = 0) {
  const linha = linhaRaw.replace(/\r$/, ''); // remove \r de CRLF
  if (linha.length === 0) return null;

  if (linha.length !== 29) {
    return { valida: false, motivo: `Comprimento ${linha.length} (esperado 29)`, nLinha, raw: linha };
  }

  const matriculaRaw = linha.slice(0, 8);   // pos 1-8
  const vinculo      = linha.slice(8, 10);  // pos 9-10
  const dataRaw      = linha.slice(10, 20); // pos 11-20
  const codigo       = linha.slice(20, 29); // pos 21-29

  if (!/^\d{8}$/.test(matriculaRaw)) {
    return { valida: false, motivo: `Matrícula não numérica: "${matriculaRaw}"`, nLinha, raw: linha };
  }

  const matricula = String(parseInt(matriculaRaw, 10)); // remove zeros à esquerda

  if (dataRaw === '          ') {
    return { valida: true, tipo: 2, matricula, vinculo, codigo, nLinha };
  }

  const dm = dataRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!dm) {
    return { valida: false, motivo: `Data inválida: "${dataRaw}"`, nLinha, raw: linha };
  }

  const [, dd, mm, yyyy] = dm;
  // Verificar que a data existe no calendário
  const ts = Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd));
  const check = new Date(ts);
  if (check.getUTCFullYear() !== Number(yyyy) || check.getUTCMonth() + 1 !== Number(mm) || check.getUTCDate() !== Number(dd)) {
    return { valida: false, motivo: `Data inexistente no calendário: "${dataRaw}"`, nLinha, raw: linha };
  }

  return { valida: true, tipo: 1, matricula, vinculo, data: `${yyyy}-${mm}-${dd}`, codigo, nLinha };
}

/**
 * Parseia o conteúdo completo do arquivo e separa Tipo 1 / Tipo 2 / rejeitadas.
 *
 * @returns {{
 *   tipo1: object[], tipo2: object[], rejeitadas: object[], matriculas: string[],
 *   resumo: { totalLinhas, tipo1, tipo2, rejeitadas, servidores }
 * }}
 */
export function parseArquivoPonto(texto) {
  const linhas = texto.split('\n');
  const tipo1 = [], tipo2 = [], rejeitadas = [];

  for (let i = 0; i < linhas.length; i++) {
    const r = parseLinha(linhas[i], i + 1);
    if (r === null) continue; // linha em branco — ignorar
    if (!r.valida) rejeitadas.push(r);
    else if (r.tipo === 1) tipo1.push(r);
    else tipo2.push(r);
  }

  const matriculas = [...new Set([...tipo1, ...tipo2].map(r => r.matricula))];

  return {
    tipo1,
    tipo2,
    rejeitadas,
    matriculas,
    resumo: {
      totalLinhas: linhas.length,
      tipo1:       tipo1.length,
      tipo2:       tipo2.length,
      rejeitadas:  rejeitadas.length,
      servidores:  matriculas.length,
    },
  };
}
