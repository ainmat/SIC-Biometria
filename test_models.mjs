import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const envStr = fs.readFileSync(path.resolve('.env'), 'utf-8');
let apiKey = '';
envStr.split('\n').forEach(line => {
  if (line.startsWith('VITE_GEMINI_API_KEY=')) {
    apiKey = line.split('=')[1].trim();
  }
});

const ai = new GoogleGenAI({ apiKey });

async function testModel(modelName) {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: "hello",
    });
    console.log(`[SUCCESS] ${modelName} works.`);
  } catch (error) {
    console.log(`[ERROR] ${modelName}:`, error.message);
  }
}

async function run() {
  await testModel('gemini-1.5-flash');
  await testModel('gemini-1.5-flash-latest');
  await testModel('gemini-1.5-flash-001');
  await testModel('gemini-1.5-flash-002');
  await testModel('gemini-1.5-pro');
  await testModel('gemini-2.5-flash');
}
run();
