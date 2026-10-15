import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

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
    const valid = allMatches.map(Number).filter((n) => n >= 4000 && n <= 6999);
    if (valid.length > 0) return valid[valid.length - 1];
  }

  if (notes) {
    const matchN = notes.match(/(?:AUVO|CHAMADO|TICKET)[^\d]*(\d{4,5})\b/i);
    if (matchN) return parseInt(matchN[1], 10);
  }

  return null;
}

export default async function handler(req, res) {
  // Configurar CORS para segurança da API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Utilize POST.' });
  }

  const { ticket, observacao, autor } = req.body || {};

  if (!ticket || !observacao || !observacao.trim()) {
    return res.status(400).json({ error: 'Parâmetros "ticket" e "observacao" são obrigatórios.' });
  }

  const ticketNum = parseInt(ticket, 10);
  const autorNome = (autor || 'Operador SIC').trim();
  const textoLimpo = observacao.trim();

  // Obter credenciais do ambiente
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  let supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (supabaseKey.startsWith('b_publishable_')) supabaseKey = 's' + supabaseKey;

  let asanaToken = (process.env.ASANA_ACCESS_TOKEN || process.env.ASANA_TOKEN || '').trim();
  if (asanaToken.toLowerCase().startsWith('token:')) asanaToken = asanaToken.replace(/^token:\s*/i, '').trim();
  if (asanaToken.toLowerCase().startsWith('bearer ')) asanaToken = asanaToken.replace(/^bearer\s+/i, '').trim();

  const rawProjId = (process.env.ASANA_PROJECT_ID || '').trim().match(/\d+/)?.[0];

  if (!asanaToken) {
    console.warn('⚠️ Token do Asana não configurado.');
    return res.status(200).json({
      success: false,
      message: 'Token do Asana não configurado no ambiente Vercel.',
    });
  }

  try {
    let taskGid = null;
    let gidMap = {};
    let supabase = null;

    if (supabaseUrl && supabaseKey) {
      supabase = createClient(supabaseUrl, supabaseKey);
      try {
        const { data: mapCfg } = await supabase
          .from('configuracoes')
          .select('valor')
          .eq('chave', 'asana_gid_map')
          .maybeSingle();

        if (mapCfg?.valor) {
          gidMap = JSON.parse(mapCfg.valor);
          // Procurar gid associado a esse ticket
          for (const [gid, tkt] of Object.entries(gidMap)) {
            if (Number(tkt) === ticketNum) {
              taskGid = gid;
              break;
            }
          }
        }
      } catch (e) {
        console.warn('Aviso ao consultar asana_gid_map:', e.message);
      }
    }

    // Se não encontrou no mapa salvo, buscar tarefas do projeto no Asana
    if (!taskGid && rawProjId) {
      console.log(`🔍 Buscando tarefa do ticket #${ticketNum} diretamente no projeto Asana ${rawProjId}...`);
      let url = `https://app.asana.com/api/1.0/projects/${rawProjId}/tasks?opt_fields=name,notes&limit=100`;

      while (url && !taskGid) {
        const pRes = await fetch(url, { headers: { Authorization: `Bearer ${asanaToken}` } });
        if (!pRes.ok) break;

        const pData = await pRes.json();
        for (const t of pData.data || []) {
          const tkt = extrairTicket(t.name, t.notes);
          if (tkt === ticketNum) {
            taskGid = t.gid;
            gidMap[t.gid] = ticketNum;
            // Atualizar mapa de GIDs se possível
            if (supabase) {
              supabase
                .from('configuracoes')
                .upsert({
                  chave: 'asana_gid_map',
                  valor: JSON.stringify(gidMap),
                  descricao: 'Mapeamento bidirecional GID da tarefa Asana -> Número do Ticket',
                })
                .then(() => {})
                .catch(() => {});
            }
            break;
          }
        }

        url = pData.next_page?.uri || null;
      }
    }

    if (!taskGid) {
      console.warn(`Tarefa do ticket #${ticketNum} não encontrada no Asana.`);
      return res.status(200).json({
        success: false,
        message: `Chamado #${ticketNum} não está vinculado a nenhuma tarefa no Asana.`,
      });
    }

    // Publicar comentário na tarefa do Asana via Stories API
    const storyText = `💬 [SIC-Biometria] ${textoLimpo}\n— ${autorNome}`;

    const storyRes = await fetch(`https://app.asana.com/api/1.0/tasks/${taskGid}/stories`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${asanaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          text: storyText,
        },
      }),
    });

    if (!storyRes.ok) {
      const errBody = await storyRes.text();
      console.error(`Erro ao postar story no Asana para tarefa ${taskGid}:`, errBody);
      return res.status(storyRes.status).json({
        success: false,
        message: 'Falha na API do Asana ao criar comentário.',
        details: errBody,
      });
    }

    const storyData = await storyRes.json();
    console.log(`✅ Comentário publicado no Asana para o ticket #${ticketNum} (Task: ${taskGid}, Story: ${storyData.data?.gid})`);

    return res.status(200).json({
      success: true,
      storyGid: storyData.data?.gid,
      taskGid,
      ticket: ticketNum,
    });
  } catch (err) {
    console.error('Erro na rota /api/comentar-asana:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
