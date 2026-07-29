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

if (!apiKey) {
  console.log('API KEY não encontrada no .env local');
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const schema = {
  type: "OBJECT",
  properties: {
    secretaria: { type: "STRING" },
    unidade: { type: "STRING" },
    motivo: { type: "STRING" }
  }
};

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-1.5-pro',
      contents: "Título: Problema\nDescrição: PC não liga",
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      }
    });
    console.log('SUCCESS!');
    console.log('response.text exists?', !!response.text);
    console.log('is function?', typeof response.text === 'function');
    console.log('value:', typeof response.text === 'function' ? response.text() : response.text);
  } catch (error) {
    console.log('API ERROR CAUGHT:');
    console.error(error);
  }
}

test();
