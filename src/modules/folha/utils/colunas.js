/**
 * Camada de detecção e resolução de colunas da folha de pagamento.
 * Funções puras e isoladas — sem dependências de browser ou banco.
 */

// Normaliza um nome de coluna para comparação: maiúsculas, sem acentos,
// pontuação/barra/sublinhado → espaço, espaços colapsados.
export function normalizarNome(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // remove diacríticos
    .toUpperCase()
    .replace(/[./\-_]/g, ' ')          // pontuação → espaço
    .replace(/\s+/g, ' ')              // colapsa espaços
    .trim();
}

// Colunas de identificação do servidor — iguais nos dois formatos.
export const IDENTIFICADORES = [
  { id: 'matricula',  aliases: ['MATRICULA', 'MATRICULA SERVIDOR', 'MAT'] },
  { id: 'nome',       aliases: ['NOMECOMPLETO', 'NOME COMPLETO', 'NOME', 'SERVIDOR'] },
  { id: 'cargo',      aliases: ['DESCARGO COMPLETA', 'CARGO', 'DESCRICAO CARGO'] },
  { id: 'subunidade', aliases: ['DESCSUBUNIDADE', 'SUBUNIDADE', 'SECRETARIA'] },
  { id: 'local',      aliases: ['DESLOCAL', 'LOCAL', 'LOTACAO'] },
];

// Verbas de desconto — cada uma tem id canônico, código VB e aliases.
export const VERBAS = [
  {
    id: 'atraso', vb: 'VB335',
    aliases: ['VB335', 'ATRASO', 'ATRASO SAIDA MES ANTERIOR'],
    label: 'Atraso',
  },
  {
    id: 'dsr', vb: 'VB504',
    aliases: ['VB504', 'DSR', 'D S R', 'DESCANSO SEMANAL REMUNERADO'],
    label: 'DSR',
  },
  {
    id: 'adicional_noturno', vb: 'VB24',
    aliases: ['VB24', 'ADICIONAL NOTURNO', 'AD NOTURNO'],
    label: 'Adicional Noturno',
  },
  {
    id: 'hora_extra_50', vb: 'VB4',
    aliases: ['VB4', 'HORA EXTRA 50', 'HE 50', 'HORAS EXTRAS 50'],
    label: 'Hora Extra 50%',
  },
  {
    id: 'falta', vb: 'VB171',
    aliases: ['VB171', 'FALTAS INJUSTIFICADAS', 'FALTA', 'FALTAS'],
    label: 'Falta',
  },
  {
    id: 'hora_extra_100', vb: 'VB5',
    aliases: ['VB5', 'HORA EXTRA 100', 'HE 100', 'HORAS EXTRAS 100'],
    label: 'Hora Extra 100%',
  },
];

// Mapas de lookup pré-construídos (O(1) em vez de O(n) por chamada).
const _idMap = new Map();
for (const def of IDENTIFICADORES) {
  for (const a of def.aliases) _idMap.set(normalizarNome(a), { tipo: 'id', id: def.id });
}

const _verbaMap = new Map();
for (const def of VERBAS) {
  for (const a of def.aliases) _verbaMap.set(normalizarNome(a), { tipo: 'verba', id: def.id, vb: def.vb });
}

/**
 * Resolve um nome de coluna bruto para sua definição canônica, ou null
 * se não for reconhecido.
 *
 * @param {*} nomeRaw — valor bruto da célula de cabeçalho
 * @returns {{ tipo: 'id'|'verba', id: string, vb?: string } | null}
 */
export function resolverColuna(nomeRaw) {
  const norm = normalizarNome(nomeRaw);
  return _idMap.get(norm) ?? _verbaMap.get(norm) ?? null;
}

/**
 * Varre as primeiras `maxLinhas` linhas e retorna a primeira que contém
 * ao menos uma coluna reconhecida (identificador ou verba).
 *
 * @returns {{ linhaIdx: number, row: any[] } | null}
 */
export function detectarCabecalho(rows, maxLinhas = 10) {
  const limite = Math.min(maxLinhas, rows.length);
  for (let i = 0; i < limite; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    // Pula linhas completamente vazias
    if (row.every(c => c === '' || c === null || c === undefined)) continue;
    // Elege como cabeçalho a primeira linha com ao menos 1 coluna reconhecida
    if (row.some(c => resolverColuna(c) !== null)) return { linhaIdx: i, row };
  }
  return null;
}

/**
 * Mapeia cada índice de coluna do cabeçalho para sua definição canônica.
 *
 * `mapeamentosCustom` — { [normNome]: fieldDef | 'ignorar' } vindo do
 * localStorage; permite reutilizar decisões manuais de sessões anteriores.
 *
 * @returns {{
 *   mapeamento: { [colIdx]: { tipo, id, vb?, fonte, nomeOriginal } },
 *   naoReconhecidas: [{ colIdx, nome }]
 * }}
 */
export function mapearColunas(headerRow, mapeamentosCustom = {}) {
  const mapeamento = {};
  const naoReconhecidas = [];

  headerRow.forEach((nome, colIdx) => {
    const nomeStr = String(nome ?? '').trim();
    if (!nomeStr) return; // coluna sem nome — ignora

    const normNome = normalizarNome(nomeStr);

    // Mapeamentos salvos pelo usuário têm prioridade
    const customVal = mapeamentosCustom[normNome];
    if (customVal === 'ignorar') return;
    if (customVal && typeof customVal === 'object') {
      mapeamento[colIdx] = { ...customVal, fonte: 'custom', nomeOriginal: nomeStr };
      return;
    }

    const resolved = resolverColuna(nomeStr);
    if (resolved) {
      mapeamento[colIdx] = { ...resolved, fonte: 'auto', nomeOriginal: nomeStr };
    } else {
      naoReconhecidas.push({ colIdx, nome: nomeStr });
    }
  });

  return { mapeamento, naoReconhecidas };
}

/**
 * Classifica o formato do arquivo com base em como as verbas foram
 * reconhecidas: 'VB' (códigos), 'extenso' (nomes), 'misto', ou 'sem_verbas'.
 */
export function classificarFormato(mapeamento) {
  const verbas = Object.values(mapeamento).filter(v => v.tipo === 'verba');
  if (verbas.length === 0) return 'sem_verbas';

  let porVB = 0, porExtenso = 0;
  for (const v of verbas) {
    // Coluna reconhecida pelo código VB quando o nome original é exatamente VBnnn
    if (/^VB\d+$/.test(normalizarNome(v.nomeOriginal))) porVB++;
    else porExtenso++;
  }

  if (porVB > 0 && porExtenso === 0) return 'VB';
  if (porExtenso > 0 && porVB === 0) return 'extenso';
  return 'misto';
}

// ── Formato C: Lançamento do Movimento de Variáveis (layout fixo, long format) ──

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

/**
 * Tenta mapear as 9 colunas fixas do formato "Lançamento do Movimento de Variáveis".
 * Retorna um objeto { matricula, nome, verba, ... } com os índices de coluna, ou null
 * se as 3 colunas essenciais (matricula, verba, quantidade) não forem encontradas.
 *
 * @param {any[]} headerRow
 * @returns {{ matricula?: number, nome?: number, verba?: number,
 *             quantidade?: number, cargo?: number, lotacao?: number,
 *             secretaria?: number, unidade?: number } | null}
 */
export function detectarColunasMovimento(headerRow) {
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

/**
 * Valida as colunas obrigatórias do formato movimento.
 * @returns {string[]}
 */
export function validarColunasMovimento(cols) {
  const erros = [];
  if (cols.matricula  === undefined) erros.push('Coluna "Matrícula" não encontrada no arquivo.');
  if (cols.verba      === undefined) erros.push('Coluna "Verba" não encontrada no arquivo.');
  if (cols.quantidade === undefined) erros.push('Coluna "Quantidade" não encontrada no arquivo.');
  return erros;
}

/**
 * Valida que o mapeamento contém o mínimo necessário para processar:
 * matrícula + nome + ao menos uma verba.
 *
 * @returns {string[]} — array de mensagens de erro (vazio = OK)
 */
export function validarMapeamento(mapeamento) {
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
