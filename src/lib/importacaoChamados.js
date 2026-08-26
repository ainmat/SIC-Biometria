import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { GoogleGenAI } from '@google/genai';

let cachedAiClient = null;

async function getAiClient() {
  if (cachedAiClient) return cachedAiClient;
  
  // Tenta pegar do .env primeiro (desenvolvimento local)
  let apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  // Se não tiver no .env, busca no Supabase
  if (!apiKey) {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', 'gemini_api_key')
        .single();
        
      if (!error && data && data.valor) {
        apiKey = data.valor;
      }
    } catch (e) {
      console.warn('Aviso: falha ao buscar chave no banco de dados', e);
    }
  }

  if (!apiKey) {
    throw new Error('A chave de IA não foi encontrada no banco ou no .env.');
  }

  cachedAiClient = new GoogleGenAI({ apiKey });
  return cachedAiClient;
}

const CANDIDATE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest'
];

// Esquema JSON esperado pela LLM (Structured Outputs)
const schema = {
  type: "ARRAY",
  description: "Lista de classificações na mesma ordem dos chamados fornecidos",
  items: {
    type: "OBJECT",
    properties: {
      secretaria: {
        type: "STRING",
        description: "Nome da Secretaria ou 'NÃO IDENTIFICADO'"
      },
      unidade: {
        type: "STRING",
        description: "Nome do local físico/unidade ou 'NÃO IDENTIFICADO'"
      },
      motivo: {
        type: "STRING",
        description: "Categoria em CAIXA ALTA (EQUIPAMENTO, RECONHECIMENTO, ESPELHO DE PONTO, CADASTRO)"
      }
    },
    required: ["secretaria", "unidade", "motivo"]
  }
};

const SYSTEM_INSTRUCTION = `Você é um assistente especialista em triagem técnica de chamados da Prefeitura de Osasco.
Analise a lista de chamados fornecida (onde cada um possui um ID interno da requisição, TÍTULO e DESCRIÇÃO).
Para cada chamado, extraia os campos secretaria, unidade e motivo.

ATENÇÃO: Se a secretaria ou unidade não puderem ser identificadas (ficariam como 'NÃO IDENTIFICADO'), E o problema relatado for referente a falhas no sistema/software central (ex: erros de acesso geral, falhas no espelho de ponto central), você DEVE preencher a secretaria e/ou unidade como 'ADVANCIS' em vez de 'NÃO IDENTIFICADO'.

Retorne uma lista em JSON estrito contendo um objeto para cada chamado analisado, exatamente na mesma ordem em que foram enviados:
{
  "secretaria": "Nome/Sigla da Secretaria, 'ADVANCIS' ou 'NÃO IDENTIFICADO'",
  "unidade": "Nome da unidade sem numerações e prefixos, 'ADVANCIS' ou 'NÃO IDENTIFICADO'",
  "motivo": "Categoria estrita. Escolha EXATAMENTE UMA destas quatro: EQUIPAMENTO, RECONHECIMENTO, ESPELHO DE PONTO, CADASTRO."
}`;

/**
 * Fallback heurístico caso a API do Gemini esteja temporariamente indisponível
 */
function extrairFallbackHeuristico(chamado, equipamentosLista = []) {
  const textoCompleto = `${chamado.titulo || ''} ${chamado.descricao || ''}`.toUpperCase();
  
  let secretaria = 'NÃO IDENTIFICADO';
  let unidade = 'NÃO IDENTIFICADO';
  let motivo = 'EQUIPAMENTO';

  // 1. Siglas de Secretarias
  const secretariasConhecidas = [
    'SED', 'SAUDE', 'SS', 'SEMAP', 'SEINFRA', 'SECOL', 'SJDH', 'SECONT', 'SEHAB', 'SEF',
    'SERH', 'SETIC', 'SEGOV', 'SECOM', 'SECULT', 'FITO', 'CMO', 'IPMO', 'ADVANCIS'
  ];
  for (const sec of secretariasConhecidas) {
    const regex = new RegExp(`\\b${sec}\\b`, 'i');
    if (regex.test(textoCompleto)) {
      secretaria = sec === 'SAUDE' ? 'SS' : sec;
      break;
    }
  }

  // 2. Unidades pelo dicionário
  for (const eq of equipamentosLista) {
    if (eq.nome && eq.nome.length > 4) {
      const nomeLimpo = eq.nome
        .replace(/^\d+\s+/, '')
        .replace(/^FACE\s+/i, '')
        .replace(/\s+\d+$/, '')
        .trim();
      
      if (nomeLimpo.length > 4 && textoCompleto.includes(nomeLimpo.toUpperCase())) {
        unidade = nomeLimpo.toUpperCase();
        if (eq.secretaria && secretaria === 'NÃO IDENTIFICADO') {
          secretaria = eq.secretaria.toUpperCase();
        }
        break;
      }
    }
  }

  if (textoCompleto.includes('ADVANCIS')) {
    if (secretaria === 'NÃO IDENTIFICADO') secretaria = 'ADVANCIS';
    if (unidade === 'NÃO IDENTIFICADO') unidade = 'ADVANCIS';
  }

  // 3. Determinar motivo
  if (textoCompleto.includes('ESPELHO') || textoCompleto.includes('MARCAÇÃO') || textoCompleto.includes('MARCACAO') || textoCompleto.includes('NÃO SUBIU') || textoCompleto.includes('NAO SUBIU') || textoCompleto.includes('BATIDA')) {
    motivo = 'ESPELHO DE PONTO';
  } else if (textoCompleto.includes('RECONHECE') || textoCompleto.includes('ROSTO') || textoCompleto.includes('FACIAL') || textoCompleto.includes('BIOMETRIA') || textoCompleto.includes('DIGITAL')) {
    motivo = 'RECONHECIMENTO';
  } else if (textoCompleto.includes('CADASTRO') || textoCompleto.includes('CADASTRAR') || textoCompleto.includes('INCLUSÃO') || textoCompleto.includes('INCLUSAO') || textoCompleto.includes('TRANSFERENCIA') || textoCompleto.includes('TRANSFERÊNCIA')) {
    motivo = 'CADASTRO';
  } else {
    motivo = 'EQUIPAMENTO';
  }

  return { secretaria, unidade, motivo };
}

/**
 * Lê o arquivo e retorna as linhas como objetos JSON
 */
export async function lerArquivoPlanilha(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(jsonData);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Faz a chamada para a LLM com tentativas em múltiplos modelos e fallback inteligente
 * @param {Array<{titulo: string, descricao: string}>} chamadosLote 
 */
async function classificarLoteLLM(chamadosLote, contextoEquipamentos = "", equipamentosLista = []) {
  let ai;
  try {
    ai = await getAiClient();
  } catch (err) {
    console.warn('Cliente de IA indisponível, usando fallback heurístico:', err);
    return chamadosLote.map(c => extrairFallbackHeuristico(c, equipamentosLista));
  }

  const prompt = chamadosLote.map((c, idx) => 
    `Chamado ${idx + 1}\nTítulo: ${c.titulo}\nDescrição: ${c.descricao}`
  ).join('\n\n---\n\n');

  let instrucao = SYSTEM_INSTRUCTION;
  if (contextoEquipamentos) {
    instrucao += `\n\nATENÇÃO: Utilize a lista de equipamentos/unidades abaixo como um dicionário de referência. Se a descrição do chamado citar algum nome (ex: "Jóse Ibrahim", "EMEF...", etc) que seja parecido ou corresponda a um equipamento desta lista, você DEVE extrair a UNIDADE e a SECRETARIA exatas que constam na lista.\n\nA Secretaria definida na lista tem prioridade absoluta sobre o que foi digitado no chamado (exemplo: se o usuário digitou "SE" na descrição, mas na lista oficial consta "SED", você deve retornar "SED").\n\nREGRA DE NORMALIZAÇÃO DE UNIDADE: O nome da unidade DEVE refletir apenas o local físico, agrupado em CAIXA ALTA, sem os prefixos/sufixos de equipamento. Remova palavras como "FACE", numerações iniciais ou finais (ex: "1", "2", "3"), ou locais específicos ("Térreo", "Corredor"). Exemplo 1: De "1471 FACE PRONTO SOCORRO JOSE IBRAHIM 1" você DEVE retornar apenas "PRONTO SOCORRO JOSE IBRAHIM". Exemplo 2: De "FACE UBS PORTAL 2" retorne apenas "UBS PORTAL". Isso é vital para não duplicar unidades no Dashboard.\n\nLista de Referência (Equipamento - Secretaria):\n${contextoEquipamentos}`;
  }

  // Tenta modelos com retries
  for (const model of CANDIDATE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            systemInstruction: instrucao,
            responseMimeType: 'application/json',
            responseSchema: schema,
          }
        });

        let resultText = typeof response.text === 'function' ? response.text() : response.text;
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
        const json = JSON.parse(resultText);

        if (Array.isArray(json) && json.length === chamadosLote.length) {
          return json.map((item) => {
            let sec = (item.secretaria || 'NÃO IDENTIFICADO').toUpperCase().trim();
            let uni = (item.unidade || 'NÃO IDENTIFICADO').toUpperCase().trim();
            let mot = (item.motivo || 'EQUIPAMENTO').toUpperCase().trim();

            const MOTIVOS_VALIDOS = ['EQUIPAMENTO', 'ESPELHO DE PONTO', 'RECONHECIMENTO', 'CADASTRO'];
            if (!MOTIVOS_VALIDOS.includes(mot)) {
              if (mot.includes('PONTO') || mot.includes('ESPELHO')) mot = 'ESPELHO DE PONTO';
              else if (mot.includes('RECONHECIMENTO') || mot.includes('FACIAL')) mot = 'RECONHECIMENTO';
              else if (mot.includes('CADASTRO') || mot.includes('DIGITAL')) mot = 'CADASTRO';
              else mot = 'EQUIPAMENTO';
            }

            return {
              secretaria: sec,
              unidade: uni,
              motivo: mot
            };
          });
        }
      } catch (err) {
        console.warn(`[Classificação IA] Falha no modelo ${model} (tentativa ${attempt}):`, err?.message || err);
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
        }
      }
    }
  }

  // Se todos os modelos falharem temporariamente, usa o fallback heurístico
  console.warn('[Classificação IA] Modelos de IA ocupados ou offline. Utilizando fallback heurístico.');
  return chamadosLote.map(c => extrairFallbackHeuristico(c, equipamentosLista));
}

/**
 * Processa a lista de chamados, envia para LLM, e salva no Supabase
 * Recebe callback de progresso (opcional)
 */
export async function processarEImportarChamados(linhas, onProgress) {
  const chamadosParaInserir = [];
  const validRows = [];
  
  // Primeiro, processamos e filtramos as linhas válidas
  for (let i = 0; i < linhas.length; i++) {
    const row = linhas[i];
    if (!row['CÓDIGO'] && !row['CÓDIGO ']) continue;
    const codigoStr = String(row['CÓDIGO'] || row['CÓDIGO '] || '').replace(/\D/g, '');
    const ticket = parseInt(codigoStr, 10);
    if (isNaN(ticket)) continue;
    validRows.push({ row, ticket, indexOriginal: i });
  }

  // Buscar lista de equipamentos para contextualizar a IA e o fallback
  let contextoEquipamentos = "";
  let equipamentosLista = [];
  try {
    const { data: eqData } = await supabase.from('equipamentos').select('nome, secretaria');
    if (eqData && eqData.length > 0) {
      equipamentosLista = eqData;
      contextoEquipamentos = eqData.map(eq => `${eq.nome} - Secretaria: ${eq.secretaria}`).join('\n');
    }
  } catch (err) {
    console.error('Falha ao buscar equipamentos para contexto:', err);
  }

  const LOTE_SIZE = 15;
  
  for (let i = 0; i < validRows.length; i += LOTE_SIZE) {
    const lote = validRows.slice(i, i + LOTE_SIZE);
    
    // Preparar dados para LLM
    const loteLLM = lote.map(item => ({
      titulo: item.row['TITULO'] || item.row['TÍTULO'] || '',
      descricao: item.row['DESCRIÇÃO'] || item.row['DESCRICAO'] || ''
    }));

    // Classificação em lote com retry e fallback
    const classificacoes = await classificarLoteLLM(loteLLM, contextoEquipamentos, equipamentosLista);

    for (let j = 0; j < lote.length; j++) {
      const item = lote[j];
      const { row, ticket } = item;
      const classif = classificacoes[j] || { secretaria: 'NÃO IDENTIFICADO', unidade: 'NÃO IDENTIFICADO', motivo: 'EQUIPAMENTO' };

      // Extrair data
      let dataAberturaRaw = row['DATA ABERTURA'] || row['DATA DE CADASTRO'] || null;
      let data_abertura = null;
      if (dataAberturaRaw) {
        if (typeof dataAberturaRaw === 'number') {
           const date = XLSX.SSF.parse_date_code(dataAberturaRaw);
           data_abertura = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        } else if (typeof dataAberturaRaw === 'string') {
            const ddMMyyyy = dataAberturaRaw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
            if (ddMMyyyy) {
               data_abertura = `${ddMMyyyy[3]}-${ddMMyyyy[2].padStart(2, '0')}-${ddMMyyyy[1].padStart(2, '0')}`;
            } else {
               const yyyyMMdd = dataAberturaRaw.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
               if (yyyyMMdd) {
                   data_abertura = `${yyyyMMdd[1]}-${yyyyMMdd[2].padStart(2, '0')}-${yyyyMMdd[3].padStart(2, '0')}`;
               }
            }
        }
      }

      chamadosParaInserir.push({
        ticket,
        data_abertura,
        secretaria: classif.secretaria,
        unidade: classif.unidade,
        problema: item.row['DESCRIÇÃO'] || item.row['DESCRICAO'] || '',
        motivo: classif.motivo,
        status: row['STATUS'] || 'Aguardando Atendimento'
      });
    }

    if (onProgress) {
      onProgress(Math.min(i + LOTE_SIZE, validRows.length), validRows.length);
    }

    if (i + LOTE_SIZE < validRows.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Realiza o Upsert no Supabase em lotes
  const BATCH_SIZE = 50;
  let successCount = 0;

  for (let i = 0; i < chamadosParaInserir.length; i += BATCH_SIZE) {
    const batch = chamadosParaInserir.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('chamados')
      .upsert(batch, { onConflict: 'ticket' });
      
    if (error) {
      console.error('Erro no upsert:', error);
      throw error;
    }
    successCount += batch.length;
  }

  return successCount;
}
