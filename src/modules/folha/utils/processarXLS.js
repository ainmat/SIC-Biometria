import * as XLSX from 'xlsx';
import { resolverSigla } from '@/lib/secretarias';
import {
  detectarCabecalho,
  mapearColunas,
  classificarFormato,
  validarMapeamento,
  detectarColunasMovimento,
  validarColunasMovimento,
} from './colunas';

function limparUnidade(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  const idx = s.indexOf(' - ');
  return idx >= 0 ? s.slice(idx + 3).trim() : s;
}

const PESO_CURTO = 0.333;
const TOL_VB335  = 0.01;

export function decomposeVB335(valor) {
  const n = parseFloat(String(valor).replace(',', '.')) || 0;
  if (n <= 0) return { atrasos_fracao: 0, atrasos_dia: 0, ambiguo: false, inconsistente: false };

  const candidates = [];
  for (let c = 0; c <= 60; c++) {
    const rem = n - c * PESO_CURTO;
    if (rem < -TOL_VB335) break;
    const l = Math.round(rem);
    if (l >= 0 && Math.abs(rem - l) < TOL_VB335) {
      const exact = (c * PESO_CURTO + l) === n;
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
    atrasos_dia:    best.l + 0, // normaliza -0 → 0 (Math.round retorna -0 para rem < 0)
    ambiguo:        candidates.length > 1,
    inconsistente:  false,
  };
}

function toNum(val, fallback = 0) {
  const n = parseFloat(String(val ?? '').replace(',', '.'));
  return isNaN(n) ? fallback : n;
}

export async function lerArquivoXLS(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsArrayBuffer(arquivo);
  });
}

// ── Formato C: Lançamento do Movimento de Variáveis ──────────────────────────

// Código numérico da verba → campo canônico do DTO
const VERBA_CODE_TO_FIELD = {
  171: 'falta',
  335: 'atraso',
  504: 'dsr',
  4:   'hora_extra_50',
  5:   'hora_extra_100',
  24:  'adicional_noturno',
};

// Parse de decimal pt-BR: "1.500,33" → 1500.33, "5,00" → 5, "0,33" → 0.33
function parseQuantidadePtBR(val) {
  const s = String(val ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * Processa o formato "Lançamento do Movimento de Variáveis" (long format).
 * Cada linha é uma (matrícula, verba); agrupa por matrícula e produz o
 * mesmo DTO que processarLinhas.
 *
 * @param {any[][]} rows
 * @param {string}  competencia — 'YYYY-MM-DD'
 * @param {{ headerIdx: number, movimentoCols: Object }} analise
 */
export function processarLinhasMovimento(rows, competencia, { headerIdx, movimentoCols }) {
  const cols = movimentoCols;
  const byMatricula = {};
  let ignorados = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => c === '' || c === null || c === undefined)) {
      ignorados++;
      continue;
    }

    const matriculaRaw = cols.matricula !== undefined ? row[cols.matricula] : undefined;
    if (matriculaRaw === '' || matriculaRaw === null || matriculaRaw === undefined) {
      ignorados++;
      continue;
    }
    const matriculaNum = parseInt(String(matriculaRaw), 10);
    if (isNaN(matriculaNum) || matriculaNum <= 0) { ignorados++; continue; }

    const verbaRaw = cols.verba !== undefined ? row[cols.verba] : undefined;
    if (verbaRaw === '' || verbaRaw === null || verbaRaw === undefined) {
      console.warn(`[movimento] Verba nula na linha ${i + 1} (mat=${matriculaNum})`);
      ignorados++;
      continue;
    }
    const verbaCode = parseInt(String(verbaRaw), 10);
    if (isNaN(verbaCode) || !VERBA_CODE_TO_FIELD[verbaCode]) {
      // Verba desconhecida: loga mas não descarta o servidor inteiro
      console.warn(`[movimento] Verba desconhecida ${verbaCode} na linha ${i + 1} (mat=${matriculaNum})`);
      ignorados++;
      continue;
    }

    const quantidadeRaw = cols.quantidade !== undefined ? row[cols.quantidade] : undefined;
    if (quantidadeRaw === '' || quantidadeRaw === null || quantidadeRaw === undefined) {
      console.warn(`[movimento] Quantidade nula na linha ${i + 1} (mat=${matriculaNum}, verba=${verbaCode})`);
      ignorados++;
      continue;
    }
    const quantidade = parseQuantidadePtBR(quantidadeRaw);

    if (!byMatricula[matriculaNum]) {
      // Lotação vem como código ("59.00.00") — preserva como string, não persiste
      byMatricula[matriculaNum] = {
        nome:      cols.nome       !== undefined ? String(row[cols.nome]       ?? '').trim() : null,
        cargo:     cols.cargo      !== undefined ? String(row[cols.cargo]      ?? '').trim() : null,
        secretaria:cols.secretaria !== undefined ? String(row[cols.secretaria] ?? '').trim() : null,
        unidade:   cols.unidade    !== undefined ? String(row[cols.unidade]    ?? '').trim() : '',
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

    const secretariaNome = dados.secretaria || '';

    registros.push({
      competencia,
      matricula:         matriculaNum,
      nome:              dados.nome       || null,
      cargo:             dados.cargo      || null,
      secretaria:        secretariaNome   || null,
      secretaria_sigla:  resolverSigla(secretariaNome),
      unidade:           dados.unidade    || '',
      atrasos_fracao:    decomp.atrasos_fracao,
      atrasos_dia:       decomp.atrasos_dia,
      dsr:               toNum(verbas.dsr),
      adicional_noturno: toNum(verbas.adicional_noturno),
      hora_extra_50:     Math.floor(toNum(verbas.hora_extra_50)),
      faltas,
      hora_extra_100:    Math.floor(toNum(verbas.hora_extra_100)),
    });
  }

  return { registros, ignorados, ambiguos };
}

/**
 * Analisa as linhas já lidas e retorna o resultado do mapeamento de colunas.
 * Ponto de entrada único para o fluxo de importação.
 *
 * @param {any[][]} rows — resultado de XLSX.utils.sheet_to_json
 * @param {Object}  mapeamentosCustom — decisões salvas pelo usuário (localStorage)
 */
export function analisarArquivo(rows, mapeamentosCustom = {}) {
  const cabecalho = detectarCabecalho(rows);
  if (!cabecalho) {
    return {
      ok: false,
      erros: ['Cabeçalho não encontrado nas primeiras 10 linhas. Verifique se o arquivo correto foi selecionado.'],
      headerIdx: -1,
      headerRow: [],
      mapeamento: {},
      naoReconhecidas: [],
      formato: 'sem_verbas',
      linhasDados: 0,
    };
  }

  const { linhaIdx, row: headerRow } = cabecalho;
  const linhasDados = Math.max(0, rows.length - linhaIdx - 1);

  // Detecta Formato C antes de tentar o mapeamento dinâmico
  const movimentoCols = detectarColunasMovimento(headerRow);
  if (movimentoCols) {
    const erros = validarColunasMovimento(movimentoCols);
    // Mapeamento compatível com ModalPrevia: colIdx → def
    const mapeamento = {};
    const _add = (campo, tipo, id) => {
      if (movimentoCols[campo] !== undefined)
        mapeamento[movimentoCols[campo]] = { tipo, id, fonte: 'auto', nomeOriginal: String(headerRow[movimentoCols[campo]] ?? '') };
    };
    _add('matricula',  'id',    'matricula');
    _add('nome',       'id',    'nome');
    _add('verba',      'id',    'verba_mov');
    _add('quantidade', 'id',    'quantidade_mov');
    _add('cargo',      'id',    'cargo');
    _add('lotacao',    'id',    'local');
    _add('secretaria', 'id',    'subunidade');
    _add('unidade',    'id',    'local_trabalho');
    return {
      ok: erros.length === 0,
      erros,
      headerIdx: linhaIdx,
      headerRow,
      mapeamento,
      naoReconhecidas: [],
      formato: 'movimento',
      linhasDados,
      movimentoCols,
    };
  }

  const { mapeamento, naoReconhecidas } = mapearColunas(headerRow, mapeamentosCustom);
  const erros      = validarMapeamento(mapeamento);
  const formato    = classificarFormato(mapeamento);

  return {
    ok: erros.length === 0,
    erros,
    headerIdx: linhaIdx,
    headerRow,
    mapeamento,
    naoReconhecidas,
    formato,
    linhasDados,
  };
}

/**
 * Processa as linhas de dados a partir do mapeamento dinâmico de colunas.
 * Verbas ausentes no mapeamento entram como 0 automaticamente.
 *
 * @param {any[][]} rows
 * @param {string}  competencia — 'YYYY-MM-DD'
 * @param {{ headerIdx: number, mapeamento: Object }} analise
 */
export function processarLinhas(rows, competencia, { headerIdx, mapeamento }) {
  const registros = [];
  let ignorados = 0;
  let ambiguos  = 0;

  // Índice de cada campo canônico na linha (pré-computado para velocidade)
  const idxId    = {};
  const idxVerba = {};
  for (const [colIdxStr, def] of Object.entries(mapeamento)) {
    const i = Number(colIdxStr);
    if (def.tipo === 'id')    idxId[def.id]    = i;
    else if (def.tipo === 'verba') idxVerba[def.id] = i;
  }

  const getId    = (row, id) => idxId[id]    !== undefined ? row[idxId[id]]    : undefined;
  const getVerba = (row, id) => idxVerba[id] !== undefined ? row[idxVerba[id]] : undefined;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) { ignorados++; continue; }

    // Pula linhas completamente vazias
    if (row.every(c => c === '' || c === null || c === undefined)) { ignorados++; continue; }

    const matriculaRaw = getId(row, 'matricula');
    if (matriculaRaw === '' || matriculaRaw === null || matriculaRaw === undefined) {
      ignorados++; continue;
    }

    const matriculaStr = String(matriculaRaw).trim();
    // Ignora linha de repetição do cabeçalho
    if (matriculaStr.toUpperCase() === 'MATRICULA') { ignorados++; continue; }

    const matriculaNum = parseInt(matriculaStr, 10);
    if (isNaN(matriculaNum) || matriculaNum <= 0) { ignorados++; continue; }

    const decomp = decomposeVB335(getVerba(row, 'atraso') ?? 0);
    if (decomp.ambiguo) ambiguos++;

    const faltasRaw = parseInt(String(getVerba(row, 'falta') ?? '0').replace(',', '.'), 10);
    const faltas    = !isNaN(faltasRaw) && faltasRaw >= 0 && faltasRaw <= 31 ? faltasRaw : 0;

    const secretariaNome = String(getId(row, 'subunidade') ?? '').trim();

    registros.push({
      competencia,
      matricula:         matriculaNum,
      nome:              String(getId(row, 'nome')  ?? '').trim() || null,
      cargo:             String(getId(row, 'cargo') ?? '').trim() || null,
      secretaria:        secretariaNome || null,
      secretaria_sigla:  resolverSigla(secretariaNome),
      unidade:           limparUnidade(getId(row, 'local')),
      atrasos_fracao:    decomp.atrasos_fracao,
      atrasos_dia:       decomp.atrasos_dia,
      dsr:               toNum(getVerba(row, 'dsr')),
      adicional_noturno: toNum(getVerba(row, 'adicional_noturno')),
      hora_extra_50:     Math.floor(toNum(getVerba(row, 'hora_extra_50'))),
      faltas,
      hora_extra_100:    Math.floor(toNum(getVerba(row, 'hora_extra_100'))),
    });
  }

  return { registros, ignorados, ambiguos };
}
