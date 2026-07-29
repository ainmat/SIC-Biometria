import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const envStr = fs.readFileSync(path.resolve('.env'), 'utf-8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...rest] = line.split('=');
  if (key && rest.length) env[key.trim()] = rest.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const ai = new GoogleGenAI({ apiKey: env.VITE_GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `Você é um assistente encarregado de classificar chamados técnicos em lote.
Para cada chamado, extraia secretaria, unidade e motivo.

IMPORTANTE:
Retorne uma LISTA de objetos JSON. Cada objeto DEVE conter o número do TICKET recebido.
Exemplo:
[
  {
    "ticket": "5034",
    "secretaria": "Nome da Secretaria ou 'NÃO IDENTIFICADO'",
    "unidade": "Nome da unidade sem numerações e prefixos ou 'NÃO IDENTIFICADO'",
    "motivo": "Categoria estrita. Escolha EXATAMENTE UMA destas quatro: EQUIPAMENTO, RECONHECIMENTO, ESPELHO DE PONTO, CADASTRO. Nenhuma outra é permitida."
  }
]`;

const schema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      ticket: { type: "STRING" },
      secretaria: { type: "STRING" },
      unidade: { type: "STRING" },
      motivo: { type: "STRING" }
    },
    required: ["ticket", "secretaria", "unidade", "motivo"]
  }
};

async function run() {
  console.log('🔄 Iniciando reclassificação em massa do banco de dados...');
  const { data: eqData } = await supabase.from('equipamentos').select('nome, secretaria');
  let contextoEquipamentos = '';
  if (eqData) {
    contextoEquipamentos = eqData.map(eq => `${eq.nome} - Secretaria: ${eq.secretaria}`).join('\n');
  }

  let instrucao = SYSTEM_INSTRUCTION;
  if (contextoEquipamentos) {
    instrucao += `\n\nATENÇÃO: Utilize a lista de equipamentos/unidades abaixo como um dicionário de referência. Se a descrição citar algum nome correspondente a um equipamento desta lista, extraia a UNIDADE e a SECRETARIA exatas que constam na lista.\n\nA Secretaria definida na lista tem prioridade absoluta.\n\nREGRA DE NORMALIZAÇÃO DE UNIDADE: O nome da unidade DEVE refletir apenas o local físico, agrupado em CAIXA ALTA, sem os prefixos/sufixos de equipamento. Remova palavras como "FACE", numerações iniciais ou finais (ex: "1", "2", "3"), ou locais específicos ("Térreo", "Corredor"). Exemplo 1: De "1471 FACE PRONTO SOCORRO JOSE IBRAHIM 1" você DEVE retornar apenas "PRONTO SOCORRO JOSE IBRAHIM". Exemplo 2: De "FACE UBS PORTAL 2" retorne apenas "UBS PORTAL".\n\nLista de Referência:\n${contextoEquipamentos}`;
  }

  const { data: chamados } = await supabase.from('chamados').select('*').order('ticket', { ascending: false });
  console.log(`Encontrados ${chamados.length} chamados para reclassificar.`);

  const LOTE_SIZE = 40;
  let atualizados = 0;

  for (let i = 0; i < chamados.length; i += LOTE_SIZE) {
    const lote = chamados.slice(i, i + LOTE_SIZE);
    
    const prompt = lote.map(c => 
      `Ticket: ${c.ticket}\nTítulo: ${c.unidade || ''}\nDescrição: ${c.problema || ''}`
    ).join('\n\n---\n\n');

    console.log(`\n🧠 Enviando lote ${Math.floor(i/LOTE_SIZE) + 1} de ${Math.ceil(chamados.length / LOTE_SIZE)}...`);
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          systemInstruction: instrucao,
          responseMimeType: 'application/json',
          responseSchema: schema,
        }
      });
      
      const json = JSON.parse(response.text);
      if (Array.isArray(json)) {
        for (const classif of json) {
          if (classif.ticket) {
            await supabase.from('chamados').update({
              secretaria: classif.secretaria,
              unidade: classif.unidade,
              motivo: classif.motivo
            }).eq('ticket', classif.ticket);
            atualizados++;
          }
        }
        console.log(`✅ Lote processado. Total atualizado até agora: ${atualizados}/${chamados.length}`);
      }
    } catch (e) {
      console.error(`❌ Erro no lote:`, e.message);
    }
    
    if (i + LOTE_SIZE < chamados.length) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  console.log(`\n🎉 Reclassificação concluída! ${atualizados} chamados atualizados.`);
}

run();
