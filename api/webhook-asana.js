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

function normalizarTexto(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function extrairFallbackHeuristico(chamado, equipamentosLista = []) {
  const textoOriginal = `${chamado.titulo || ''} ${chamado.descricao || ''}`;
  const textoNorm = normalizarTexto(textoOriginal);

  let secretaria = 'NÃO IDENTIFICADO';
  let unidade = 'NÃO IDENTIFICADO';
  let motivo = 'EQUIPAMENTO';

  // 1. Tentar encontrar correspondência na lista de equipamentos
  for (const eq of equipamentosLista) {
    if (eq.nome && eq.nome.length > 3) {
      const nomeLimpo = eq.nome
        .replace(/^\d+\s+/, '')
        .replace(/^FACE\s+/i, '')
        .replace(/\s+\d+$/, '')
        .trim();
      const nomeNorm = normalizarTexto(nomeLimpo);

      if (nomeNorm.length > 3 && textoNorm.includes(nomeNorm)) {
        unidade = nomeLimpo.toUpperCase();
        if (eq.secretaria && secretaria === 'NÃO IDENTIFICADO') {
          secretaria = eq.secretaria.toUpperCase();
        }
        break;
      }
    }
  }

  // 2. Se a secretaria ainda não foi identificada, procurar siglas conhecidas
  if (secretaria === 'NÃO IDENTIFICADO') {
    const secretariasConhecidas = [
      'SAS', 'SED', 'SAUDE', 'SS', 'SEPLAG', 'SECONTRU', 'SEMARH', 'SEREL', 'SETRE',
      'SEMAP', 'SEINFRA', 'SECOL', 'SJDH', 'SECONT', 'SEHAB', 'SEF', 'SF', 'SA',
      'SERH', 'SETIC', 'SEGOV', 'SECOM', 'SECULT', 'FITO', 'CMO', 'IPMO', 'ADVANCIS'
    ];
    for (const sec of secretariasConhecidas) {
      const regex = new RegExp(`\\b${sec}\\b`, 'i');
      if (regex.test(textoOriginal)) {
        secretaria = sec === 'SAUDE' ? 'SS' : sec;
        break;
      }
    }
  }

  if (textoNorm.includes('ADVANCIS')) {
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

    // Carregar mapa de GID -> Ticket para resolução instantânea de exclusões
    let gidMap = {};
    try {
      const { data: mapCfg } = await supabase.from('configuracoes').select('valor').eq('chave', 'asana_gid_map').maybeSingle();
      if (mapCfg?.valor) gidMap = JSON.parse(mapCfg.valor);
    } catch (e) {
      console.warn('Erro ao carregar asana_gid_map:', e.message);
    }
    let mapAlterado = false;

    // 1. Identificar tarefas criadas, modificadas ou com novos comentários
    const taskGids = [...new Set([
      ...events
        .filter(e => e.resource?.resource_type === 'task' && (e.action === 'changed' || e.action === 'added'))
        .map(e => e.resource.gid),
      ...events
        .filter(e => e.parent?.resource_type === 'task' && e.resource?.resource_type === 'story')
        .map(e => e.parent.gid),
    ])];

    // 2. Identificar tarefas excluídas ou removidas do projeto no Asana
    const deletedTaskGids = [...new Set(
      events
        .filter(e => {
          if (e.resource?.resource_type !== 'task') return false;
          // Tarefa explicitamente deletada no Asana
          if (e.action === 'deleted') return true;
          // Tarefa removida do projeto no Asana (sem parent ou parent do tipo project)
          if (e.action === 'removed' && (!e.parent || e.parent?.resource_type === 'project')) return true;
          return false;
        })
        .map(e => e.resource.gid)
    )].filter(gid => !taskGids.includes(gid));

    let inseridos = 0;
    let atualizados = 0;
    let excluidos = 0;
    let desvinculados = 0;

    // Processar exclusões primeiro
    if (deletedTaskGids.length > 0) {
      console.log(`🗑️ Processando ${deletedTaskGids.length} tarefa(s) excluída(s) no Asana...`);
      for (const gid of deletedTaskGids) {
        let ticketToDelete = gidMap[gid];

        if (ticketToDelete) {
          // GID mapeado encontrado! Exclui o chamado do banco e do histórico
          const { error: delErr } = await supabase.from('chamados').delete().eq('ticket', ticketToDelete);
          if (!delErr) {
            await supabase.from('configuracoes').delete().eq('chave', `chamado_historico_${ticketToDelete}`);
            excluidos++;
            console.log(`   ✓ Chamado #${ticketToDelete} excluído automaticamente do banco (tarefa Asana GID ${gid} excluída).`);
          } else {
            console.error(`   ❌ Erro ao excluir chamado #${ticketToDelete}:`, delErr);
          }
          delete gidMap[gid];
          mapAlterado = true;
        } else {
          // GID não encontrado no mapa direto: reconciliação de segurança consultando o projeto
          try {
            const rawProjId = (process.env.ASANA_PROJECT_ID || '').trim().match(/\d+/)?.[0];
            if (rawProjId) {
              let url = `https://app.asana.com/api/1.0/projects/${rawProjId}/tasks?opt_fields=name,notes&limit=100`;
              const ticketsAtivos = new Set();
              const gidsAtivos = new Set();
              while (url) {
                const resP = await fetch(url, { headers: { Authorization: `Bearer ${asanaToken}` } });
                if (!resP.ok) break;
                const jsonP = await resP.json();
                (jsonP.data || []).forEach(t => {
                  gidsAtivos.add(t.gid);
                  const tkt = extrairTicket(t.name, t.notes);
                  if (tkt) {
                    ticketsAtivos.add(tkt);
                    gidMap[t.gid] = tkt;
                  }
                });
                url = jsonP.next_page?.uri || null;
              }
              mapAlterado = true;

              // 1. Verificar se no mapa de GIDs há itens que sumiram do Asana
              for (const [mGid, mTkt] of Object.entries(gidMap)) {
                if (!gidsAtivos.has(mGid)) {
                  await supabase.from('chamados').delete().eq('ticket', mTkt);
                  await supabase.from('configuracoes').delete().eq('chave', `chamado_historico_${mTkt}`);
                  delete gidMap[mGid];
                  excluidos++;
                  console.log(`   ✓ Chamado #${mTkt} (GID ${mGid}) excluído via reconciliação de GIDs.`);
                }
              }

              // 2. Verificar chamados do Asana no Supabase que sumiram do projeto
              const { data: dbAsana } = await supabase.from('chamados').select('ticket').not('status_asana', 'is', null).gte('ticket', 4000);
              for (const r of (dbAsana || [])) {
                if (!ticketsAtivos.has(r.ticket)) {
                  await supabase.from('chamados').delete().eq('ticket', r.ticket);
                  await supabase.from('configuracoes').delete().eq('chave', `chamado_historico_${r.ticket}`);
                  excluidos++;
                  console.log(`   ✓ Chamado #${r.ticket} excluído via reconciliação com Asana.`);
                }
              }
            }
          } catch (recErr) {
            console.error('Erro na reconciliação de exclusão:', recErr);
          }
        }
      }
    }

    // Processar tarefas adicionadas ou alteradas
    if (taskGids.length > 0) {
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

          // Registrar no mapa de GIDs
          gidMap[gid] = ticket;
          mapAlterado = true;

          const statusAtual = mapearStatus(task);

          // Buscar comentários (stories) da tarefa no Asana
          let stories = [];
          try {
            const storiesRes = await fetch(
              `https://app.asana.com/api/1.0/tasks/${gid}/stories?opt_fields=created_at,created_by.name,text,type,resource_subtype`,
              { headers: { Authorization: `Bearer ${asanaToken}` } }
            );
            if (storiesRes.ok) {
              const storiesJson = await storiesRes.json();
              stories = (storiesJson.data || []).filter(
                s => s.resource_subtype === 'comment_added' || (s.type === 'comment' && s.text && s.text.trim())
              );
            }
          } catch (storyErr) {
            console.warn(`Aviso ao buscar comentários da tarefa ${gid}:`, storyErr.message);
          }

          // Verificar se já existe no Supabase
          const { data: dbRows } = await supabase
            .from('chamados')
            .select('ticket, status, status_asana, secao_asana, problema, secretaria, unidade, motivo, historico_tramitacao')
            .eq('ticket', ticket);

          const existente = dbRows?.[0];

          if (existente) {
            const updatePayload = {
              status: statusAtual,
              status_asana: statusAtual,
              secao_asana: secName,
            };

            const novaDescricao = task.notes || '';
            // Atualiza a descrição/problema se houver ou se mudou
            if (novaDescricao !== (existente.problema || '')) {
              updatePayload.problema = novaDescricao;
            }

            // Sincronizar comentários do Asana no historico_tramitacao
            const historicoBase = Array.isArray(existente.historico_tramitacao) ? [...existente.historico_tramitacao] : [];
            let historicoAlterado = false;

            for (const s of stories) {
              // Comentários postados a partir do SIC-Biometria já foram salvos localmente
              if (s.text && s.text.includes('[SIC-Biometria]')) {
                continue;
              }

              const autor = s.created_by?.name || 'Asana';
              const textoLimpo = s.text.trim();
              const observacaoFormatada = `${textoLimpo} (${autor})`;

              const jaExiste = historicoBase.some(item =>
                item.asana_gid === s.gid ||
                (item.observacao === observacaoFormatada && Math.abs(new Date(item.data).getTime() - new Date(s.created_at).getTime()) < 60000)
              );

              if (!jaExiste) {
                historicoBase.push({
                  data: s.created_at,
                  status: statusAtual,
                  observacao: observacaoFormatada,
                  asana_gid: s.gid,
                  origem: 'asana'
                });
                historicoAlterado = true;
              }
            }

            if (historicoAlterado) {
              historicoBase.sort((a, b) => new Date(a.data) - new Date(b.data));
              updatePayload.historico_tramitacao = historicoBase;
            }

            // Reclassificar com IA/Heurística caso a descrição/título tenham mudado ou faltem dados
            const precisaReclassificar =
              !existente.secretaria ||
              existente.secretaria === 'NÃO IDENTIFICADO' ||
              !existente.unidade ||
              existente.unidade === 'NÃO IDENTIFICADO' ||
              (novaDescricao && novaDescricao !== (existente.problema || ''));

            if (precisaReclassificar) {
              const classif = await classificarChamadoLLM(
                { titulo: task.name, descricao: novaDescricao },
                contextoEquipamentos,
                equipamentosLista,
                ai
              );

              if (classif.secretaria && classif.secretaria !== 'NÃO IDENTIFICADO') {
                updatePayload.secretaria = classif.secretaria;
              }
              if (classif.unidade && classif.unidade !== 'NÃO IDENTIFICADO') {
                updatePayload.unidade = classif.unidade;
              }
              if (classif.motivo) {
                updatePayload.motivo = classif.motivo;
              }
            }

            await supabase
              .from('chamados')
              .update(updatePayload)
              .eq('ticket', ticket);

            atualizados++;
          } else {
            const classif = await classificarChamadoLLM(
              { titulo: task.name, descricao: task.notes || '' },
              contextoEquipamentos,
              equipamentosLista,
              ai
            );

            // Montar histórico inicial com os comentários do Asana
            const historicoInicial = [];
            for (const s of stories) {
              const autor = s.created_by?.name || 'Asana';
              const textoLimpo = s.text.trim();
              historicoInicial.push({
                data: s.created_at,
                status: statusAtual,
                observacao: `${textoLimpo} (${autor})`,
                asana_gid: s.gid,
                origem: 'asana'
              });
            }
            historicoInicial.sort((a, b) => new Date(a.data) - new Date(b.data));

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
              historico_tramitacao: historicoInicial,
            }, { onConflict: 'ticket' });

            inseridos++;
          }
        } catch (errTask) {
          console.error(`Erro ao processar tarefa Asana ${gid}:`, errTask);
        }
      }
    }

    // Salvar mapa de GID se foi alterado
    if (mapAlterado) {
      await supabase.from('configuracoes').upsert({
        chave: 'asana_gid_map',
        valor: JSON.stringify(gidMap),
        descricao: 'Mapeamento de GID do Asana para número de ticket do SIC-Biometria',
      });
    }

    // Atualizar indicador de sincronização no Supabase para o Topbar
    if (taskGids.length > 0 || deletedTaskGids.length > 0) {
      const duracao = ((Date.now() - inicio) / 1000).toFixed(1);
      await supabase.from('configuracoes').upsert({
        chave: 'ultima_sincronizacao_asana',
        valor: JSON.stringify({
          timestamp: new Date().toISOString(),
          status: 'sucesso',
          novos_inseridos: inseridos,
          status_atualizados: atualizados,
          excluidos,
          desvinculados,
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
      excluidos,
      desvinculados,
      duracao: ((Date.now() - inicio) / 1000).toFixed(1) + 's'
    });
  } catch (error) {
    console.error('❌ Erro no webhook Asana:', error);
    return res.status(200).json({ success: false, error: error.message });
  }
}

