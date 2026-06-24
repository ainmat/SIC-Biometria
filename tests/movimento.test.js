/**
 * Testes para o parser do Formato C — Lançamento do Movimento de Variáveis.
 *
 * As funções são inlined (espelho de colunas.js + processarXLS.js) para
 * compatibilidade com o setup Jest atual (ESM sem babel).
 */

// ─── Inline: normalizarNome (de colunas.js) ───────────────────────────────────

function normalizarNome(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[./\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Inline: detectarColunasMovimento + validarColunasMovimento ───────────────

const _COLS_MOV = [
  { campo: 'matricula',  aliases: ['MATRICULA'] },
  { campo: 'nome',       aliases: ['NOME FUNCIONARIO'] },
  { campo: 'verba',      aliases: ['VERBA'] },
  { campo: 'descVerba',  aliases: ['DESCRICAO VERBA'] },
  { campo: 'quantidade', aliases: ['QUANTIDADE'] },
  { campo: 'cargo',      aliases: ['DESCRICAO CONTRATO'] },
  { campo: 'lotacao',    aliases: ['LOTACAO'] },
  { campo: 'secretaria', aliases: ['DESCRICAO LOTACAO'] },
  { campo: 'unidade',    aliases: ['DESCRICAO LOCAL TRABALHO'] },
];

function detectarColunasMovimento(headerRow) {
  const norm = headerRow.map(c => normalizarNome(String(c ?? '')));
  const result = {};
  for (const { campo, aliases } of _COLS_MOV) {
    for (const alias of aliases) {
      const idx = norm.indexOf(normalizarNome(alias));
      if (idx >= 0) { result[campo] = idx; break; }
    }
  }
  const essenciais = ['matricula', 'verba', 'quantidade'];
  if (essenciais.every(c => result[c] !== undefined)) return result;
  return null;
}

function validarColunasMovimento(cols) {
  const erros = [];
  if (cols.matricula  === undefined) erros.push('Coluna "Matrícula" não encontrada no arquivo.');
  if (cols.verba      === undefined) erros.push('Coluna "Verba" não encontrada no arquivo.');
  if (cols.quantidade === undefined) erros.push('Coluna "Quantidade" não encontrada no arquivo.');
  return erros;
}

// ─── Inline: parseQuantidadePtBR + processarLinhasMovimento ──────────────────

const VERBA_CODE_TO_FIELD = {
  171: 'falta',
  335: 'atraso',
  504: 'dsr',
  4:   'hora_extra_50',
  5:   'hora_extra_100',
  24:  'adicional_noturno',
};

function parseQuantidadePtBR(val) {
  const s = String(val ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Versão simplificada de decomposeVB335 (inline do processarXLS.js)
const PESO_CURTO = 0.333;
const TOL_VB335  = 0.01;

function decomposeVB335(valor) {
  const n = parseFloat(String(valor).replace(',', '.')) || 0;
  if (n <= 0) return { atrasos_fracao: 0, atrasos_dia: 0, ambiguo: false, inconsistente: false };

  const candidates = [];
  for (let c = 0; c <= 60; c++) {
    const rem = n - c * PESO_CURTO;
    if (rem < -TOL_VB335) break;
    const l = Math.round(rem);
    if (l >= 0 && Math.abs(rem - l) < TOL_VB335) {
      const exact = Math.abs(c * PESO_CURTO + l - n) < 1e-9;
      const erro  = Math.abs(c * PESO_CURTO + l - n);
      candidates.push({ c, l, erro, exact });
    }
  }

  if (candidates.length === 0)
    return { atrasos_fracao: 0, atrasos_dia: 0, ambiguo: false, inconsistente: true };

  const exactOnes = candidates.filter(x => x.exact);
  const pool = exactOnes.length > 0 ? exactOnes : candidates;
  pool.sort((a, b) => a.l - b.l || a.erro - b.erro);
  const best = pool[0];

  return {
    atrasos_fracao: best.c,
    atrasos_dia:    best.l + 0, // normaliza -0 → 0
    ambiguo:        candidates.length > 1,
    inconsistente:  false,
  };
}

function processarLinhasMovimento(rows, competencia, { headerIdx, movimentoCols }) {
  const cols = movimentoCols;
  const byMatricula = {};
  let ignorados = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '' || c === null || c === undefined)) { ignorados++; continue; }

    const matriculaRaw = cols.matricula !== undefined ? row[cols.matricula] : undefined;
    if (matriculaRaw === '' || matriculaRaw === null || matriculaRaw === undefined) { ignorados++; continue; }
    const matriculaNum = parseInt(String(matriculaRaw), 10);
    if (isNaN(matriculaNum) || matriculaNum <= 0) { ignorados++; continue; }

    const verbaRaw = cols.verba !== undefined ? row[cols.verba] : undefined;
    if (verbaRaw === '' || verbaRaw === null || verbaRaw === undefined) { ignorados++; continue; }
    const verbaCode = parseInt(String(verbaRaw), 10);
    if (isNaN(verbaCode) || !VERBA_CODE_TO_FIELD[verbaCode]) { ignorados++; continue; }

    const quantidadeRaw = cols.quantidade !== undefined ? row[cols.quantidade] : undefined;
    if (quantidadeRaw === '' || quantidadeRaw === null || quantidadeRaw === undefined) { ignorados++; continue; }
    const quantidade = parseQuantidadePtBR(quantidadeRaw);

    if (!byMatricula[matriculaNum]) {
      byMatricula[matriculaNum] = {
        nome:       cols.nome       !== undefined ? String(row[cols.nome]       ?? '').trim() : null,
        cargo:      cols.cargo      !== undefined ? String(row[cols.cargo]      ?? '').trim() : null,
        secretaria: cols.secretaria !== undefined ? String(row[cols.secretaria] ?? '').trim() : null,
        unidade:    cols.unidade    !== undefined ? String(row[cols.unidade]    ?? '').trim() : '',
        verbas: {},
      };
    }

    const field = VERBA_CODE_TO_FIELD[verbaCode];
    byMatricula[matriculaNum].verbas[field] =
      (byMatricula[matriculaNum].verbas[field] || 0) + quantidade;
  }

  const registros = [];
  let ambiguos = 0;

  for (const [matStr, dados] of Object.entries(byMatricula)) {
    const matriculaNum = Number(matStr);
    const { verbas } = dados;

    const decomp = decomposeVB335(verbas.atraso ?? 0);
    if (decomp.ambiguo) ambiguos++;

    const faltasRaw = Math.round(verbas.falta ?? 0);
    const faltas    = faltasRaw >= 0 && faltasRaw <= 31 ? faltasRaw : 0;

    registros.push({
      competencia,
      matricula:         matriculaNum,
      nome:              dados.nome       || null,
      cargo:             dados.cargo      || null,
      secretaria:        dados.secretaria || null,
      secretaria_sigla:  null, // resolverSigla não disponível no test inline
      unidade:           dados.unidade    || '',
      atrasos_fracao:    decomp.atrasos_fracao,
      atrasos_dia:       decomp.atrasos_dia,
      dsr:               verbas.dsr               || 0,
      adicional_noturno: verbas.adicional_noturno  || 0,
      hora_extra_50:     Math.floor(verbas.hora_extra_50  || 0),
      faltas,
      hora_extra_100:    Math.floor(verbas.hora_extra_100 || 0),
    });
  }

  return { registros, ignorados, ambiguos };
}

// Inline detectarCabecalho (de colunas.js) — usado na detecção de posição variável
function detectarCabecalho(rows, maxLinhas = 10) {
  const limite = Math.min(maxLinhas, rows.length);
  for (let i = 0; i < limite; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    if (row.every(c => c === '' || c === null || c === undefined)) continue;
    // Para o formato movimento, detecta pelo cabeçalho fixo
    if (detectarColunasMovimento(row) !== null) return { linhaIdx: i, row };
  }
  return null;
}

// ─── Dados de teste ───────────────────────────────────────────────────────────

// Cabeçalho exato do novo formato
const HEADER_MOV = [
  'Matrícula', 'Nome Funcionário', 'Verba', 'Descrição Verba',
  'Quantidade', 'Descrição Contrato', 'Lotação',
  'Descrição Lotação', 'Descrição Local Trabalho',
];

// Arquivo Janeiro: cabeçalho na linha 1 (índice 0), sem linhas extras acima
const ROWS_JANEIRO = [
  HEADER_MOV,
  [12607, 'JOAO DA SILVA',   171, 'FALTAS INJUSTIFICADAS',   '5,00', 'GARI',         '59.00.00', 'SECRETARIA DA SAUDE',    'UBS CENTRAL'],
  [12607, 'JOAO DA SILVA',   335, 'ATRASO',                  '0,33', 'GARI',         '59.00.00', 'SECRETARIA DA SAUDE',    'UBS CENTRAL'],
  [12607, 'JOAO DA SILVA',   504, 'DSR',                     '1,00', 'GARI',         '59.00.00', 'SECRETARIA DA SAUDE',    'UBS CENTRAL'],
  [4321,  'MARIA SOUZA',     335, 'ATRASO',                  '1,33', 'PROFESSORA',   '07.00.00', 'SECRETARIA DE EDUCACAO', 'ESCOLA MPAL'],
  [4321,  'MARIA SOUZA',     171, 'FALTAS INJUSTIFICADAS',   '2,00', 'PROFESSORA',   '07.00.00', 'SECRETARIA DE EDUCACAO', 'ESCOLA MPAL'],
];

// Arquivo Fevereiro: cabeçalho na linha 3 (índice 2), com 2 linhas em branco acima
const ROWS_FEVEREIRO = [
  ['', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', ''],
  HEADER_MOV,
  [12607, 'JOAO DA SILVA',   171, 'FALTAS INJUSTIFICADAS',   '3,00', 'GARI',         '59.00.00', 'SECRETARIA DA SAUDE',    'UBS CENTRAL'],
  [99000, 'PEDRO LIMA',        4, 'HORA EXTRA 50',           '8,00', 'ANALISTA',     '84.00.00', 'SECRETARIA DE TECNOLOGIA','SEDE SETIDE'],
  [99000, 'PEDRO LIMA',        5, 'HORA EXTRA 100',          '4,00', 'ANALISTA',     '84.00.00', 'SECRETARIA DE TECNOLOGIA','SEDE SETIDE'],
];

// ─── 1. detectarColunasMovimento ──────────────────────────────────────────────

describe('detectarColunasMovimento', () => {
  test('detecta as 9 colunas do cabeçalho exato', () => {
    const cols = detectarColunasMovimento(HEADER_MOV);
    expect(cols).not.toBeNull();
    expect(cols.matricula).toBe(0);
    expect(cols.nome).toBe(1);
    expect(cols.verba).toBe(2);
    expect(cols.descVerba).toBe(3);
    expect(cols.quantidade).toBe(4);
    expect(cols.cargo).toBe(5);
    expect(cols.lotacao).toBe(6);
    expect(cols.secretaria).toBe(7);
    expect(cols.unidade).toBe(8);
  });

  test('retorna null para cabeçalho de formato VB (sem Verba+Quantidade)', () => {
    const headerVB = ['MATRICULA', 'nomecompleto', 'descsubunidade', 'VB335', 'VB171'];
    expect(detectarColunasMovimento(headerVB)).toBeNull();
  });

  test('retorna null quando falta coluna essencial (Verba)', () => {
    const incompleto = ['Matrícula', 'Nome Funcionário', 'Quantidade'];
    expect(detectarColunasMovimento(incompleto)).toBeNull();
  });

  test('normaliza acentos — "Matrícula" detectada corretamente', () => {
    const cols = detectarColunasMovimento(HEADER_MOV);
    expect(cols.matricula).toBe(0); // "Matrícula" com acento → normaliza → MATRICULA
  });
});

// ─── 2. validarColunasMovimento ───────────────────────────────────────────────

describe('validarColunasMovimento', () => {
  test('cabeçalho completo → sem erros', () => {
    const cols = detectarColunasMovimento(HEADER_MOV);
    expect(validarColunasMovimento(cols)).toHaveLength(0);
  });

  test('falta Verba → erro específico', () => {
    const cols = { matricula: 0, quantidade: 4 };
    const erros = validarColunasMovimento(cols);
    expect(erros.some(e => /verba/i.test(e))).toBe(true);
  });

  test('falta Quantidade → erro específico', () => {
    const cols = { matricula: 0, verba: 2 };
    const erros = validarColunasMovimento(cols);
    expect(erros.some(e => /quantidade/i.test(e))).toBe(true);
  });

  test('falta tudo → 3 erros', () => {
    expect(validarColunasMovimento({})).toHaveLength(3);
  });
});

// ─── 3. parseQuantidadePtBR ───────────────────────────────────────────────────

describe('parseQuantidadePtBR', () => {
  test('"5,00" → 5', () => {
    expect(parseQuantidadePtBR('5,00')).toBe(5);
  });

  test('"1,33" → 1.33', () => {
    expect(parseQuantidadePtBR('1,33')).toBeCloseTo(1.33);
  });

  test('"0,33" → 0.33', () => {
    expect(parseQuantidadePtBR('0,33')).toBeCloseTo(0.33);
  });

  test('separador de milhar + decimal — "1.000,50" → 1000.5', () => {
    expect(parseQuantidadePtBR('1.000,50')).toBeCloseTo(1000.5);
  });

  test('valor numérico já parseado (número sem texto) → passa direto', () => {
    expect(parseQuantidadePtBR(5)).toBe(5);
  });

  test('vazio → 0', () => {
    expect(parseQuantidadePtBR('')).toBe(0);
    expect(parseQuantidadePtBR(null)).toBe(0);
  });
});

// ─── 4. Detecção de cabeçalho em linha variável ───────────────────────────────

describe('Detecção de cabeçalho em linha variável', () => {
  test('Janeiro — cabeçalho na linha 1 (índice 0)', () => {
    const r = detectarCabecalho(ROWS_JANEIRO);
    expect(r).not.toBeNull();
    expect(r.linhaIdx).toBe(0);
  });

  test('Fevereiro — cabeçalho na linha 3 (índice 2), após 2 linhas em branco', () => {
    const r = detectarCabecalho(ROWS_FEVEREIRO);
    expect(r).not.toBeNull();
    expect(r.linhaIdx).toBe(2);
  });

  test('arquivo completamente vazio → null', () => {
    expect(detectarCabecalho([])).toBeNull();
  });

  test('somente linhas em branco → null', () => {
    expect(detectarCabecalho([['', '', ''], [null, null]])).toBeNull();
  });
});

// ─── 5. Lotação preservada como texto ─────────────────────────────────────────

describe('Lotação preservada como string', () => {
  test('"59.00.00" não vira número — índice detectado corretamente', () => {
    const cols = detectarColunasMovimento(HEADER_MOV);
    // O índice da coluna Lotação é 6
    expect(cols.lotacao).toBe(6);

    // Simula uma linha onde Lotação chega como string
    const row = [12607, 'JOAO', 171, 'FALTA', '5,00', 'GARI', '59.00.00', 'SS', 'UBS'];
    const lotacaoVal = String(row[cols.lotacao]);
    expect(lotacaoVal).toBe('59.00.00'); // mantém o formato com pontos
  });

  test('"07.00.00" com zeros internos preservados', () => {
    const row = [4321, 'MARIA', 335, 'ATRASO', '1,33', 'PROF', '07.00.00', 'SED', 'ESCOLA'];
    const cols = detectarColunasMovimento(HEADER_MOV);
    expect(String(row[cols.lotacao])).toBe('07.00.00');
  });
});

// ─── 6. processarLinhasMovimento — pivot por matrícula ────────────────────────

describe('processarLinhasMovimento — pivot', () => {
  test('Janeiro: 2 matrículas, verbas separadas por linha → 2 registros', () => {
    const cols = detectarColunasMovimento(ROWS_JANEIRO[0]);
    const { registros, ignorados } = processarLinhasMovimento(
      ROWS_JANEIRO, '2025-01-01', { headerIdx: 0, movimentoCols: cols }
    );
    expect(registros).toHaveLength(2);
    expect(ignorados).toBe(0);
  });

  test('Janeiro mat=12607: falta=5, atraso_fracao=1 (0,33 → 1 curto), dsr=1', () => {
    const cols = detectarColunasMovimento(ROWS_JANEIRO[0]);
    const { registros } = processarLinhasMovimento(
      ROWS_JANEIRO, '2025-01-01', { headerIdx: 0, movimentoCols: cols }
    );
    const r = registros.find(x => x.matricula === 12607);
    expect(r).toBeDefined();
    expect(r.faltas).toBe(5);
    expect(r.atrasos_fracao).toBe(1); // 0.33 → decomposeVB335 → 1 atraso curto
    expect(r.atrasos_dia).toBe(0);
    expect(r.dsr).toBe(1);
  });

  test('Janeiro mat=4321: atraso 1,33 → decomposeVB335 prefere fracao=4, dia=0 (menor l)', () => {
    // 1,33 → 1.33; decomposeVB335 compara: {c:1,l:1,err:0.003} vs {c:4,l:0,err:0.002}
    // Sort por l crescente → {l:0} vence → fracao=4, dia=0
    const cols = detectarColunasMovimento(ROWS_JANEIRO[0]);
    const { registros } = processarLinhasMovimento(
      ROWS_JANEIRO, '2025-01-01', { headerIdx: 0, movimentoCols: cols }
    );
    const r = registros.find(x => x.matricula === 4321);
    expect(r).toBeDefined();
    expect(r.atrasos_dia).toBe(0);
    expect(r.atrasos_fracao).toBe(4);
    expect(r.faltas).toBe(2);
  });

  test('Fevereiro: cabeçalho na linha 3 → lê dados corretamente', () => {
    const cols = detectarColunasMovimento(ROWS_FEVEREIRO[2]);
    const { registros } = processarLinhasMovimento(
      ROWS_FEVEREIRO, '2025-02-01', { headerIdx: 2, movimentoCols: cols }
    );
    expect(registros).toHaveLength(2);
    const joao = registros.find(x => x.matricula === 12607);
    expect(joao.faltas).toBe(3);
    const pedro = registros.find(x => x.matricula === 99000);
    expect(pedro.hora_extra_50).toBe(8);
    expect(pedro.hora_extra_100).toBe(4);
  });

  test('linhas totalmente vazias são ignoradas', () => {
    const rowsComVazias = [
      HEADER_MOV,
      ['', '', '', '', '', '', '', '', ''],
      [12607, 'JOAO', 171, 'FALTA', '2,00', 'GARI', '59.00.00', 'SS', 'UBS'],
      [null, null, null, null, null, null, null, null, null],
    ];
    const cols = detectarColunasMovimento(HEADER_MOV);
    const { registros, ignorados } = processarLinhasMovimento(
      rowsComVazias, '2025-01-01', { headerIdx: 0, movimentoCols: cols }
    );
    expect(registros).toHaveLength(1);
    expect(ignorados).toBe(2);
  });

  test('verba desconhecida → linha ignorada, servidor ainda pode aparecer por outras verbas', () => {
    const rows = [
      HEADER_MOV,
      [12607, 'JOAO', 999, 'VERBA DESCONHECIDA', '1,00', 'GARI', '59.00.00', 'SS', 'UBS'],
      [12607, 'JOAO', 171, 'FALTAS',             '3,00', 'GARI', '59.00.00', 'SS', 'UBS'],
    ];
    const cols = detectarColunasMovimento(HEADER_MOV);
    const { registros, ignorados } = processarLinhasMovimento(
      rows, '2025-01-01', { headerIdx: 0, movimentoCols: cols }
    );
    expect(ignorados).toBe(1);
    expect(registros).toHaveLength(1);
    expect(registros[0].faltas).toBe(3);
  });

  test('competência é incluída em todos os registros', () => {
    const cols = detectarColunasMovimento(ROWS_JANEIRO[0]);
    const { registros } = processarLinhasMovimento(
      ROWS_JANEIRO, '2025-01-01', { headerIdx: 0, movimentoCols: cols }
    );
    expect(registros.every(r => r.competencia === '2025-01-01')).toBe(true);
  });

  test('não confunde formato VB com formato movimento', () => {
    // Um cabeçalho VB não tem "Verba" + "Quantidade" → detectarColunasMovimento retorna null
    const headerVB = ['MATRICULA', 'nomecompleto', 'VB335', 'VB171'];
    expect(detectarColunasMovimento(headerVB)).toBeNull();
  });
});

// ─── 7. Cenário E2E ───────────────────────────────────────────────────────────

describe('E2E — arquivos de amostra completos', () => {
  test('Janeiro: processa 5 linhas de dados → 2 matrículas distintas', () => {
    const cabJan = detectarCabecalho(ROWS_JANEIRO);
    expect(cabJan).not.toBeNull();
    const cols = detectarColunasMovimento(cabJan.row);
    const { registros } = processarLinhasMovimento(
      ROWS_JANEIRO, '2025-01-01', { headerIdx: cabJan.linhaIdx, movimentoCols: cols }
    );
    const matriculas = new Set(registros.map(r => r.matricula));
    expect(matriculas.size).toBe(2);
  });

  test('Fevereiro: cabeçalho detectado na posição correta e dados processados', () => {
    const cabFev = detectarCabecalho(ROWS_FEVEREIRO);
    expect(cabFev.linhaIdx).toBe(2);
    const cols = detectarColunasMovimento(cabFev.row);
    const { registros } = processarLinhasMovimento(
      ROWS_FEVEREIRO, '2025-02-01', { headerIdx: cabFev.linhaIdx, movimentoCols: cols }
    );
    expect(registros).toHaveLength(2);
    expect(registros.every(r => r.competencia === '2025-02-01')).toBe(true);
  });

  test('formato VB (.xls antigo) não é detectado como movimento → null', () => {
    const rowsVB = [
      ['MATRICULA', 'nomecompleto', 'descsubunidade', 'deslocal', 'VB335', 'VB171'],
    ];
    expect(detectarCabecalho(rowsVB)).toBeNull(); // helper detectarCabecalho aqui usa movimento
  });
});
