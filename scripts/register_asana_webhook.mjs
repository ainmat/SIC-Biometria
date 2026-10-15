import dotenv from 'dotenv';
dotenv.config();

let rawAsanaToken = (process.env.ASANA_ACCESS_TOKEN || '').trim().replace(/^['"]|['"]$/g, '');
if (rawAsanaToken.toLowerCase().startsWith('token:')) {
  rawAsanaToken = rawAsanaToken.replace(/^token:\s*/i, '').trim();
}
if (rawAsanaToken.toLowerCase().startsWith('bearer ')) {
  rawAsanaToken = rawAsanaToken.replace(/^bearer\s+/i, '').trim();
}
const ASANA_TOKEN = rawAsanaToken;

let rawProjectId = (process.env.ASANA_PROJECT_ID || '').trim().replace(/^['"]|['"]$/g, '');
const matchProject = rawProjectId.match(/project\/(\d+)/);
if (matchProject) {
  rawProjectId = matchProject[1];
}
const ASANA_PROJECT_ID = rawProjectId;

if (!ASANA_TOKEN || !ASANA_PROJECT_ID) {
  console.error('❌ Erro: ASANA_ACCESS_TOKEN e ASANA_PROJECT_ID são obrigatórios no .env');
  process.exit(1);
}

const BASE_URL = 'https://app.asana.com/api/1.0';

async function asanaFetch(endpoint, options = {}) {
  const headers = {
    Authorization: `Bearer ${ASANA_TOKEN}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.errors ? JSON.stringify(data.errors) : `HTTP ${response.status}`;
    throw new Error(`Asana API Error: ${errorMsg}`);
  }
  return data;
}

// 1. Listar Webhooks Ativos
async function listarWebhooks() {
  console.log(`\n🔍 Consultando webhooks registrados para o projeto ${ASANA_PROJECT_ID}...`);
  const data = await asanaFetch(`/webhooks?workspace=${await getWorkspaceId()}&resource=${ASANA_PROJECT_ID}`);
  const list = data.data || [];

  if (list.length === 0) {
    console.log('ℹ️ Nenhum webhook ativo encontrado para este projeto.');
  } else {
    console.log(`✓ ${list.length} webhook(s) encontrado(s):`);
    list.forEach((w) => {
      console.log(`  • ID: ${w.gid} | Alvo: ${w.target} | Ativo: ${w.active ? '🟢 Sim' : '🔴 Não'}`);
    });
  }
  return list;
}

// 2. Registrar Novo Webhook
async function registrarWebhook(targetUrl) {
  if (!targetUrl || !targetUrl.startsWith('https://')) {
    console.error('❌ Erro: O targetUrl deve ser uma URL HTTPS pública válida.');
    console.error('   Exemplo: node scripts/register_asana_webhook.mjs --register https://meu-app.vercel.app/api/webhook-asana');
    process.exit(1);
  }

  console.log(`\n🚀 Registrando Webhook do Asana para o projeto ${ASANA_PROJECT_ID}...`);
  console.log(`   URL Alvo: ${targetUrl}`);
  console.log('   ⚠️ Nota: O endpoint de destino precisa responder ao Handshake do Asana (ecoando o header X-Hook-Secret).');

  const body = {
    data: {
      resource: ASANA_PROJECT_ID,
      target: targetUrl,
      filters: [
        { resource_type: 'task', action: 'added' },
        { resource_type: 'task', action: 'changed' },
        { resource_type: 'task', action: 'deleted' },
        { resource_type: 'story', action: 'added' },
      ],
    },
  };

  try {
    const result = await asanaFetch('/webhooks', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    console.log('\n🎉 Webhook registrado com sucesso no Asana!');
    console.log(`   • Webhook GID: ${result.data?.gid}`);
    console.log(`   • Alvo: ${result.data?.target}`);
    console.log(`   • Status: ${result.data?.active ? '🟢 Ativo' : 'Aguardando ativação'}`);
  } catch (err) {
    console.error('\n❌ Falha ao registrar webhook:', err.message);
    console.error('   💡 Certifique-se de que o seu endpoint está no ar e respondendo ao header X-Hook-Secret.');
  }
}

// 3. Deletar Webhook
async function deletarWebhook(webhookGid) {
  console.log(`\n🗑️ Removendo webhook ${webhookGid}...`);
  await asanaFetch(`/webhooks/${webhookGid}`, { method: 'DELETE' });
  console.log('✓ Webhook removido com sucesso!');
}

async function getWorkspaceId() {
  const project = await asanaFetch(`/projects/${ASANA_PROJECT_ID}`);
  return project.data?.workspace?.gid;
}

// CLI handler
const args = process.argv.slice(2);
const command = args[0] || '--list';

(async () => {
  try {
    if (command === '--list') {
      await listarWebhooks();
    } else if (command === '--register') {
      await registrarWebhook(args[1]);
    } else if (command === '--delete') {
      if (!args[1]) {
        console.error('❌ Informe o GID do webhook: --delete <GID>');
        process.exit(1);
      }
      await deletarWebhook(args[1]);
    } else {
      console.log('Uso:');
      console.log('  node scripts/register_asana_webhook.mjs --list');
      console.log('  node scripts/register_asana_webhook.mjs --register <URL_HTTPS>');
      console.log('  node scripts/register_asana_webhook.mjs --delete <WEBHOOK_GID>');
    }
  } catch (err) {
    console.error('Erro na execução:', err.message);
  }
})();
