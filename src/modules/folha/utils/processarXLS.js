import * as XLSX from 'xlsx';
import { resolverSigla } from '@/lib/secretarias';
import {
  detectarCabecalho,
  mapearColunas,
  classificarFormato,
  validarMapeamento,
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
    atrasos_dia:    best.l,
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
  const { mapeamento, naoReconhecidas } = mapearColunas(headerRow, mapeamentosCustom);
  const erros      = validarMapeamento(mapeamento);
  const formato    = classificarFormato(mapeamento);
  const linhasDados = Math.max(0, rows.length - linhaIdx - 1);

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
