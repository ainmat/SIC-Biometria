import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

// Configurações e Modelos
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

function extrairTicket(name, notes) {
  if (!name) return null;
  const matchAuvo = name.match(/(?:AUVO|CHAMADO|TICKET)[^\d]*(\d{4,5})\b/i);
  if (matchAuvo) return parseInt(matchAuvo[1], 10);

  const matchFim = name.match(/\b(\d{4,5})\s*$/);
  if (matchFim) {
    const val = parseInt(matchFim[1], 10);
    if (val >= 4000 && val <= 6999) return val;
  }

  const allMatches = name.match(/\b(\d{4})\b/g);
  if (allMatches) {
    const valid = allMatches.map(Number).filter(n => n >= 4000 && n <= 6999);
    if (valid.length > 0) return valid[valid.length - 1];
  }

  const matchColado = name.match(/(?:[a-zA-Z\)])(\d{4})\b/g);
  if (matchColado) {
    const valid = matchColado.map(s => parseInt(s.slice(1), 10)).filter(n => n >= 4000 && n <= 6999);
    if (valid.length > 0) return valid[valid.length - 1];
  }

  if (notes) {
    const matchN = notes.match(/(?:AUVO|CHAMADO|TICKET)[^\d]*(\d{4,5})\b/i);
    if (matchN) return parseInt(matchN[1], 10);
  }

  return null;
}

function mapearStatus(task) {
  const secName = (task.memberships?.[0]?.section?.name || '').toUpperCase();
  if (task.completed || secName.includes('CONCLU')) {
    return 'Atendimento Encerrado';
  }
  return 'Aguardando Atendimento';
}

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

async function classificarChamadoLLM(c, contextoEquipamentos, equipamentosLista, ai) {
  if (!ai) return extrairFallbackHeuristico(c, equipamentosLista);

  let instrucao = SYSTEM_INSTRUCTION;
  if (contextoEquipamentos) {
    instrucao += `\n\nLista de Referência:\n${contextoEquipamentos}`;
  }

  const prompt = `Chamado 1\nTítulo: ${c.titulo}\nDescrição: ${c.descricao}`;

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
      if (Array.isArray(json) && json[0]) {
        return {
          secretaria: (json[0].secretaria || 'NÃO IDENTIFICADO').toUpperCase().trim(),
          unidade: (json[0].unidade || 'NÃO IDENTIFICADO').toUpperCase().trim(),
          motivo: (json[0].motivo || 'EQUIPAMENTO').toUpperCase().trim(),
        };
      }
    } catch {
      // Tenta próximo modelo
    }
  }

  return extrairFallbackHeuristico(c, equipamentosLista);
}

// Handler do Endpoint Vercel
export default async function handler(req, res) {
  // 1. Handshake do Asana
  const hookSecret = req.headers['x-hook-secret'];
  if (hookSecret) {
    console.log('🤝 Handshake do Asana recebido com sucesso!');
    res.setHeader('X-Hook-Secret', hookSecret);
    return res.status(200).send('');
  }

  // 2. Health check / Diagnóstico via GET
  if (req.method !== 'POST') {
    return res.status(200).json({
      status: 'ok',
      message: 'Endpoint do Webhook Asana ativo em tempo real',
      env_check: {
        has_supabase: !!(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL),
        has_asana_token: !!(process.env.ASANA_ACCESS_TOKEN || process.env.ASANA_TOKEN),
        has_asana_project: !!process.env.ASANA_PROJECT_ID,
        has_gemini: !!(process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY)
      }
    });
  }

  const inicio = Date.now();

  try {
    const events = req.body?.events || [];
    console.log(`⚡ Webhook Asana recebido: ${events.length} evento(s).`);

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    if (supabaseKey.startsWith('b_publishable_')) supabaseKey = 's' + supabaseKey;

    let asanaToken = (process.env.ASANA_ACCESS_TOKEN || process.env.ASANA_TOKEN || '').trim();
    if (asanaToken.toLowerCase().startsWith('token:')) asanaToken = asanaToken.replace(/^token:\s*/i, '').trim();
    if (asanaToken.toLowerCase().startsWith('bearer ')) asanaToken = asanaToken.replace(/^bearer\s+/i, '').trim();

    const geminiKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('⚠️ Supabase não configurado nas variáveis de ambiente da Vercel.');
      return res.status(200).json({ success: false, message: 'Supabase credentials missing' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const ai = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;

    // Registra o evento recebido na tabela configuracoes para auditoria
    await supabase.from('configuracoes').upsert({
      chave: 'ultimo_webhook_asana',
      valor: JSON.stringify({
        timestamp: new Date().toISOString(),
        total_eventos: events.length,
        eventos: events.slice(0, 10).map((e) => ({
          acao: e.action,
          tipo: e.resource?.resource_type,
          gid: e.resource?.gid,
        })),
      }),
      descricao: 'Metadados do último evento recebido em tempo real via Webhook do Asana',
    });

    if (!asanaToken) {
      console.warn('⚠️ ASANA_ACCESS_TOKEN não configurado na Vercel. Evento registrado, mas sincronização individual requer token.');
      return res.status(200).json({ success: true, processed: events.length, synced: 0, reason: 'ASANA_ACCESS_TOKEN missing in Vercel' });
    }

    // Filtra tarefas únicas alteradas ou adicionadas
    const taskGids = [...new Set(
      events
        .filter(e => e.resource?.resource_type === 'task' && (e.action === 'changed' || e.action === 'added'))
        .map(e => e.resource.gid)
    )];

    let inseridos = 0;
    let atualizados = 0;

    if (taskGids.length > 0) {
      // Buscar equipamentos para contexto de IA/Heurística
      let contextoEquipamentos = "";
      let equipamentosLista = [];
      try {
        const { data: eqData } = await supabase.from('equipamentos').select('nome, secretaria');
        if (eqData && eqData.length > 0) {
          equipamentosLista = eqData;
          contextoEquipamentos = eqData.map(eq => `${eq.nome} - Secretaria: ${eq.secretaria}`).join('\n');
        }
      } catch (e) {
        console.warn('Erro ao carregar equipamentos:', e.message);
      }

      // Processar cada tarefa
      for (const gid of taskGids) {
        try {
          const taskRes = await fetch(
            `https://app.asana.com/api/1.0/tasks/${gid}?opt_fields=name,notes,created_at,completed_at,memberships.section.name,modified_at,completed`,
            { headers: { Authorization: `Bearer ${asanaToken}` } }
          );

          if (!taskRes.ok) continue;
          const taskData = await taskRes.json();
          const task = taskData.data;
          if (!task) continue;

          const secName = task.memberships?.[0]?.section?.name || '';
          if (secName === 'RESPOSTA PADRÃO AUVO') continue;

          const ticket = extrairTicket(task.name, task.notes);
          if (!ticket) continue;

          const statusAtual = mapearStatus(task);

          // Verificar se já existe no Supabase
          const { data: dbRows } = await supabase
            .from('chamados')
            .select('ticket, status, status_asana, secao_asana')
            .eq('ticket', ticket);

          const existente = dbRows?.[0];

          if (existente) {
            // Atualizar status
            await supabase
              .from('chamados')
              .update({
                status: statusAtual,
                status_asana: statusAtual,
                secao_asana: secName,
              })
              .eq('ticket', ticket);
            atualizados++;
          } else {
            // Novo chamado: classificar e inserir
            const classif = await classificarChamadoLLM(
              { titulo: task.name, descricao: task.notes || '' },
              contextoEquipamentos,
              equipamentosLista,
              ai
            );

            await supabase.from('chamados').upsert({
              ticket,
              data_abertura: task.created_at ? task.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
              secretaria: classif.secretaria,
              unidade: classif.unidade,
              problema: task.notes || '',
              motivo: classif.motivo,
              status: statusAtual,
              status_asana: statusAtual,
              secao_asana: secName,
              status_auvo: null,
            }, { onConflict: 'ticket' });

            inseridos++;
          }
        } catch (errTask) {
          console.error(`Erro ao processar tarefa Asana ${gid}:`, errTask);
        }
      }

      // Atualizar indicador de sincronização no Supabase para o Topbar
      const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
      await supabase.from('configuracoes').upsert({
        chave: 'ultima_sincronizacao_asana',
        valor: JSON.stringify({
          timestamp: new Date().toISOString(),
          status: 'sucesso',
          novos_inseridos: inseridos,
          status_atualizados: atualizados,
          duracao_segundos: Number(duracao),
          origem: 'webhook_tempo_real',
        }),
        descricao: 'Metadados e timestamp da última sincronização do Asana',
      });
    }

    return res.status(200).json({
      success: true,
      processed: events.length,
      tasks_evaluated: taskGids.length,
      inseridos,
      atualizados,
      duracao: ((Date.now() - inicio) / 1000).toFixed(1) + 's'
    });
  } catch (error) {
    console.error('❌ Erro no webhook Asana:', error);
    return res.status(200).json({ success: false, error: error.message });
  }
}

