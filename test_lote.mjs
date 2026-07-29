import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

// Parse simple .env
const envStr = fs.readFileSync(path.resolve('.env'), 'utf-8');
let apiKey = '';
envStr.split('\n').forEach(line => {
  if (line.startsWith('VITE_GEMINI_API_KEY=')) {
    apiKey = line.split('=')[1].trim();
  }
});

const ai = new GoogleGenAI({ apiKey });

const schema = {
  type: "ARRAY",
  description: "Lista de classificações na mesma ordem dos chamados fornecidos",
  items: {
    type: "OBJECT",
    properties: {
      secretaria: { type: "STRING" },
      unidade: { type: "STRING" },
      motivo: { type: "STRING" }
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
  "motivo": "Categoria em CAIXA ALTA (ex: EQUIPAMENTO, CADASTRO, SISTEMA, SUPORTE, MANUTENÇÃO)"
}`;

async function test() {
  const chamadosLote = [
    { titulo: "Problema no PC", descricao: "O PC da secretaria de educacao nao liga" }
  ];
  const prompt = chamadosLote.map((c, idx) => 
    `Chamado ${idx + 1}\nTítulo: ${c.titulo}\nDescrição: ${c.descricao}`
  ).join('\n\n---\n\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });
    console.log(response.text);
  } catch (error) {
    console.log("API ERROR:");
    console.log(error);
  }
}

test();
