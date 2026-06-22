/**
 * Testes para a camada de detecção de colunas da folha de pagamento.
 *
 * As funções são inlined (espelho de src/modules/folha/utils/colunas.js)
 * para compatibilidade com o setup Jest atual (ESM sem babel).
 */

// ─── Inline das funções testadas ─────────────────────────────────────────────

function normalizarNome(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[./\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const IDENTIFICADORES = [
  { id: 'matricula',  aliases: ['MATRICULA', 'MATRICULA SERVIDOR', 'MAT'] },
  { id: 'nome',       aliases: ['NOMECOMPLETO', 'NOME COMPLETO', 'NOME', 'SERVIDOR'] },
  { id: 'cargo',      aliases: ['DESCARGO COMPLETA', 'CARGO', 'DESCRICAO CARGO'] },
  { id: 'subunidade', aliases: ['DESCSUBUNIDADE', 'SUBUNIDADE', 'SECRETARIA'] },
  { id: 'local',      aliases: ['DESLOCAL', 'LOCAL', 'LOTACAO'] },
];

const VERBAS = [
  { id: 'atraso',            vb: 'VB335', aliases: ['VB335', 'ATRASO', 'ATRASO SAIDA MES ANTERIOR'] },
  { id: 'dsr',               vb: 'VB504', aliases: ['VB504', 'DSR', 'D S R', 'DESCANSO SEMANAL REMUNERADO'] },
  { id: 'adicional_noturno', vb: 'VB24',  aliases: ['VB24', 'ADICIONAL NOTURNO', 'AD NOTURNO'] },
  { id: 'hora_extra_50',     vb: 'VB4',   aliases: ['VB4', 'HORA EXTRA 50', 'HE 50', 'HORAS EXTRAS 50'] },
  { id: 'falta',             vb: 'VB171', aliases: ['VB171', 'FALTAS INJUSTIFICADAS', 'FALTA', 'FALTAS'] },
  { id: 'hora_extra_100',    vb: 'VB5',   aliases: ['VB5', 'HORA EXTRA 100', 'HE 100', 'HORAS EXTRAS 100'] },
];

const _idMap = new Map();
for (const def of IDENTIFICADORES)
  for (const a of def.aliases) _idMap.set(normalizarNome(a), { tipo: 'id', id: def.id });

const _verbaMap = new Map();
for (const def of VERBAS)
  for (const a of def.aliases) _verbaMap.set(normalizarNome(a), { tipo: 'verba', id: def.id, vb: def.vb });

function resolverColuna(nomeRaw) {
  const norm = normalizarNome(nomeRaw);
  return _idMap.get(norm) ?? _verbaMap.get(norm) ?? null;
}

function detectarCabecalho(rows, maxLinhas = 10) {
  const limite = Math.min(maxLinhas, rows.length);
  for (let i = 0; i < limite; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    if (row.every(c => c === '' || c === null || c === undefined)) continue;
    if (row.some(c => resolverColuna(c) !== null)) return { linhaIdx: i, row };
  }
  return null;
}

function mapearColunas(headerRow, mapeamentosCustom = {}) {
  const mapeamento = {};
  const naoReconhecidas = [];
  headerRow.forEach((nome, colIdx) => {
    const nomeStr = String(nome ?? '').trim();
    if (!nomeStr) return;
    const normNome = normalizarNome(nomeStr);
    const customVal = mapeamentosCustom[normNome];
    if (customVal === 'ignorar') return;
    if (customVal && typeof customVal === 'object') {
      mapeamento[colIdx] = { ...customVal, fonte: 'custom', nomeOriginal: nomeStr };
      return;
    }
    const resolved = resolverColuna(nomeStr);
    if (resolved) mapeamento[colIdx] = { ...resolved, fonte: 'auto', nomeOriginal: nomeStr };
    else naoReconhecidas.push({ colIdx, nome: nomeStr });
  });
  return { mapeamento, naoReconhecidas };
}

function classificarFormato(mapeamento) {
  const verbas = Object.values(mapeamento).filter(v => v.tipo === 'verba');
  if (verbas.length === 0) return 'sem_verbas';
  let porVB = 0, porExtenso = 0;
  for (const v of verbas) {
    if (/^VB\d+$/.test(normalizarNome(v.nomeOriginal))) porVB++;
    else porExtenso++;
  }
  if (porVB > 0 && porExtenso === 0) return 'VB';
  if (porExtenso > 0 && porVB === 0) return 'extenso';
  return 'misto';
}

function validarMapeamento(mapeamento) {
  const campos = Object.values(mapeamento);
  const erros = [];
  if (!campos.some(v => v.tipo === 'id' && v.id === 'matricula'))
    erros.push('Coluna de matrícula não encontrada no arquivo.');
  if (!campos.some(v => v.tipo === 'id' && v.id === 'nome'))
    erros.push('Coluna de nome não encontrada no arquivo.');
  if (!campos.some(v => v.tipo === 'verba'))
    erros.push('Nenhuma verba reconhecida (ex.: VB335, VB171, FALTAS INJUSTIFICADAS).');
  return erros;
}

// ─── Dados de teste ───────────────────────────────────────────────────────────

// Formato A: .xls, códigos VB, cabeçalho na linha 3 (após banner + linha vazia)
const HEADER_A = ['MATRICULA', 'nomecompleto', 'descargo_completa', 'descsubunidade', 'deslocal',
                  'VB335', 'VB504', 'VB24', 'VB4', 'VB171', 'VB5'];
const ROWS_A = [
  ['Resultado Importação', '', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', '', ''],
  HEADER_A,
  [1234567, 'JOAO DA SILVA', 'GARI', '57 - SED', '01 - GABINETE', 1.333, 0, 0, 0, 2, 0],
  [7654321, 'MARIA SOUZA',   'PROFESSORA', '57 - SED', '02 - ESCOLA', 0, 0.5, 0, 8, 0, 4],
];

// Formato B: .xlsx, verbas por extenso, cabeçalho na linha 1
const HEADER_B = ['MATRICULA', 'nomecompleto', 'descargo_completa', 'descsubunidade', 'deslocal',
                  'ATRASO/SAIDA MES ANTERIOR', 'D.S.R.', 'ADICIONAL NOTURNO', 'FALTAS INJUSTIFICADAS'];
const ROWS_B = [
  HEADER_B,
  [2345678, 'PEDRO LIMA', 'ANALISTA', '84 - SETIDE', '01 - SEDE', '6,66', 0, 0, 1],
  [8765432, 'ANA PAULA',  'AUXILIAR', '84 - SETIDE', '02 - NUCLEO', 0, 1, 0.5, 0],
];

// ─── 1. normalizarNome ────────────────────────────────────────────────────────

describe('normalizarNome', () => {
  test('já normalizado permanece igual', () => {
    expect(normalizarNome('MATRICULA')).toBe('MATRICULA');
  });

  test('lowercase para uppercase', () => {
    expect(normalizarNome('nomecompleto')).toBe('NOMECOMPLETO');
  });

  test('remove acentos', () => {
    expect(normalizarNome('Mátrícula')).toBe('MATRICULA');
    expect(normalizarNome('Descrição')).toBe('DESCRICAO');
  });

  test('sublinhado vira espaço', () => {
    expect(normalizarNome('descargo_completa')).toBe('DESCARGO COMPLETA');
    expect(normalizarNome('desc_subunidade')).toBe('DESC SUBUNIDADE');
  });

  test('barra vira espaço — cobre ATRASO/SAIDA MES ANTERIOR', () => {
    expect(normalizarNome('ATRASO/SAIDA MES ANTERIOR')).toBe('ATRASO SAIDA MES ANTERIOR');
  });

  test('pontos viram espaço e espaços colapsam — cobre D.S.R.', () => {
    expect(normalizarNome('D.S.R.')).toBe('D S R');
  });

  test('null e undefined retornam string vazia', () => {
    expect(normalizarNome(null)).toBe('');
    expect(normalizarNome(undefined)).toBe('');
  });

  test('número é convertido para string', () => {
    expect(normalizarNome(335)).toBe('335');
  });
});

// ─── 2. resolverColuna ────────────────────────────────────────────────────────

describe('resolverColuna', () => {
  test('coluna de matrícula — alias exato', () => {
    expect(resolverColuna('MATRICULA')).toMatchObject({ tipo: 'id', id: 'matricula' });
  });

  test('coluna de nome — formato do arquivo real (lowercase sem espaço)', () => {
    expect(resolverColuna('nomecompleto')).toMatchObject({ tipo: 'id', id: 'nome' });
  });

  test('cargo com sublinhado', () => {
    expect(resolverColuna('descargo_completa')).toMatchObject({ tipo: 'id', id: 'cargo' });
  });

  test('subunidade com sublinhado', () => {
    expect(resolverColuna('descsubunidade')).toMatchObject({ tipo: 'id', id: 'subunidade' });
  });

  test('local com sublinhado', () => {
    expect(resolverColuna('deslocal')).toMatchObject({ tipo: 'id', id: 'local' });
  });

  test('Formato A — todos os 6 códigos VB', () => {
    expect(resolverColuna('VB335')).toMatchObject({ tipo: 'verba', id: 'atraso',            vb: 'VB335' });
    expect(resolverColuna('VB504')).toMatchObject({ tipo: 'verba', id: 'dsr',               vb: 'VB504' });
    expect(resolverColuna('VB24')) .toMatchObject({ tipo: 'verba', id: 'adicional_noturno', vb: 'VB24'  });
    expect(resolverColuna('VB4'))  .toMatchObject({ tipo: 'verba', id: 'hora_extra_50',     vb: 'VB4'   });
    expect(resolverColuna('VB171')).toMatchObject({ tipo: 'verba', id: 'falta',             vb: 'VB171' });
    expect(resolverColuna('VB5'))  .toMatchObject({ tipo: 'verba', id: 'hora_extra_100',    vb: 'VB5'   });
  });

  test('Formato B — alias ATRASO/SAIDA MES ANTERIOR (barra normalizada)', () => {
    expect(resolverColuna('ATRASO/SAIDA MES ANTERIOR')).toMatchObject({ tipo: 'verba', id: 'atraso', vb: 'VB335' });
  });

  test('Formato B — D.S.R. (pontos normalizados)', () => {
    expect(resolverColuna('D.S.R.')).toMatchObject({ tipo: 'verba', id: 'dsr', vb: 'VB504' });
  });

  test('Formato B — ADICIONAL NOTURNO', () => {
    expect(resolverColuna('ADICIONAL NOTURNO')).toMatchObject({ tipo: 'verba', id: 'adicional_noturno' });
  });

  test('Formato B — FALTAS INJUSTIFICADAS', () => {
    expect(resolverColuna('FALTAS INJUSTIFICADAS')).toMatchObject({ tipo: 'verba', id: 'falta', vb: 'VB171' });
  });

  test('coluna desconhecida retorna null', () => {
    expect(resolverColuna('Resultado Importação')).toBeNull();
    expect(resolverColuna('')).toBeNull();
    expect(resolverColuna('   ')).toBeNull();
  });
});

// ─── 3. detectarCabecalho ─────────────────────────────────────────────────────

describe('detectarCabecalho', () => {
  test('Formato A — cabeçalho encontrado na linha 3 (índice 2), após banner e linha vazia', () => {
    const r = detectarCabecalho(ROWS_A);
    expect(r).not.toBeNull();
    expect(r.linhaIdx).toBe(2);
    expect(r.row).toEqual(HEADER_A);
  });

  test('Formato B — cabeçalho encontrado na linha 1 (índice 0)', () => {
    const r = detectarCabecalho(ROWS_B);
    expect(r).not.toBeNull();
    expect(r.linhaIdx).toBe(0);
    expect(r.row).toEqual(HEADER_B);
  });

  test('arquivo sem cabeçalho retorna null', () => {
    const rows = [
      ['Resultado Importação', ''],
      ['', ''],
      ['Algum texto aleatório', 'Outro texto'],
    ];
    expect(detectarCabecalho(rows)).toBeNull();
  });

  test('respeita o limite maxLinhas', () => {
    // Cabeçalho está na linha 5 (índice 4), mas limite é 3
    const rows = [
      ['Lixo 1'], ['Lixo 2'], ['Lixo 3'], ['Lixo 4'],
      ['MATRICULA', 'nomecompleto', 'VB335'],
    ];
    expect(detectarCabecalho(rows, 3)).toBeNull();
    expect(detectarCabecalho(rows, 5)).not.toBeNull();
  });

  test('linhas completamente vazias são ignoradas', () => {
    const rows = [
      ['', '', '', '', ''],
      [null, null, null],
      ['MATRICULA', 'nomecompleto', 'VB335'],
    ];
    const r = detectarCabecalho(rows);
    expect(r.linhaIdx).toBe(2);
  });
});

// ─── 4. mapearColunas ─────────────────────────────────────────────────────────

describe('mapearColunas', () => {
  test('Formato A — mapeia todas as 11 colunas sem restos', () => {
    const { mapeamento, naoReconhecidas } = mapearColunas(HEADER_A);
    expect(Object.keys(mapeamento)).toHaveLength(11);
    expect(naoReconhecidas).toHaveLength(0);
  });

  test('Formato B — mapeia as 9 colunas sem restos', () => {
    const { mapeamento, naoReconhecidas } = mapearColunas(HEADER_B);
    expect(Object.keys(mapeamento)).toHaveLength(9);
    expect(naoReconhecidas).toHaveLength(0);
  });

  test('coluna desconhecida aparece em naoReconhecidas', () => {
    const header = ['MATRICULA', 'nomecompleto', 'VB171', 'COLUNA_ESTRANHA'];
    const { naoReconhecidas } = mapearColunas(header);
    expect(naoReconhecidas).toHaveLength(1);
    expect(naoReconhecidas[0].nome).toBe('COLUNA_ESTRANHA');
  });

  test('mapeamento custom de campo desconhecido é aplicado', () => {
    const header = ['MATRICULA', 'nomecompleto', 'VB171', 'CAMPO_X'];
    const custom = { 'CAMPO X': { tipo: 'verba', id: 'dsr', vb: 'VB504' } };
    const { mapeamento, naoReconhecidas } = mapearColunas(header, custom);
    // CAMPO_X normaliza para CAMPO X, que está no custom
    expect(naoReconhecidas).toHaveLength(0);
    const campo = Object.values(mapeamento).find(v => v.id === 'dsr');
    expect(campo).toBeDefined();
    expect(campo.fonte).toBe('custom');
  });

  test('custom com valor "ignorar" remove a coluna do mapeamento', () => {
    const header = ['MATRICULA', 'nomecompleto', 'VB171', 'VB335'];
    const custom = { 'VB335': 'ignorar' };
    const { mapeamento } = mapearColunas(header, custom);
    const temAtraso = Object.values(mapeamento).some(v => v.id === 'atraso');
    expect(temAtraso).toBe(false);
  });

  test('colunas vazias são ignoradas silenciosamente', () => {
    const header = ['MATRICULA', '', 'nomecompleto', null, 'VB171'];
    const { mapeamento } = mapearColunas(header);
    expect(Object.values(mapeamento).some(v => v.id === 'matricula')).toBe(true);
    expect(Object.values(mapeamento).some(v => v.id === 'nome')).toBe(true);
  });
});

// ─── 5. classificarFormato ────────────────────────────────────────────────────

describe('classificarFormato', () => {
  test('Formato A → "VB"', () => {
    const { mapeamento } = mapearColunas(HEADER_A);
    expect(classificarFormato(mapeamento)).toBe('VB');
  });

  test('Formato B → "extenso"', () => {
    const { mapeamento } = mapearColunas(HEADER_B);
    expect(classificarFormato(mapeamento)).toBe('extenso');
  });

  test('sem nenhuma verba → "sem_verbas"', () => {
    const { mapeamento } = mapearColunas(['MATRICULA', 'nomecompleto']);
    expect(classificarFormato(mapeamento)).toBe('sem_verbas');
  });

  test('misto quando há VB e extenso juntos', () => {
    // VB335 (VB) + FALTAS INJUSTIFICADAS (extenso)
    const header = ['MATRICULA', 'nomecompleto', 'VB335', 'FALTAS INJUSTIFICADAS'];
    const { mapeamento } = mapearColunas(header);
    expect(classificarFormato(mapeamento)).toBe('misto');
  });
});

// ─── 6. validarMapeamento ────────────────────────────────────────────────────

describe('validarMapeamento', () => {
  test('Formato A completo → sem erros', () => {
    const { mapeamento } = mapearColunas(HEADER_A);
    expect(validarMapeamento(mapeamento)).toHaveLength(0);
  });

  test('Formato B completo → sem erros', () => {
    const { mapeamento } = mapearColunas(HEADER_B);
    expect(validarMapeamento(mapeamento)).toHaveLength(0);
  });

  test('faltando matrícula → erro específico', () => {
    const { mapeamento } = mapearColunas(['nomecompleto', 'VB171']);
    const erros = validarMapeamento(mapeamento);
    expect(erros.some(e => /matr/i.test(e))).toBe(true);
  });

  test('faltando nome → erro específico', () => {
    const { mapeamento } = mapearColunas(['MATRICULA', 'VB171']);
    const erros = validarMapeamento(mapeamento);
    expect(erros.some(e => /nome/i.test(e))).toBe(true);
  });

  test('sem nenhuma verba → erro específico', () => {
    const { mapeamento } = mapearColunas(['MATRICULA', 'nomecompleto']);
    const erros = validarMapeamento(mapeamento);
    expect(erros.some(e => /verba/i.test(e))).toBe(true);
  });

  test('todos os três faltando → 3 erros', () => {
    expect(validarMapeamento({})).toHaveLength(3);
  });

  test('verbas ausentes (apenas algumas HE) não geram erro — são opcionais', () => {
    // Formato B tem apenas 4 verbas, mas isso é válido
    const { mapeamento } = mapearColunas(HEADER_B);
    expect(validarMapeamento(mapeamento)).toHaveLength(0);
  });
});

// ─── 7. Cenários E2E ─────────────────────────────────────────────────────────

describe('Cenário E2E — Formato A (.xls, VB, banner na linha 1)', () => {
  let analise;

  beforeAll(() => {
    const cabecalho = detectarCabecalho(ROWS_A);
    const { mapeamento, naoReconhecidas } = mapearColunas(cabecalho.row);
    const erros = validarMapeamento(mapeamento);
    const formato = classificarFormato(mapeamento);
    analise = { cabecalho, mapeamento, naoReconhecidas, erros, formato };
  });

  test('cabeçalho encontrado na linha 3 (índice 2)', () => {
    expect(analise.cabecalho.linhaIdx).toBe(2);
  });

  test('6 verbas detectadas', () => {
    const verbas = Object.values(analise.mapeamento).filter(v => v.tipo === 'verba');
    expect(verbas).toHaveLength(6);
  });

  test('5 identificadores detectados', () => {
    const ids = Object.values(analise.mapeamento).filter(v => v.tipo === 'id');
    expect(ids).toHaveLength(5);
  });

  test('nenhuma coluna não reconhecida', () => {
    expect(analise.naoReconhecidas).toHaveLength(0);
  });

  test('formato classificado como VB', () => {
    expect(analise.formato).toBe('VB');
  });

  test('validação passa sem erros', () => {
    expect(analise.erros).toHaveLength(0);
  });

  test('processa sem mapeamento manual — critério de aceite', () => {
    // Confirma que o arquivo seria aceito automaticamente (ok = true)
    expect(analise.erros).toHaveLength(0);
    expect(analise.naoReconhecidas).toHaveLength(0);
  });
});

describe('Cenário E2E — Formato B (.xlsx, extenso, sem HE)', () => {
  let analise;

  beforeAll(() => {
    const cabecalho = detectarCabecalho(ROWS_B);
    const { mapeamento, naoReconhecidas } = mapearColunas(cabecalho.row);
    const erros = validarMapeamento(mapeamento);
    const formato = classificarFormato(mapeamento);
    analise = { cabecalho, mapeamento, naoReconhecidas, erros, formato };
  });

  test('cabeçalho encontrado na linha 1 (índice 0)', () => {
    expect(analise.cabecalho.linhaIdx).toBe(0);
  });

  test('4 verbas detectadas (sem HE 50% e HE 100%)', () => {
    const verbas = Object.values(analise.mapeamento).filter(v => v.tipo === 'verba');
    expect(verbas).toHaveLength(4);
  });

  test('verbas presentes: atraso, dsr, adicional_noturno, falta', () => {
    const ids = Object.values(analise.mapeamento)
      .filter(v => v.tipo === 'verba')
      .map(v => v.id)
      .sort();
    expect(ids).toEqual(['adicional_noturno', 'atraso', 'dsr', 'falta']);
  });

  test('verbas ausentes (HE) não geram erro — entram como 0', () => {
    expect(analise.erros).toHaveLength(0);
  });

  test('nenhuma coluna não reconhecida', () => {
    expect(analise.naoReconhecidas).toHaveLength(0);
  });

  test('formato classificado como extenso', () => {
    expect(analise.formato).toBe('extenso');
  });

  test('processa sem mapeamento manual — critério de aceite', () => {
    expect(analise.erros).toHaveLength(0);
    expect(analise.naoReconhecidas).toHaveLength(0);
  });
});
