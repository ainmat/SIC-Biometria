import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function / API Endpoint para Webhook do Asana
export default async function handler(req, res) {
  // 1. Handshake do Asana:
  // Ao registrar o webhook, o Asana envia um GET/POST com o header X-Hook-Secret.
  // Devemos ecoar esse header com status 200 para confirmar o webhook.
  const hookSecret = req.headers['x-hook-secret'];
  if (hookSecret) {
    console.log('🤝 Handshake do Asana recebido com sucesso!');
    res.setHeader('X-Hook-Secret', hookSecret);
    return res.status(200).send('');
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok', message: 'Endpoint do Webhook Asana ativo' });
  }

  try {
    const events = req.body?.events || [];
    console.log(`⚡ Webhook Asana: ${events.length} evento(s) recebido(s).`);

    if (events.length > 0) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Registra o evento recebido na tabela configuracoes
        await supabase.from('configuracoes').upsert({
          chave: 'ultimo_webhook_asana',
          valor: JSON.stringify({
            timestamp: new Date().toISOString(),
            total_eventos: events.length,
            eventos: events.slice(0, 5).map((e) => ({
              acao: e.action,
              tipo: e.resource?.resource_type,
              gid: e.resource?.gid,
            })),
          }),
          descricao: 'Metadados do último evento recebido em tempo real via Webhook do Asana',
        });
      }
    }

    return res.status(200).json({ success: true, processed: events.length });
  } catch (error) {
    console.error('❌ Erro ao processar webhook do Asana:', error);
    return res.status(500).json({ error: error.message });
  }
}
