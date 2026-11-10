/**
 * analisarHorasPositivas.js
 *
 * Cruza duas fontes reais do sistema de ponto:
 *
 * 1. CSV de marcações (separado por TAB):
 *    Colunas: Coletor, Matricula, Nome, Categoria, Departamento, ID,
 *             Data_Hora (DD/MM/YYYY HH:MM), Status, E_S (I/S), Bloqueado,
 *             Validade_Inicial, Validade_Final, Ativo
 *    — somente marcações com E_S = "I" são usadas (entradas)
 *
 * 2. XLSX de horários previstos (separado por TAB ou Excel):
 *    Colunas: funcionariocartao, funcionarionome, cargocodigo, cargodescricao,
 *             setorcodigo, setordescricao, calendariodata, calendariohorarioprevisto
 *    — calendariohorarioprevisto = "HH:MM HH:MM HH:MM HH:MM"
 *      (1º horário = início previsto do 1º período)
 *
 * Regra: hora positiva na entrada = início previsto − 1ª marcação de entrada > LIMITE_MIN
 *
 * O cruzamento é feito por (nome normalizado + data), pois matrícula/cartão
 * são numerações distintas nos dois sistemas.
 */

import * as XLSX from 'xlsx';
import XLSXStyle from 'xlsx-js-style';

export const LIMITE_PADRAO = 60; // "mais de 1 hora"
const EXTREMO_MINUTOS = 7 * 60; // marcações muito extremas → suspeita de erro

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** "HH:MM" → minutos desde meia-noite. null se inválido. */
export function parsearHorario(str) {
  if (!str && str !== 0) return null;
  const s = String(str).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "DD/MM/YYYY HH:MM" ou número serial Excel → { data: "YYYY-MM-DD", horario: "HH:MM" }. null se inválido. */
function parsearDataHora(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  // Se for número (serial Excel com fração de dia)
  if (typeof raw === 'number' && raw > 1000) {
    try {
      const d = XLSX.SSF.parse_date_code(raw);
      if (d) {
        const yyyy = String(d.y);
        const mm = String(d.m).padStart(2, '0');
        const dd = String(d.d).padStart(2, '0');
        const H = String(d.H).padStart(2, '0');
        const M = String(d.M).padStart(2, '0');
        return { data: `${yyyy}-${mm}-${dd}`, horario: `${H}:${M}` };
      }
    } catch (_) {}
  }

  const s = String(raw).trim();

  // Formato brasileiro com data e hora: "01/01/2026 06:53" ou "01/01/2026 06:53:00"
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}:\d{2})(?::\d{2})?$/);
  if (m) {
    const [, dd, mm, yyyy, hora] = m;
    return {
      data: `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`,
      horario: hora,
    };
  }

  // Formato ISO: "2026-01-01 06:53" ou "2026-01-01T06:53:00"
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}:\d{2})/);
  if (m) {
    const [, yyyy, mm, dd, hora] = m;
    return {
      data: `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`,
      horario: hora,
    };
  }

  // Se for string numérica (ex: "46023.2868")
  const num = parseFloat(s);
  if (!isNaN(num) && num > 1000) {
    try {
      const d = XLSX.SSF.parse_date_code(num);
      if (d) {
        const yyyy = String(d.y);
        const mm = String(d.m).padStart(2, '0');
        const dd = String(d.d).padStart(2, '0');
        const H = String(d.H).padStart(2, '0');
        const M = String(d.M).padStart(2, '0');
        return { data: `${yyyy}-${mm}-${dd}`, horario: `${H}:${M}` };
      }
    } catch (_) {}
  }

  return null;
}

/** "DD/MM/YYYY", "YYYY-MM-DD" ou número serial Excel → "YYYY-MM-DD". null se inválido. */
function parsearData(raw) {
  if (raw === null || raw === undefined || raw === '') return null;

  if (typeof raw === 'number' && raw > 1000) {
    try {
      const d = XLSX.SSF.parse_date_code(Math.round(raw));
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } catch (_) {}
  }

  const s = String(raw).trim();

  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const n = parseInt(s, 10);
  if (!isNaN(n) && n > 1000) {
    try {
      const d = XLSX.SSF.parse_date_code(n);
      if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } catch (_) {}
  }

  return null;
}

/**
 * Extrai início e fim previstos do campo calendariohorarioprevisto.
 * Ex: "06:00 11:00 12:00 15:00" → inicio: 360 (06:00), fim: 900 (15:00)
 * Ex: "08:00 17:00" → inicio: 480 (08:00), fim: 1020 (17:00)
 * Ex: "08:00" → inicio: 480 (08:00), fim: null
 */
export function parsearHorariosPrevistos(raw) {
  if (!raw) return { inicioMin: null, fimMin: null, folga: true };
  const s = String(raw).trim();
  if (!s || /folg|dsr|day.?off|\bF\b/i.test(s)) {
    return { inicioMin: null, fimMin: null, folga: true };
  }
  const matches = s.match(/\d{1,2}:\d{2}/g);
  if (!matches || matches.length === 0) {
    return { inicioMin: null, fimMin: null, folga: true };
  }
  const inicioMin = parsearHorario(matches[0]);
  const fimMin = matches.length > 1 ? parsearHorario(matches[matches.length - 1]) : null;
  return { inicioMin, fimMin, folga: false };
}

/** Compatibilidade: extrai o 1º horário de entrada */
function parsearPrimeiroHorarioPrevisto(raw) {
  return parsearHorariosPrevistos(raw).inicioMin;
}

/** Normaliza nome: maiúsculas, sem espaços duplos, sem trailers. */
function normalizarNome(nome) {
  if (!nome) return '';
  return String(nome).trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Minutos → "HH:MM". */
export function minParaHorario(min) {
  if (min === null || min === undefined) return '--:--';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Minutos → "1h05min". */
export function minParaHrMm(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h${String(m).padStart(2, '0')}min`;
}

/** "YYYY-MM-DD" → "DD/MM/YYYY". */
export function formatarData(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leitura de arquivos
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lê o CSV de marcações (TSV — separado por TAB).
 *
 * Colunas esperadas (case-insensitive):
 *   Nome | Data_Hora | E_S
 *
 * Retorna lista de entradas: [{ nome, data, horario }]
 */
export async function lerCSVMarcacoes(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        // raw: true é essencial em arquivos CSV/TSV para evitar que o SheetJS
        // interprete incorretamente as datas "DD/MM/YYYY" como mês/dia americano "MM/DD/YYYY"
        const wb = XLSX.read(e.target.result, { type: 'array', raw: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });

        if (rows.length < 2) {
          return reject(new Error('CSV de marcações está vazio ou sem dados.'));
        }

        // Pula linhas de cabeçalho vazias
        let headerIdx = 0;
        while (headerIdx < rows.length && rows[headerIdx].every(c => !c)) headerIdx++;

        const headers = rows[headerIdx].map(h => String(h).trim().toUpperCase());

        // Detectar colunas
        const col = (candidatos) => {
          for (const c of candidatos) {
            const idx = headers.findIndex(h => h === c || h.replace(/[_ ]/g, '') === c.replace(/[_ ]/g, ''));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const colNome    = col(['NOME', 'SERVIDOR', 'FUNCIONÁRIO', 'FUNCIONARIO']);
        const colDataHora = col(['DATA_HORA', 'DATAHORA', 'DATA HORA', 'DATETIME', 'DATA_MARCACAO', 'MARCACAO']);
        const colES      = col(['E_S', 'ES', 'TIPO', 'ENTRADA_SAIDA', 'TIPO_MARCACAO']);
        const colDep     = col(['DEPARTAMENTO', 'SETOR', 'LOTACAO', 'SECRETARIA', 'CATEGORIA']);
        const colMatricula = col(['MATRICULA', 'MATRÍCULA', 'CARTAO', 'CARTÃO', 'CHAPA', 'FOLHA', 'ID', 'CODIGO', 'COD']);

        if (colNome === -1) {
          return reject(new Error(
            `Coluna "Nome" não encontrada no CSV.\nColunas detectadas: ${headers.join(', ')}`
          ));
        }
        if (colDataHora === -1) {
          return reject(new Error(
            `Coluna "Data_Hora" não encontrada no CSV.\nColunas detectadas: ${headers.join(', ')}`
          ));
        }

        const marcacoes = [];
        let linhasInvalidas = 0;

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          const nome = normalizarNome(row[colNome]);
          if (!nome) continue;

          // Detecta se é entrada ou saída
          let tipoES = 'I';
          if (colES !== -1) {
            const es = String(row[colES] || '').trim().toUpperCase();
            if (es === 'S' || es === 'SAIDA' || es === 'SAÍDA' || es === 'OUT') {
              tipoES = 'S';
            } else if (es === 'I' || es === 'E' || es === 'ENTRADA' || es === 'IN') {
              tipoES = 'I';
            } else {
              tipoES = 'OUTRO';
            }
          }

          const dataHoraRaw = String(row[colDataHora]).trim();
          const parsed = parsearDataHora(dataHoraRaw);
          if (!parsed) {
            linhasInvalidas++;
            continue;
          }

          const departamento = colDep !== -1 ? String(row[colDep] || '').trim() : '';
          const matricula = colMatricula !== -1 ? String(row[colMatricula] || '').trim() : '';

          marcacoes.push({
            nome,
            data: parsed.data,
            horario: parsed.horario,
            departamento,
            matricula,
            tipoES,
          });
        }

        if (marcacoes.length === 0) {
          return reject(new Error(
            'Nenhuma marcação válida encontrada no CSV.\n' +
            (linhasInvalidas > 0 ? `${linhasInvalidas} linhas com Data_Hora inválida ignoradas.` : '')
          ));
        }

        resolve(marcacoes);
      } catch (err) {
        reject(new Error('Erro ao processar CSV de marcações: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo.'));
    reader.readAsArrayBuffer(arquivo);
  });
}

/**
 * Lê o XLSX de horários previstos (formato real: uma linha por servidor/dia).
 *
 * Colunas esperadas:
 *   funcionarionome | calendariodata | calendariohorarioprevisto
 *
 * Retorna mapa: Map<"NOME|YYYY-MM-DD", { horarioStr, inicioMin }>
 * (cada chave é única por servidor + data)
 */
export async function lerXLSXHorarios(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (rows.length < 2) {
          return reject(new Error('XLSX de horários está vazio.'));
        }

        let headerIdx = 0;
        while (headerIdx < rows.length && rows[headerIdx].every(c => !c)) headerIdx++;

        const headers = rows[headerIdx].map(h => String(h).trim().toLowerCase().replace(/\s+/g, ''));

        const col = (candidatos) => {
          for (const c of candidatos) {
            const idx = headers.findIndex(h => h === c || h.includes(c.replace(/\s/g, '')));
            if (idx !== -1) return idx;
          }
          return -1;
        };

        const colNome      = col(['funcionarionome', 'nome', 'servidor', 'funcionario']);
        const colData      = col(['calendariodata', 'data', 'dt', 'calendáriodata']);
        const colHorario   = col(['calendariohorarioprevisto', 'horarioprevisto', 'horario', 'horárioprevisto', 'previsto']);
        // Colunas opcionais (enriquecem o relatório)
        const colCargo     = col(['cargodescricao', 'cargo', 'descricaocargo', 'funcao']);
        const colSetor     = col(['setordescricao', 'setor', 'departamento', 'descricaosetor', 'lotacao']);
        const colMatricula = col(['funcionariomatricula', 'matricula', 'cartao', 'chapa', 'codigofuncionario', 'id']);

        if (colNome === -1 || colData === -1 || colHorario === -1) {
          return reject(new Error(
            `Colunas não detectadas no XLSX de horários.\n` +
            `Encontradas: ${headers.join(', ')}\n` +
            `Necessário: funcionarionome, calendariodata, calendariohorarioprevisto`
          ));
        }

        // Mapa: "NOME|YYYY-MM-DD" → { horarioStr, inicioMin, folga, cargo, setor, matricula }
        const mapa = new Map();
        // Mapa geral: NOME → { cargo, setor, matricula }
        const infoServidores = new Map();
        let linhasIgnoradas = 0;

        for (let i = headerIdx + 1; i < rows.length; i++) {
          const row = rows[i];
          const nome = normalizarNome(row[colNome]);
          if (!nome) continue;

          const data = parsearData(row[colData]);
          if (!data) { linhasIgnoradas++; continue; }

          const cargo = colCargo !== -1 ? String(row[colCargo] || '').trim() : '';
          const setor = colSetor !== -1 ? String(row[colSetor] || '').trim() : '';
          const matricula = colMatricula !== -1 ? String(row[colMatricula] || '').trim() : '';

          if ((cargo || setor || matricula) && (!infoServidores.has(nome) || (!infoServidores.get(nome).cargo && cargo))) {
            infoServidores.set(nome, {
              cargo: cargo || infoServidores.get(nome)?.cargo || '',
              setor: setor || infoServidores.get(nome)?.setor || '',
              matricula: matricula || infoServidores.get(nome)?.matricula || '',
            });
          }

          const horarioRaw = String(row[colHorario]).trim();
          const { inicioMin, fimMin, folga } = parsearHorariosPrevistos(horarioRaw);

          const chave = `${nome}|${data}`;
          if (!mapa.has(chave)) {
            mapa.set(chave, {
              horarioStr: horarioRaw || '(folga)',
              inicioMin,
              fimMin,
              folga,
              cargo,
              setor,
              matricula,
            });
          }
        }

        if (mapa.size === 0) {
          return reject(new Error('Nenhuma escala válida encontrada no XLSX de horários.'));
        }

        // Anexa infoServidores ao Map para uso no cruzamento
        mapa.infoServidores = infoServidores;
        resolve(mapa);
      } catch (err) {
        reject(new Error('Erro ao processar XLSX de horários: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Erro ao ler arquivo XLSX.'));
    reader.readAsArrayBuffer(arquivo);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cruzamento principal (Entrada, Saída e Geral)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Array}  marcacoes       saída de lerCSVMarcacoes [{ nome, data, horario, departamento, tipoES }]
 * @param {Map}    mapaHorarios    saída de lerXLSXHorarios ("NOME|DATA" → entrada)
 * @param {number} limiteMinutos   padrão 60 (mais de 1 hora)
 * @param {string} modoAnalise     'entrada' | 'saida' | 'geral'
 */
export function cruzarDados(marcacoes, mapaHorarios, limiteMinutos = LIMITE_PADRAO, modoAnalise = 'entrada') {
  // 1. Agrupar marcações do CSV por servidor + data
  const mapaDiaServidor = new Map(); // "NOME|DATA" → { entradas: [], saidas: [], todas: [], departamento: '' }
  const diasComMarcacaoPorServidor = new Map(); // NOME → Set(data)
  const departamentoPorServidor = new Map(); // NOME → departamento
  const matriculaPorServidor = new Map(); // NOME → matricula

  for (const { nome, data, horario, departamento, matricula, tipoES } of marcacoes) {
    if (!diasComMarcacaoPorServidor.has(nome)) {
      diasComMarcacaoPorServidor.set(nome, new Set());
    }
    diasComMarcacaoPorServidor.get(nome).add(data);

    if (departamento && !departamentoPorServidor.has(nome)) {
      departamentoPorServidor.set(nome, departamento);
    }
    if (matricula && !matriculaPorServidor.has(nome)) {
      matriculaPorServidor.set(nome, matricula);
    }

    const minutos = parsearHorario(horario);
    if (minutos === null) continue;

    const chave = `${nome}|${data}`;
    if (!mapaDiaServidor.has(chave)) {
      mapaDiaServidor.set(chave, { entradas: [], saidas: [], todas: [], departamento });
    }
    const info = mapaDiaServidor.get(chave);
    info.todas.push(minutos);
    if (tipoES === 'I') info.entradas.push(minutos);
    else if (tipoES === 'S') info.saidas.push(minutos);
    if (departamento && !info.departamento) info.departamento = departamento;
  }

  const infoServidores = mapaHorarios.infoServidores || new Map();

  // 2. Nomes para verificação de correspondência
  const nomesCSV = new Set([...diasComMarcacaoPorServidor.keys()]);
  const nomesXLSX = new Set([...mapaHorarios.keys()].map(k => k.split('|')[0]));
  const semCorrespondencia = [...nomesCSV].filter(n => !nomesXLSX.has(n));

  // 3. Processar cada par servidor + dia
  const ocorrencias = [];
  const semHorario = [];
  const extremos = [];

  for (const [chave, infoDia] of mapaDiaServidor.entries()) {
    const [nome, data] = chave.split('|');
    const depCSV = infoDia.departamento || departamentoPorServidor.get(nome) || '';
    const entrada = mapaHorarios.get(chave);
    const infoGeral = infoServidores.get(nome) || {};

    const setor = entrada?.setor || infoGeral.setor || depCSV || 'NÃO INFORMADO';
    const cargo = entrada?.cargo || infoGeral.cargo || 'NÃO INFORMADO';
    const matricula = entrada?.matricula || infoGeral.matricula || matriculaPorServidor.get(nome) || '';

    // Determinar primeira entrada e última saída do dia
    const primeiraEntradaMin = infoDia.entradas.length > 0
      ? Math.min(...infoDia.entradas)
      : infoDia.todas.length > 0 ? Math.min(...infoDia.todas) : null;

    const ultimaSaidaMin = infoDia.saidas.length > 0
      ? Math.max(...infoDia.saidas)
      : infoDia.todas.length > 1 ? Math.max(...infoDia.todas) : null;

    if (!entrada) {
      semHorario.push({
        nome,
        data,
        setor,
        cargo,
        primeiraMarcacao: minParaHorario(primeiraEntradaMin),
        ultimaMarcacao: minParaHorario(ultimaSaidaMin),
        motivo: nomesXLSX.has(nome)
          ? 'Dia ausente no xlsx de horários'
          : 'Servidor não encontrado no xlsx',
      });
      continue;
    }

    if (entrada.folga || (entrada.inicioMin === null && entrada.fimMin === null)) {
      semHorario.push({
        nome,
        data,
        setor,
        cargo,
        primeiraMarcacao: minParaHorario(primeiraEntradaMin),
        ultimaMarcacao: minParaHorario(ultimaSaidaMin),
        motivo: entrada.folga ? 'Dia sem horário previsto (folga) no xlsx' : 'Horário sem escala identificável',
      });
      continue;
    }

    // ── Avaliação de Entrada ──
    let minutosEntrada = 0;
    let isExtremoEntrada = false;

    if ((modoAnalise === 'entrada' || modoAnalise === 'geral') && primeiraEntradaMin !== null && entrada.inicioMin !== null) {
      // Regra de turno da tarde/noite: se entrada é >= 15h e marcou antes das 9h, é saída do turno anterior
      const isTurnoNoturno = entrada.inicioMin >= 15 * 60 && primeiraEntradaMin < 9 * 60;
      if (!isTurnoNoturno) {
        const antecipacaoEntrada = entrada.inicioMin - primeiraEntradaMin;
        if (antecipacaoEntrada > 6 * 60) {
          isExtremoEntrada = true;
          extremos.push({
            nome,
            data,
            setor,
            cargo,
            tipo: 'ENTRADA',
            horarioPrevisto: entrada.horarioStr,
            previstoMin: entrada.inicioMin,
            marcadoMin: primeiraEntradaMin,
            previstoFormatado: minParaHorario(entrada.inicioMin),
            marcadoFormatado: minParaHorario(primeiraEntradaMin),
            minutosHE: antecipacaoEntrada,
            motivo: 'Antecipação superior a 6h — provável erro de coletor',
          });
        } else if (antecipacaoEntrada > limiteMinutos) {
          minutosEntrada = antecipacaoEntrada;
        }
      }
    }

    // ── Avaliação de Saída ──
    let minutosSaida = 0;
    let isExtremoSaida = false;

    if ((modoAnalise === 'saida' || modoAnalise === 'geral') && ultimaSaidaMin !== null && entrada.fimMin !== null) {
      // Excedente de saída: marcação real − saída prevista
      let excedenteSaida = ultimaSaidaMin - entrada.fimMin;
      // Caso de escala que cruza a meia-noite
      if (entrada.fimMin < entrada.inicioMin && ultimaSaidaMin < entrada.inicioMin) {
        excedenteSaida = ultimaSaidaMin - entrada.fimMin;
      }

      if (excedenteSaida > 6 * 60) {
        isExtremoSaida = true;
        extremos.push({
          nome,
          data,
          setor,
          cargo,
          tipo: 'SAÍDA',
          horarioPrevisto: entrada.horarioStr,
          previstoMin: entrada.fimMin,
          marcadoMin: ultimaSaidaMin,
          previstoFormatado: minParaHorario(entrada.fimMin),
          marcadoFormatado: minParaHorario(ultimaSaidaMin),
          minutosHE: excedenteSaida,
          motivo: 'Permanência superior a 6h além da escala — provável esquecimento de registro',
        });
      } else if (excedenteSaida > limiteMinutos) {
        minutosSaida = excedenteSaida;
      }
    }

    // ── Decisão de Inclusão da Ocorrência conforme o Modo ──
    let temOcorrencia = false;
    let tipoHE = '';

    if (modoAnalise === 'entrada' && minutosEntrada > 0) {
      temOcorrencia = true;
      tipoHE = 'ENTRADA';
    } else if (modoAnalise === 'saida' && minutosSaida > 0) {
      temOcorrencia = true;
      tipoHE = 'SAÍDA';
    } else if (modoAnalise === 'geral' && (minutosEntrada > 0 || minutosSaida > 0)) {
      temOcorrencia = true;
      tipoHE = (minutosEntrada > 0 && minutosSaida > 0)
        ? 'ENTRADA + SAÍDA'
        : minutosEntrada > 0 ? 'ENTRADA' : 'SAÍDA';
    }

    if (temOcorrencia) {
      const totalMinutosDia = minutosEntrada + minutosSaida;
      ocorrencias.push({
        nome,
        matricula,
        data,
        setor,
        cargo,
        tipoHE,
        horarioPrevisto: entrada.horarioStr,
        inicioPrevistoMin: entrada.inicioMin,
        fimPrevistoMin: entrada.fimMin,
        primeiraEntradaMin,
        ultimaSaidaMin,
        primeiraEntrada: minParaHorario(primeiraEntradaMin),
        ultimaSaida: minParaHorario(ultimaSaidaMin),
        minutosEntrada,
        minutosSaida,
        totalMinutos: totalMinutosDia,
        // Compatibilidade com código anterior
        primeiraMarcacao: minParaHorario(primeiraEntradaMin),
        antecipacaoMin: modoAnalise === 'saida' ? minutosSaida : minutosEntrada,
      });
    }
  }

  // 4. Resumo Consolidado por Servidor
  const resumoMap = new Map();
  for (const oc of ocorrencias) {
    if (!resumoMap.has(oc.nome)) {
      const diasTotal = diasComMarcacaoPorServidor.get(oc.nome)?.size || 0;
      resumoMap.set(oc.nome, {
        nome: oc.nome,
        matricula: oc.matricula || matriculaPorServidor.get(oc.nome) || '',
        setor: oc.setor,
        cargo: oc.cargo,
        horarioPrevisto: oc.horarioPrevisto,
        diasComMarcacao: diasTotal,
        diasComHoraPositiva: 0, // Total de dias com ocorrência
        diasHEEntrada: 0,
        diasHESaida: 0,
        totalMinutosEntrada: 0,
        totalMinutosSaida: 0,
        totalMinutos: 0,
        maxMinutosEntrada: 0,
        maxMinutosSaida: 0,
        maxMinutos: 0,
        primeiraData: oc.data,
        ultimaData: oc.data,
        ocorrencias: [],
      });
    }

    const r = resumoMap.get(oc.nome);
    r.diasComHoraPositiva++;
    if (oc.minutosEntrada > 0) {
      r.diasHEEntrada++;
      r.totalMinutosEntrada += oc.minutosEntrada;
      r.maxMinutosEntrada = Math.max(r.maxMinutosEntrada, oc.minutosEntrada);
    }
    if (oc.minutosSaida > 0) {
      r.diasHESaida++;
      r.totalMinutosSaida += oc.minutosSaida;
      r.maxMinutosSaida = Math.max(r.maxMinutosSaida, oc.minutosSaida);
    }
    r.totalMinutos += oc.totalMinutos;
    r.maxMinutos = Math.max(r.maxMinutos, oc.totalMinutos);

    if (oc.data < r.primeiraData) r.primeiraData = oc.data;
    if (oc.data > r.ultimaData) r.ultimaData = oc.data;
    r.ocorrencias.push(oc);
  }

  const resumoPorServidor = [...resumoMap.values()]
    .map(r => {
      const pct = r.diasComMarcacao > 0 ? (r.diasComHoraPositiva / r.diasComMarcacao) : 0;
      return {
        ...r,
        pctDosDias: pct,
        mediaMinutos: +(r.totalMinutos / r.diasComHoraPositiva).toFixed(1),
      };
    })
    .sort((a, b) => b.diasComHoraPositiva - a.diasComHoraPositiva || b.totalMinutos - a.totalMinutos);

  ocorrencias.sort((a, b) => a.nome.localeCompare(b.nome) || a.data.localeCompare(b.data));
  semHorario.sort((a, b) => a.nome.localeCompare(b.nome) || a.data.localeCompare(b.data));
  extremos.sort((a, b) => a.nome.localeCompare(b.nome) || a.data.localeCompare(b.data));

  return {
    modoAnalise,
    ocorrencias,
    ocorrenciasEntrada: ocorrencias.filter(o => o.minutosEntrada > 0),
    ocorrenciasSaida: ocorrencias.filter(o => o.minutosSaida > 0),
    semHorario,
    extremos,
    resumoPorServidor,
    semCorrespondencia,
    totalMarcacoesAnalisadas: mapaDiaServidor.size,
    totalServidoresCSV: nomesCSV.size,
    totalServidoresXLSX: nomesXLSX.size,
    limiteMinutos,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Exportação XLSX — Formatada com padrão visual executivo
// ─────────────────────────────────────────────────────────────────────────────

const COR = {
  azulEscuro:   '1F3864', // Fundo dos cabeçalhos principais
  azulMedio:    '2E5090',
  branco:       'FFFFFF',
  cinzaZebra:   'F8FAFC',
  cinzaBorda:   'CBD5E1',
  cinzaTotais:  'F1F5F9',
  vermelhoFundo:'FEF2F2',
  vermelho:     'C0392B',
  laranjFundo:  'FFFBEB',
  laranja:      'D97706',
  amareloFundo: 'FEFCE8',
  amarelo:      '856404',
  cinzaTexto:   '475569',
  pretoCel:     '0F172A',
};

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
    alignment: { horizontal: opts.align || 'left', vertical: 'center', wrapText: false },
    border: bordaThin(COR.cinzaBorda),
    numFmt: opts.numFmt || 'General',
  };
}

function bordaThin(cor = COR.cinzaBorda) {
  const b = { style: 'thin', color: { rgb: cor } };
  return { left: b, right: b, top: b, bottom: b };
}

function criarSheetFormatada(dados, colsDef, estLinhaFn, corCabecalho) {
  const ws = XLSXStyle.utils.aoa_to_sheet(dados);
  const nCols = colsDef.length;
  const nRows = dados.length;

  ws['!cols'] = colsDef.map(c => ({ wch: c.w }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  ws['!autofilter'] = { ref: `A1:${XLSXStyle.utils.encode_col(nCols - 1)}1` };
  ws['!rows'] = Array.from({ length: nRows }, (_, i) => ({
    hpt: i === 0 ? 42 : 16,
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
        });
      }
    }
  }

  return ws;
}

export function exportarRelatorioXLSX(resultado) {
  const wb = XLSXStyle.utils.book_new();
  const modo = resultado.modoAnalise || 'entrada';

  if (modo === 'geral') {
    // ══════════════════════════════════════════════════════════════════════════
    // RELATÓRIO GERAL UNIFICADO (ENTRADA + SAÍDA)
    // ══════════════════════════════════════════════════════════════════════════

    // ── Aba 1: Resumo Geral ──
    const cabecalhoResumo = [
      'Servidor', 'Setor', 'Cargo', 'Dias c/ Marcação',
      'Dias HE Entrada', 'Dias HE Saída', 'Dias Totais HE', '% dos Dias',
      'Total HE Entrada (min)', 'Total HE Saída (min)', 'Total Geral HE (min)',
      'Total Geral (h:mm)', 'Média (min)', 'Maior HE Entrada (min)',
      'Maior HE Saída (min)', 'Primeira Data', 'Última Data'
    ];

    const linhasResumo = resultado.resumoPorServidor.map(r => [
      r.nome,
      r.setor,
      r.cargo,
      r.diasComMarcacao,
      r.diasHEEntrada,
      r.diasHESaida,
      r.diasComHoraPositiva,
      r.pctDosDias,
      r.totalMinutosEntrada,
      r.totalMinutosSaida,
      r.totalMinutos,
      minParaHrMm(r.totalMinutos),
      r.mediaMinutos,
      r.maxMinutosEntrada,
      r.maxMinutosSaida,
      r.primeiraData,
      r.ultimaData,
    ]);

    const totalServidores = resultado.resumoPorServidor.length;
    const totalDiasOcorrencias = resultado.ocorrencias.length;
    const totalMinutosGeral = resultado.resumoPorServidor.reduce((acc, r) => acc + r.totalMinutos, 0);

    const dadosResumoComTotais = [
      cabecalhoResumo,
      ...linhasResumo,
      [],
      ['Total de servidores com HE', '', '', '', '', '', totalServidores, '', '', '', totalMinutosGeral, minParaHrMm(totalMinutosGeral), '', '', '', '', ''],
      ['Total de ocorrências (dias)', '', '', '', '', '', totalDiasOcorrencias, '', '', '', '', '', '', '', '', '', ''],
    ];

    const colsResumo = [
      { w: 38, align: 'left' },
      { w: 36, align: 'left' },
      { w: 28, align: 'left' },
      { w: 15, align: 'right', numFmt: '#,##0' },
      { w: 15, align: 'right', numFmt: '#,##0' },
      { w: 15, align: 'right', numFmt: '#,##0' },
      { w: 15, align: 'right', numFmt: '#,##0' },
      { w: 12, align: 'right', numFmt: '0.0%' },
      { w: 18, align: 'right', numFmt: '#,##0' },
      { w: 18, align: 'right', numFmt: '#,##0' },
      { w: 18, align: 'right', numFmt: '#,##0' },
      { w: 16, align: 'center' },
      { w: 14, align: 'right', numFmt: '0.0' },
      { w: 18, align: 'right', numFmt: '#,##0' },
      { w: 18, align: 'right', numFmt: '#,##0' },
      { w: 13, align: 'center' },
      { w: 13, align: 'center' },
    ];

    const wsResumo = criarSheetFormatada(
      dadosResumoComTotais,
      colsResumo,
      (rowIdx, row, colIdx) => {
        if (rowIdx > linhasResumo.length + 1) {
          return { fill: COR.cinzaTotais, bold: true, fontColor: COR.pretoCel };
        }
        if (rowIdx === linhasResumo.length + 1) return { fill: null };
        const pct = typeof row[7] === 'number' ? row[7] : 0;
        if (pct >= 0.8 && (colIdx === 7 || colIdx === 6)) {
          return { fill: COR.vermelhoFundo, fontColor: COR.vermelho, bold: true };
        }
        return {};
      },
      COR.azulEscuro
    );
    wsResumo['!autofilter'] = { ref: `A1:Q${linhasResumo.length + 1}` };
    XLSXStyle.utils.book_append_sheet(wb, wsResumo, 'Resumo Geral');

    // ── Aba 2: Detalhe Geral (Todas as HEs) ──
    const cabecalhoDetalhe = [
      'Servidor', 'Setor', 'Data', 'Dia', 'Tipo de HE', 'Escala Prevista',
      'Entrada Prevista', '1ª Marcação', 'HE Entrada (min)',
      'Saída Prevista', 'Última Marcação', 'HE Saída (min)',
      'Total HE Dia (min)', 'Total HE Dia (h:mm)'
    ];

    const linhasDetalhe = resultado.ocorrencias.map(oc => [
      oc.nome,
      oc.setor,
      oc.data,
      diaDaSemana(oc.data).toLowerCase(),
      oc.tipoHE,
      oc.horarioPrevisto,
      oc.inicioPrevistoMin !== null ? `${oc.data} ${minParaHorario(oc.inicioPrevistoMin)}:00` : '—',
      oc.primeiraEntradaMin !== null ? `${oc.data} ${oc.primeiraEntrada}:00` : '—',
      oc.minutosEntrada > 0 ? oc.minutosEntrada : '',
      oc.fimPrevistoMin !== null ? `${oc.data} ${minParaHorario(oc.fimPrevistoMin)}:00` : '—',
      oc.ultimaSaidaMin !== null ? `${oc.data} ${oc.ultimaSaida}:00` : '—',
      oc.minutosSaida > 0 ? oc.minutosSaida : '',
      oc.totalMinutos,
      minParaHrMm(oc.totalMinutos),
    ]);

    const colsDetalhe = [
      { w: 38, align: 'left' },
      { w: 36, align: 'left' },
      { w: 13, align: 'center' },
      { w: 12, align: 'center' },
      { w: 16, align: 'center' },
      { w: 24, align: 'center' },
      { w: 20, align: 'center' },
      { w: 20, align: 'center' },
      { w: 16, align: 'right', numFmt: '#,##0' },
      { w: 20, align: 'center' },
      { w: 20, align: 'center' },
      { w: 16, align: 'right', numFmt: '#,##0' },
      { w: 16, align: 'right', numFmt: '#,##0' },
      { w: 16, align: 'center' },
    ];

    const wsDetalhe = criarSheetFormatada(
      [cabecalhoDetalhe, ...linhasDetalhe],
      colsDetalhe,
      (rowIdx, row, colIdx) => {
        const total = row[12];
        if (total >= 120 && (colIdx === 12 || colIdx === 4)) {
          return { fill: COR.vermelhoFundo, fontColor: COR.vermelho, bold: true };
        }
        if (total >= 61 && (colIdx === 12 || colIdx === 4)) {
          return { fill: COR.laranjFundo, fontColor: COR.laranja, bold: true };
        }
        return {};
      },
      COR.azulEscuro
    );
    XLSXStyle.utils.book_append_sheet(wb, wsDetalhe, 'Detalhe Geral');

    // ── Aba 3: Detalhe Entrada ──
    if (resultado.ocorrenciasEntrada.length > 0) {
      const cabEntrada = ['Servidor', 'Setor', 'Data', 'Dia', 'Escala Prevista', 'Entrada Prevista', '1ª Marcação', 'Minutos Antecipados', 'Antecipação (h:mm)'];
      const linEntrada = resultado.ocorrenciasEntrada.map(oc => [
        oc.nome,
        oc.setor,
        oc.data,
        diaDaSemana(oc.data).toLowerCase(),
        oc.horarioPrevisto,
        `${oc.data} ${minParaHorario(oc.inicioPrevistoMin)}:00`,
        `${oc.data} ${oc.primeiraEntrada}:00`,
        oc.minutosEntrada,
        minParaHrMm(oc.minutosEntrada),
      ]);
      const wsEntrada = criarSheetFormatada(
        [cabEntrada, ...linEntrada],
        [{ w: 38 }, { w: 36 }, { w: 13, align: 'center' }, { w: 12, align: 'center' }, { w: 24, align: 'center' }, { w: 20, align: 'center' }, { w: 20, align: 'center' }, { w: 18, align: 'right', numFmt: '#,##0' }, { w: 16, align: 'center' }],
        (r, row, c) => row[7] >= 120 && c === 7 ? { fill: COR.vermelhoFundo, fontColor: COR.vermelho, bold: true } : {},
        COR.azulMedio
      );
      XLSXStyle.utils.book_append_sheet(wb, wsEntrada, 'Detalhe Entrada');
    }

    // ── Aba 4: Detalhe Saída ──
    if (resultado.ocorrenciasSaida.length > 0) {
      const cabSaida = ['Servidor', 'Setor', 'Data', 'Dia', 'Escala Prevista', 'Saída Prevista', 'Última Marcação', 'Minutos Excedentes', 'Permanência (h:mm)'];
      const linSaida = resultado.ocorrenciasSaida.map(oc => [
        oc.nome,
        oc.setor,
        oc.data,
        diaDaSemana(oc.data).toLowerCase(),
        oc.horarioPrevisto,
        `${oc.data} ${minParaHorario(oc.fimPrevistoMin)}:00`,
        `${oc.data} ${oc.ultimaSaida}:00`,
        oc.minutosSaida,
        minParaHrMm(oc.minutosSaida),
      ]);
      const wsSaida = criarSheetFormatada(
        [cabSaida, ...linSaida],
        [{ w: 38 }, { w: 36 }, { w: 13, align: 'center' }, { w: 12, align: 'center' }, { w: 24, align: 'center' }, { w: 20, align: 'center' }, { w: 20, align: 'center' }, { w: 18, align: 'right', numFmt: '#,##0' }, { w: 16, align: 'center' }],
        (r, row, c) => row[7] >= 120 && c === 7 ? { fill: COR.vermelhoFundo, fontColor: COR.vermelho, bold: true } : {},
        '1E3A8A'
      );
      XLSXStyle.utils.book_append_sheet(wb, wsSaida, 'Detalhe Saída');
    }

    // ── Aba 5: Revisar - Extremos ──
    if (resultado.extremos.length > 0) {
      const cabExtremos = ['Servidor', 'Data', 'Tipo', 'Escala Prevista', 'Horário Previsto', 'Marcação Real', 'Minutos Atípicos', 'Observação'];
      const linExtremos = resultado.extremos.map(oc => [
        oc.nome,
        oc.data,
        oc.tipo,
        oc.horarioPrevisto,
        `${oc.data} ${oc.previstoFormatado}:00`,
        `${oc.data} ${oc.marcadoFormatado}:00`,
        oc.minutosHE,
        oc.motivo,
      ]);
      const wsExt = criarSheetFormatada(
        [cabExtremos, ...linExtremos],
        [{ w: 38 }, { w: 13, align: 'center' }, { w: 12, align: 'center' }, { w: 24, align: 'center' }, { w: 20, align: 'center' }, { w: 20, align: 'center' }, { w: 16, align: 'right', numFmt: '#,##0' }, { w: 46 }],
        () => ({ fill: COR.amareloFundo, fontColor: COR.amarelo, bold: false }),
        '856404'
      );
      XLSXStyle.utils.book_append_sheet(wb, wsExt, 'Revisar - extremos');
    }

    // ── Aba 6: Sem horário previsto ──
    if (resultado.semHorario.length > 0) {
      const cabSem = ['Servidor', 'Data', '1ª Entrada', 'Última Saída', 'Motivo'];
      const linSem = resultado.semHorario.map(s => [
        s.nome,
        s.data,
        s.primeiraMarcacao !== '--:--' ? `${s.data} ${s.primeiraMarcacao}:00` : '—',
        s.ultimaMarcacao !== '--:--' ? `${s.data} ${s.ultimaMarcacao}:00` : '—',
        s.motivo,
      ]);
      const wsSem = criarSheetFormatada(
        [cabSem, ...linSem],
        [{ w: 38 }, { w: 13, align: 'center' }, { w: 20, align: 'center' }, { w: 20, align: 'center' }, { w: 46 }],
        () => ({}),
        COR.cinzaTexto
      );
      XLSXStyle.utils.book_append_sheet(wb, wsSem, 'Sem horário previsto');
    }

    // ── Aba 7: Notas ──
    const notasAoa = [
      ['Critério', `Horas Extras e Horas Positivas com antecedência ou permanência > ${resultado.limiteMinutos} min`],
      ['Modo de Análise', 'Geral Unificado (Entrada e Saída)'],
      ['Limite (minutos)', resultado.limiteMinutos],
      ['Cruzamento dos arquivos', 'Pelo nome do servidor (matrícula do CSV e cartão do xlsx são numerações diferentes)'],
      ['Marcações analisadas', `${resultado.totalMarcacoesAnalisadas} pares servidor+dia`],
      ['HE Entrada', `Primeira marcação com mais de ${resultado.limiteMinutos} min antes do início previsto`],
      ['HE Saída', `Última marcação com mais de ${resultado.limiteMinutos} min após o término previsto`],
      ['Escalas noturnas', 'Para entrada a partir das 15h, marcações com mais de 6h de antecedência são ignoradas (saída do turno anterior)'],
      ['Aba Revisar - extremos', 'Antecipação ou permanência acima de 6h: fora da contagem'],
      ['Aba Sem horário previsto', 'Dias com marcação mas sem horário no xlsx (folga ou dia ausente): não entram na análise'],
      ['Limitação', 'Mede entrada e saída contra a escala. Não verifica abonos ou justificativas cadastradas'],
    ];

    const wsNotas = XLSXStyle.utils.aoa_to_sheet(notasAoa);
    wsNotas['!cols'] = [{ wch: 28 }, { wch: 80 }];
    wsNotas['!rows'] = notasAoa.map(() => ({ hpt: 20 }));
    for (let r = 0; r < notasAoa.length; r++) {
      const c1 = XLSXStyle.utils.encode_cell({ r, c: 0 });
      const c2 = XLSXStyle.utils.encode_cell({ r, c: 1 });
      if (wsNotas[c1]) {
        wsNotas[c1].s = {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: COR.pretoCel } },
          fill: { patternType: 'solid', fgColor: { rgb: COR.cinzaTotais } },
          border: bordaThin(),
          alignment: { horizontal: 'left', vertical: 'center' },
        };
      }
      if (wsNotas[c2]) {
        wsNotas[c2].s = {
          font: { name: 'Calibri', sz: 10, color: { rgb: COR.pretoCel } },
          border: bordaThin(),
          alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        };
      }
    }
    XLSXStyle.utils.book_append_sheet(wb, wsNotas, 'Notas');

    XLSXStyle.writeFile(wb, 'horas_positivas_geral.xlsx');

  } else {
    // ══════════════════════════════════════════════════════════════════════════
    // RELATÓRIO ESPECÍFICO (ENTRADA OU SAÍDA)
    // ══════════════════════════════════════════════════════════════════════════
    const isSaida = modo === 'saida';
    const labelTipo = isSaida ? 'Saída' : 'Entrada';
    const labelAcao = isSaida ? 'saída > limite' : 'entrada > limite';
    const labelMin = isSaida ? 'Média de minutos excedentes' : 'Média de minutos antecipados';
    const labelMax = isSaida ? 'Maior excedente (min)' : 'Maior antecipação (min)';
    const labelPrev = isSaida ? 'Saída prevista' : 'Entrada prevista';
    const labelMarc = isSaida ? 'Última marcação' : '1ª marcação';
    const labelMinCol = isSaida ? 'Minutos excedentes' : 'Minutos antecipados';

    // ── Aba 1: Resumo ──
    const cabecalhoResumo = [
      'Servidor', 'Setor', 'Cargo', 'Dias com marcação',
      `Dias com ${labelAcao}`, '% dos dias', labelMin,
      labelMax, 'Primeira data', 'Última data'
    ];

    const linhasResumo = resultado.resumoPorServidor.map(r => [
      r.nome,
      r.setor,
      r.cargo,
      r.diasComMarcacao,
      r.diasComHoraPositiva,
      r.pctDosDias,
      r.mediaMinutos,
      r.maxMinutos,
      r.primeiraData,
      r.ultimaData,
    ]);

    const totalServidores = resultado.resumoPorServidor.length;
    const totalDiasLimite = resultado.ocorrencias.length;

    const dadosResumoComTotais = [
      cabecalhoResumo,
      ...linhasResumo,
      [],
      [`Total de servidores com HE na ${labelTipo}`, '', '', '', totalServidores, '', '', '', '', ''],
      [`Total de dias com ${labelAcao}`, '', '', '', totalDiasLimite, '', '', '', '', ''],
    ];

    const colsResumo = [
      { w: 38, align: 'left' },
      { w: 36, align: 'left' },
      { w: 28, align: 'left' },
      { w: 16, align: 'right', numFmt: '#,##0' },
      { w: 18, align: 'right', numFmt: '#,##0' },
      { w: 12, align: 'right', numFmt: '0.0%' },
      { w: 18, align: 'right', numFmt: '0.0' },
      { w: 16, align: 'right', numFmt: '#,##0' },
      { w: 13, align: 'center' },
      { w: 13, align: 'center' },
    ];

    const wsResumo = criarSheetFormatada(
      dadosResumoComTotais,
      colsResumo,
      (rowIdx, row, colIdx) => {
        if (rowIdx > linhasResumo.length + 1) {
          return { fill: COR.cinzaTotais, bold: true, fontColor: COR.pretoCel };
        }
        if (rowIdx === linhasResumo.length + 1) return { fill: null };
        const pct = typeof row[5] === 'number' ? row[5] : 0;
        if (pct >= 0.8 && (colIdx === 5 || colIdx === 4)) {
          return { fill: COR.vermelhoFundo, fontColor: COR.vermelho, bold: true };
        }
        return {};
      },
      COR.azulEscuro
    );
    wsResumo['!autofilter'] = { ref: `A1:J${linhasResumo.length + 1}` };
    XLSXStyle.utils.book_append_sheet(wb, wsResumo, 'Resumo');

    // ── Aba 2: Detalhe ──
    const cabecalhoDetalhe = [
      'Servidor', 'Setor', 'Data', 'Dia', 'Escala prevista',
      labelPrev, labelMarc, labelMinCol
    ];

    const linhasDetalhe = resultado.ocorrencias.map(oc => [
      oc.nome,
      oc.setor,
      oc.data,
      diaDaSemana(oc.data).toLowerCase(),
      oc.horarioPrevisto,
      isSaida
        ? `${oc.data} ${minParaHorario(oc.fimPrevistoMin)}:00`
        : `${oc.data} ${minParaHorario(oc.inicioPrevistoMin)}:00`,
      isSaida
        ? `${oc.data} ${oc.ultimaSaida}:00`
        : `${oc.data} ${oc.primeiraEntrada}:00`,
      isSaida ? oc.minutosSaida : oc.minutosEntrada,
    ]);

    const colsDetalhe = [
      { w: 38, align: 'left' },
      { w: 36, align: 'left' },
      { w: 13, align: 'center' },
      { w: 12, align: 'center' },
      { w: 24, align: 'center' },
      { w: 20, align: 'center' },
      { w: 20, align: 'center' },
      { w: 16, align: 'right', numFmt: '#,##0' },
    ];

    const wsDetalhe = criarSheetFormatada(
      [cabecalhoDetalhe, ...linhasDetalhe],
      colsDetalhe,
      (rowIdx, row, colIdx) => {
        const min = row[7];
        if (min >= 120 && colIdx === 7) {
          return { fill: COR.vermelhoFundo, fontColor: COR.vermelho, bold: true };
        }
        if (min >= 61 && colIdx === 7) {
          return { fill: COR.laranjFundo, fontColor: COR.laranja, bold: true };
        }
        return {};
      },
      COR.azulEscuro
    );
    XLSXStyle.utils.book_append_sheet(wb, wsDetalhe, 'Detalhe');

    // ── Aba 3: Revisar - extremos ──
    if (resultado.extremos.length > 0) {
      const cabecalhoExtremos = [
        'Servidor', 'Data', 'Escala prevista', labelPrev,
        labelMarc, labelMinCol, 'Observação'
      ];
      const linhasExtremos = resultado.extremos.map(oc => [
        oc.nome,
        oc.data,
        oc.horarioPrevisto,
        `${oc.data} ${oc.previstoFormatado}:00`,
        `${oc.data} ${oc.marcadoFormatado}:00`,
        oc.minutosHE,
        oc.motivo,
      ]);

      const colsExtremos = [
        { w: 38, align: 'left' },
        { w: 13, align: 'center' },
        { w: 24, align: 'center' },
        { w: 20, align: 'center' },
        { w: 20, align: 'center' },
        { w: 16, align: 'right', numFmt: '#,##0' },
        { w: 42, align: 'left' },
      ];

      const wsExtremos = criarSheetFormatada(
        [cabecalhoExtremos, ...linhasExtremos],
        colsExtremos,
        () => ({ fill: COR.amareloFundo, fontColor: COR.amarelo, bold: false }),
        '856404'
      );
      XLSXStyle.utils.book_append_sheet(wb, wsExtremos, 'Revisar - extremos');
    }

    // ── Aba 4: Sem horário previsto ──
    if (resultado.semHorario.length > 0) {
      const cabecalhoSem = ['Servidor', 'Data', labelMarc, 'Motivo'];
      const linhasSem = resultado.semHorario.map(s => [
        s.nome,
        s.data,
        isSaida ? (s.ultimaMarcacao !== '--:--' ? `${s.data} ${s.ultimaMarcacao}:00` : '—') : `${s.data} ${s.primeiraMarcacao}:00`,
        s.motivo,
      ]);

      const colsSem = [
        { w: 38, align: 'left' },
        { w: 13, align: 'center' },
        { w: 20, align: 'center' },
        { w: 46, align: 'left' },
      ];

      const wsSem = criarSheetFormatada(
        [cabecalhoSem, ...linhasSem],
        colsSem,
        () => ({}),
        COR.cinzaTexto
      );
      XLSXStyle.utils.book_append_sheet(wb, wsSem, 'Sem horário previsto');
    }

    // ── Aba 5: Notas ──
    const notasAoa = [
      ['Critério', `Marcação de ${labelTipo.toLowerCase()} mais de ${resultado.limiteMinutos} min além do horário da escala prevista`],
      ['Modo de Análise', `Apenas ${labelTipo}`],
      ['Limite (minutos)', resultado.limiteMinutos],
      ['Cruzamento dos arquivos', 'Pelo nome do servidor (matrícula do CSV e cartão do xlsx são numerações diferentes)'],
      ['Marcações analisadas', `${resultado.totalMarcacoesAnalisadas} pares servidor+dia`],
      ['Aba Revisar - extremos', `Divergência de ${labelTipo.toLowerCase()} acima de 6h: fora da contagem`],
      ['Aba Sem horário previsto', 'Dias com marcação mas sem horário no xlsx (folga ou dia ausente): não entram na análise'],
      ['Limitação', `Mede só a ${labelTipo.toLowerCase()}. Não verifica abonos ou justificativas cadastradas`],
    ];

    const wsNotas = XLSXStyle.utils.aoa_to_sheet(notasAoa);
    wsNotas['!cols'] = [{ wch: 28 }, { wch: 80 }];
    wsNotas['!rows'] = notasAoa.map(() => ({ hpt: 20 }));

    for (let r = 0; r < notasAoa.length; r++) {
      const c1 = XLSXStyle.utils.encode_cell({ r, c: 0 });
      const c2 = XLSXStyle.utils.encode_cell({ r, c: 1 });
      if (wsNotas[c1]) {
        wsNotas[c1].s = {
          font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: COR.pretoCel } },
          fill: { patternType: 'solid', fgColor: { rgb: COR.cinzaTotais } },
          border: bordaThin(),
          alignment: { horizontal: 'left', vertical: 'center' },
        };
      }
      if (wsNotas[c2]) {
        wsNotas[c2].s = {
          font: { name: 'Calibri', sz: 10, color: { rgb: COR.pretoCel } },
          border: bordaThin(),
          alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        };
      }
    }

    XLSXStyle.utils.book_append_sheet(wb, wsNotas, 'Notas');

    const nomeArquivo = isSaida ? 'horas_positivas_saida.xlsx' : 'horas_positivas_entrada.xlsx';
    XLSXStyle.writeFile(wb, nomeArquivo);
  }
}

/** "YYYY-MM-DD" → nome do dia da semana em português */
export function diaDaSemana(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dias = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  return dias[new Date(y, m - 1, d).getDay()];
}

export { exportarRelatorioDOCX } from './exportarRelatorioDOCX';

