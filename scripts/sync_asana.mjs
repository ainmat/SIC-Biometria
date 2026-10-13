import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

// --- Validação de Variáveis de Ambiente ---
const ASANA_TOKEN = process.env.ASANA_ACCESS_TOKEN;
const ASANA_PROJECT_ID = process.env.ASANA_PROJECT_ID;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!ASANA_TOKEN || !ASANA_PROJECT_ID) {
  console.error('❌ Erro: ASANA_ACCESS_TOKEN e ASANA_PROJECT_ID são obrigatórios.');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Erro: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

// --- Modelos de IA Candidatos ---
const CANDIDATE_MODELS = [
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-flash-latest'
];

const schema = {
  type: "ARRAY",
  description: "Lista de classificações na mesma ordem dos chamados fornecidos",
  items: {
    type: "OBJECT",
    properties: {
      secretaria: { type: "STRING", description: "Nome da Secretaria ou 'NÃO IDENTIFICADO'" },
      unidade: { type: "STRING", description: "Nome do local físico/unidade ou 'NÃO IDENTIFICADO'" },
      motivo: { type: "STRING", description: "Categoria em CAIXA ALTA (EQUIPAMENTO, RECONHECIMENTO, ESPELHO DE PONTO, CADASTRO)" }
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
 * Extrai o número do ticket (4 a 5 dígitos) do título ou da descrição
 */
export function extrairTicket(name, notes) {
  if (!name) return null;

  // 1. Procurar explicitamente por 'AUVO \d+' ou 'CHAMADO \d+' ou 'TICKET \d+'
  const matchAuvo = name.match(/(?:AUVO|CHAMADO|TICKET)[^\d]*(\d{4,5})\b/i);
  if (matchAuvo) return parseInt(matchAuvo[1], 10);

  // 2. Número de 4 a 5 dígitos no final da linha com fronteira de palavra
  const matchFim = name.match(/\b(\d{4,5})\s*$/);
  if (matchFim) {
    const val = parseInt(matchFim[1], 10);
    if (val >= 4000 && val <= 6999) return val;
  }

  // 3. Número de 4 dígitos isolado na faixa de chamados (4000 a 6999)
  const allMatches = name.match(/\b(\d{4})\b/g);
  if (allMatches) {
    const valid = allMatches.map(Number).filter(n => n >= 4000 && n <= 6999);
    if (valid.length > 0) return valid[valid.length - 1];
  }

  // 4. Número de 4 dígitos colado a letras ou parênteses (ex: SELCICUS)5466 ou BANDEIRA4562)
  const matchColado = name.match(/(?:[a-zA-Z\)])(\d{4})\b/g);
  if (matchColado) {
    const valid = matchColado.map(s => parseInt(s.slice(1), 10)).filter(n => n >= 4000 && n <= 6999);
    if (valid.length > 0) return valid[valid.length - 1];
  }

  // 5. Tenta recuperar na descrição (notes)
  if (notes) {
    const matchN = notes.match(/(?:AUVO|CHAMADO|TICKET)[^\d]*(\d{4,5})\b/i);
    if (matchN) return parseInt(matchN[1], 10);
  }

  return null;
}

/**
 * Mapeia o status do Asana para o padrão do SIC-Biometria
 */
export function mapearStatus(task) {
  const secName = (task.memberships?.[0]?.section?.name || '').toUpperCase();
  if (task.completed || secName.includes('CONCLU')) {
    return 'Atendimento Encerrado';
  }
  return 'Aguardando Atendimento';
}

/**
 * Fallback heurístico caso a API do Gemini esteja temporariamente indisponível
 */
function extrairFallbackHeuristico(chamado, equipamentosLista = []) {
  const textoCompleto = `${chamado.titulo || ''} ${chamado.descricao || ''}`.toUpperCase();

  let secretaria = 'NÃO IDENTIFICADO';
  let unidade = 'NÃO IDENTIFICADO';
  let motivo = 'EQUIPAMENTO';

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

  if (textoCompleto.includes('ESPELHO') || textoCompleto.includes('MARCAÇÃO') || textoCompleto.includes('MARCACAO') || textoCompleto.includes('NÃO SUBIU') || textoCompleto.includes('BATIDA')) {
    motivo = 'ESPELHO DE PONTO';
  } else if (textoCompleto.includes('RECONHECE') || textoCompleto.includes('ROSTO') || textoCompleto.includes('FACIAL') || textoCompleto.includes('BIOMETRIA') || textoCompleto.includes('DIGITAL')) {
    motivo = 'RECONHECIMENTO';
  } else if (textoCompleto.includes('CADASTRO') || textoCompleto.includes('CADASTRAR') || textoCompleto.includes('INCLUSÃO') || textoCompleto.includes('INCLUSAO') || textoCompleto.includes('TRANSFERENCIA')) {
    motivo = 'CADASTRO';
  } else {
    motivo = 'EQUIPAMENTO';
  }

  return { secretaria, unidade, motivo };
}

/**
 * Classifica um lote de chamados via Gemini
 */
async function classificarLoteLLM(chamadosLote, contextoEquipamentos, equipamentosLista) {
  if (!ai) {
    console.warn('⚠️ IA desabilitada (sem chave). Utilizando classificação heurística.');
    return chamadosLote.map(c => extrairFallbackHeuristico(c, equipamentosLista));
  }

  const prompt = chamadosLote.map((c, idx) =>
    `Chamado ${idx + 1}\nTítulo: ${c.titulo}\nDescrição: ${c.descricao}`
  ).join('\n\n---\n\n');

  let instrucao = SYSTEM_INSTRUCTION;
  if (contextoEquipamentos) {
    instrucao += `\n\nATENÇÃO: Utilize a lista de equipamentos/unidades abaixo como um dicionário de referência. Se a descrição do chamado citar algum nome (ex: "Jóse Ibrahim", "EMEF...", etc) que seja parecido ou corresponda a um equipamento desta lista, você DEVE extrair a UNIDADE e a SECRETARIA exatas que constam na lista.\n\nA Secretaria definida na lista tem prioridade absoluta sobre o que foi digitado no chamado.\n\nREGRA DE NORMALIZAÇÃO DE UNIDADE: O nome da unidade DEVE refletir apenas o local físico, agrupado em CAIXA ALTA, sem os prefixos/sufixos de equipamento. Remova palavras como "FACE", numerações iniciais ou finais (ex: "1", "2", "3"), ou locais específicos ("Térreo", "Corredor"). Exemplo: De "1471 FACE PRONTO SOCORRO JOSE IBRAHIM 1" você DEVE retornar apenas "PRONTO SOCORRO JOSE IBRAHIM".\n\nLista de Referência (Equipamento - Secretaria):\n${contextoEquipamentos}`;
  }

  for (const model of CANDIDATE_MODELS) {
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
        return json.map(item => {
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

          return { secretaria: sec, unidade: uni, motivo: mot };
        });
      }
    } catch (err) {
      console.warn(`[Classificação IA] Falha no modelo ${model}:`, err?.message || err);
    }
  }

  console.warn('[Classificação IA] Modelos offline ou limite de cota atingido. Usando fallback heurístico.');
  return chamadosLote.map(c => extrairFallbackHeuristico(c, equipamentosLista));
}

/**
 * Função Principal de Sincronização
 */
export async function sincronizarAsana() {
  const inicio = Date.now();
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`🚀 INICIANDO SINCRONIZAÇÃO ASANA → SIC-BIOMETRIA [${new Date().toISOString()}]`);
  console.log('═══════════════════════════════════════════════════════════════');

  // 1. Obter estado atual do Supabase
  console.log('📦 1. Consultando banco de dados Supabase...');
  let temColunasAsana = false;
  let dbRows = [];
  const { data: testRows, error: testErr } = await supabase
    .from('chamados')
    .select('ticket, status, status_auvo, status_asana, secao_asana');

  if (!testErr) {
    temColunasAsana = true;
    dbRows = testRows;
    console.log('   ✓ Colunas dedicadas (status_auvo, status_asana, secao_asana) ativas no Supabase.');
  } else {
    console.log('   ℹ️ Colunas dedicadas ainda não detectadas. Utilizando fallback para coluna status padrão.');
    console.log('   💡 (Para ativar a separação completa, execute o script migrations/adicionar_status_auvo_e_asana.sql no Supabase)');
    const { data: fbRows, error: fbErr } = await supabase.from('chamados').select('ticket, status');
    if (fbErr) throw new Error(`Erro ao consultar chamados no Supabase: ${fbErr.message}`);
    dbRows = fbRows;
  }

  const dbMap = new Map();
  (dbRows || []).forEach(r => dbMap.set(r.ticket, r));
  console.log(`   ✓ ${dbMap.size} chamados já registrados no banco.`);

  // 2. Buscar lista de equipamentos para contextualização
  let contextoEquipamentos = "";
  let equipamentosLista = [];
  try {
    const { data: eqData } = await supabase.from('equipamentos').select('nome, secretaria');
    if (eqData && eqData.length > 0) {
      equipamentosLista = eqData;
      contextoEquipamentos = eqData.map(eq => `${eq.nome} - Secretaria: ${eq.secretaria}`).join('\n');
    }
  } catch (e) {
    console.warn('   ⚠️ Não foi possível carregar lista de equipamentos:', e.message);
  }

  // 3. Buscar todas as tarefas do Asana (paginado)
  console.log('🌐 2. Consultando tarefas do projeto Asana...');
  let url = `https://app.asana.com/api/1.0/projects/${ASANA_PROJECT_ID}/tasks?opt_fields=name,notes,created_at,completed_at,memberships.section.name,modified_at,completed&limit=100`;
  const todasTarefas = [];

  while (url) {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${ASANA_TOKEN}` }
    });
    if (!res.ok) {
      throw new Error(`Erro na API do Asana (${res.status}): ${await res.text()}`);
    }
    const json = await res.json();
    todasTarefas.push(...(json.data || []));
    url = json.next_page?.uri || null;
  }
  console.log(`   ✓ ${todasTarefas.length} tarefas recebidas do Asana.`);

  // 4. Analisar e identificar: Novos vs Atualizados
  const novosParaInserir = [];
  const statusParaAtualizar = [];

  for (const t of todasTarefas) {
    const secName = t.memberships?.[0]?.section?.name || '';
    if (secName === 'RESPOSTA PADRÃO AUVO') continue; // Ignora modelos de texto

    const ticket = extrairTicket(t.name, t.notes);
    if (!ticket) continue; // Sem ticket associado

    const statusAtual = mapearStatus(t);

    if (!dbMap.has(ticket)) {
      // Chamado novo vindo do Asana!
      let dataAbertura = null;
      if (t.created_at) {
        dataAbertura = t.created_at.split('T')[0];
      }
      novosParaInserir.push({
        ticket,
        titulo: t.name,
        descricao: t.notes || '',
        data_abertura: dataAbertura,
        status: statusAtual,
        status_asana: statusAtual,
        secao_asana: secName,
        status_auvo: null
      });
    } else {
      // Chamado existente: verificar se o status do Asana ou a seção mudou
      const reg = dbMap.get(ticket);
      const statusAsanaDb = reg.status_asana;
      const secaoDb = reg.secao_asana || '';

      if (statusAsanaDb !== statusAtual || secaoDb !== secName) {
        statusParaAtualizar.push({
          ticket,
          status_asana: statusAtual,
          secao_asana: secName,
          status: reg.status_auvo || reg.status || statusAtual // Preserva o status do Auvo se existir
        });
      }
    }
  }

  console.log(`\n📊 3. Diagnóstico das tarefas:`);
  console.log(`   • Novos chamados a importar: ${novosParaInserir.length}`);
  console.log(`   • Chamados com status alterado no Asana: ${statusParaAtualizar.length}`);

  let totalInseridos = 0;
  let totalAtualizados = 0;

  // 5. Atualizar chamados com status modificado no Asana (NUNCA toca em status_auvo)
  if (statusParaAtualizar.length > 0) {
    console.log(`\n🔄 4. Atualizando ${statusParaAtualizar.length} status do Asana no Supabase...`);
    const CHUNK_SIZE = 25;
    for (let i = 0; i < statusParaAtualizar.length; i += CHUNK_SIZE) {
      const chunk = statusParaAtualizar.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (item) => {
        const payload = temColunasAsana
          ? { status_asana: item.status_asana, secao_asana: item.secao_asana }
          : { status: item.status_asana };

        const { error } = await supabase
          .from('chamados')
          .update(payload)
          .eq('ticket', item.ticket);

        if (error) {
          console.error(`   ❌ Erro ao atualizar status do ticket #${item.ticket}:`, error.message);
        } else {
          totalAtualizados++;
        }
      }));
    }
    console.log(`   ✓ ${totalAtualizados} status do Asana atualizados com sucesso (status do Auvo preservado).`);
  }

  // 6. Processar novos chamados com Inteligência Artificial
  if (novosParaInserir.length > 0) {
    console.log(`\n🧠 5. Classificando ${novosParaInserir.length} novos chamados com Gemini AI...`);
    const LOTE_SIZE = 15;
    const chamadosProntos = [];

    for (let i = 0; i < novosParaInserir.length; i += LOTE_SIZE) {
      const lote = novosParaInserir.slice(i, i + LOTE_SIZE);
      console.log(`   Enviando lote ${Math.floor(i / LOTE_SIZE) + 1} de ${Math.ceil(novosParaInserir.length / LOTE_SIZE)}...`);

      const loteLLM = lote.map(c => ({
        titulo: c.titulo,
        descricao: c.descricao
      }));

      const classificacoes = await classificarLoteLLM(loteLLM, contextoEquipamentos, equipamentosLista);

      for (let j = 0; j < lote.length; j++) {
        const item = lote[j];
        const classif = classificacoes[j] || { secretaria: 'NÃO IDENTIFICADO', unidade: 'NÃO IDENTIFICADO', motivo: 'EQUIPAMENTO' };

        const objFinal = {
          ticket: item.ticket,
          data_abertura: item.data_abertura,
          secretaria: classif.secretaria,
          unidade: classif.unidade,
          problema: item.descricao,
          motivo: classif.motivo,
          status: item.status
        };

        if (temColunasAsana) {
          objFinal.status_asana = item.status_asana;
          objFinal.secao_asana = item.secao_asana;
          objFinal.status_auvo = null;
        }

        chamadosProntos.push(objFinal);
      }

      if (i + LOTE_SIZE < novosParaInserir.length) {
        await new Promise(r => setTimeout(r, 1500));
      }
    }


    // Upsert dos novos registros
    console.log(`\n💾 6. Salvando novos chamados no Supabase...`);
    for (let i = 0; i < chamadosProntos.length; i += 50) {
      const batch = chamadosProntos.slice(i, i + 50);
      const { error } = await supabase.from('chamados').upsert(batch, { onConflict: 'ticket' });
      if (error) {
        console.error('   ❌ Erro ao inserir novos chamados:', error);
        throw error;
      }
      totalInseridos += batch.length;
    }
    console.log(`   ✓ ${totalInseridos} novos chamados inseridos com sucesso.`);
  }

  const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`🎉 SINCRONIZAÇÃO CONCLUÍDA EM ${duracao}s!`);
  console.log(`   • Novos chamados inseridos: ${totalInseridos}`);
  console.log(`   • Status atualizados: ${totalAtualizados}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  return { totalInseridos, totalAtualizados, duracao };
}

// Executar diretamente se chamado via CLI
if (process.argv[1]?.endsWith('sync_asana.mjs')) {
  sincronizarAsana().catch(err => {
    console.error('❌ Falha fatal na sincronização:', err);
    process.exit(1);
  });
}
