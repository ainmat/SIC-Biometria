import * as XLSX from 'xlsx';
import { supabase } from './supabase';
import { GoogleGenAI } from '@google/genai';

// Instancia o cliente do Gemini
// A chave deve estar no arquivo .env (VITE_GEMINI_API_KEY)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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
        description: "Nome do equipamento, escola ou unidade ou 'NÃO IDENTIFICADO'"
      },
      motivo: {
        type: "STRING",
        description: "Categoria em CAIXA ALTA (ex: EQUIPAMENTO, CADASTRO, SISTEMA, SUPORTE, MANUTENÇÃO)"
      }
    },
    required: ["secretaria", "unidade", "motivo"]
  }
};

const SYSTEM_INSTRUCTION = `Você é um assistente encarregado de classificar chamados técnicos em lote.
Analise a lista de chamados fornecida (onde cada um possui um ID interno da requisição, TÍTULO e DESCRIÇÃO).
Para cada chamado, extraia os campos secretaria, unidade e motivo.

Retorne uma lista em JSON estrito contendo um objeto para cada chamado analisado, exatamente na mesma ordem em que foram enviados.
A matriz JSON deve conter objetos com o formato:
{
  "secretaria": "Nome da Secretaria ou 'NÃO IDENTIFICADO'",
  "unidade": "Nome do equipamento, escola ou unidade ou 'NÃO IDENTIFICADO'",
  "motivo": "Categoria estrita. Escolha EXATAMENTE UMA destas quatro: EQUIPAMENTO, RECONHECIMENTO, ESPELHO DE PONTO, CADASTRO. Nenhuma outra é permitida."
}`;

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
 * Faz a chamada para a LLM (Gemini) para classificar um lote de chamados
 * @param {Array<{titulo: string, descricao: string}>} chamadosLote 
 */
async function classificarLoteLLM(chamadosLote, contextoEquipamentos = "") {
  if (!ai) {
    throw new Error('Chave VITE_GEMINI_API_KEY não configurada no arquivo .env');
  }

  const prompt = chamadosLote.map((c, idx) => 
    `Chamado ${idx + 1}\nTítulo: ${c.titulo}\nDescrição: ${c.descricao}`
  ).join('\n\n---\n\n');

  let instrucao = SYSTEM_INSTRUCTION;
  if (contextoEquipamentos) {
    instrucao += `\n\nATENÇÃO: Utilize a lista de equipamentos/unidades abaixo como um dicionário de referência. Se a descrição do chamado citar algum nome (ex: "Jóse Ibrahim", "EMEF...", etc) que seja parecido ou corresponda a um equipamento desta lista, você DEVE extrair a UNIDADE e a SECRETARIA exatas que constam na lista.\n\nA Secretaria definida na lista tem prioridade absoluta sobre o que foi digitado no chamado (exemplo: se o usuário digitou "SE" na descrição, mas na lista oficial consta "SED", você deve retornar "SED").\n\nREGRA DE NORMALIZAÇÃO DE UNIDADE: O nome da unidade DEVE refletir apenas o local físico, agrupado em CAIXA ALTA, sem os prefixos/sufixos de equipamento. Remova palavras como "FACE", numerações iniciais ou finais (ex: "1", "2", "3"), ou locais específicos ("Térreo", "Corredor"). Exemplo 1: De "1471 FACE PRONTO SOCORRO JOSE IBRAHIM 1" você DEVE retornar apenas "PRONTO SOCORRO JOSE IBRAHIM". Exemplo 2: De "FACE UBS PORTAL 2" retorne apenas "UBS PORTAL". Isso é vital para não duplicar unidades no Dashboard.\n\nLista de Referência (Equipamento - Secretaria):\n${contextoEquipamentos}`;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: prompt,
      config: {
        systemInstruction: instrucao,
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });

    let resultText = typeof response.text === 'function' ? response.text() : response.text;
    
    // Limpa possível marcação markdown do json
    resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();

    const json = JSON.parse(resultText);
    
    // Garante que retorne um array do mesmo tamanho
    return Array.isArray(json) && json.length === chamadosLote.length 
      ? json 
      : chamadosLote.map(() => ({ secretaria: 'FALHA DE TAMANHO/TIPO', unidade: 'NÃO IDENTIFICADO', motivo: 'NÃO IDENTIFICADO' }));
  } catch (error) {
    console.error('Erro ao classificar lote com LLM:', error);
    const errorMsg = error.message ? error.message.substring(0, 60) : 'Erro desconhecido';
    // Retorna a mensagem de erro na secretaria para depuração visual
    return chamadosLote.map(() => ({
      secretaria: 'ERRO: ' + errorMsg,
      unidade: 'ERRO',
      motivo: 'ERRO'
    }));
  }
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

  // Buscar lista de equipamentos para contextualizar a IA
  let contextoEquipamentos = "";
  try {
    const { data: eqData } = await supabase.from('equipamentos').select('nome, secretaria');
    if (eqData && eqData.length > 0) {
      contextoEquipamentos = eqData.map(eq => `${eq.nome} - Secretaria: ${eq.secretaria}`).join('\n');
    }
  } catch (err) {
    console.error('Falha ao buscar equipamentos para contexto:', err);
  }

  const LOTE_SIZE = 20;
  
  for (let i = 0; i < validRows.length; i += LOTE_SIZE) {
    const lote = validRows.slice(i, i + LOTE_SIZE);
    
    // Preparar dados para LLM
    const loteLLM = lote.map(item => ({
      titulo: item.row['TITULO'] || item.row['TÍTULO'] || '',
      descricao: item.row['DESCRIÇÃO'] || item.row['DESCRICAO'] || ''
    }));

    // Classificação em lote
    const classificacoes = await classificarLoteLLM(loteLLM, contextoEquipamentos);

    for (let j = 0; j < lote.length; j++) {
      const item = lote[j];
      const { row, ticket } = item;
      const classif = classificacoes[j] || { secretaria: 'NÃO IDENTIFICADO', unidade: 'NÃO IDENTIFICADO', motivo: 'NÃO IDENTIFICADO' };

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
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }

  // Realiza o Upsert no Supabase em lotes para não sobrecarregar
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
