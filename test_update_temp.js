import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iemysploewouodsoevyv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_XggfXmsdnywLlSXKiTl3_A_nTwAHa8Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testUpdate() {
  try {
    // Fetch one protocol
    const { data: list, error: fetchErr } = await supabase
      .from('protocolo_digital')
      .select('*')
      .limit(1);
      
    if (fetchErr) {
      console.error('Fetch error:', fetchErr);
      return;
    }
    
    if (!list || list.length === 0) {
      console.log('No protocols found');
      return;
    }
    
    const p = list[0];
    console.log('Original protocol:', p);
    
    const now = new Date().toISOString();
    const hojeData = now.split('T')[0];
    const novoHistorico = [
      ...(p.historico_tramitacao || []),
      { data: now, status: 'Concluído', observacao: 'Test update to Concluído.' }
    ];
    
    const { data: updated, error: updateErr } = await supabase
      .from('protocolo_digital')
      .update({
        status: 'Concluído',
        historico_tramitacao: novoHistorico,
        data_conclusao: hojeData,
        updated_at: now
      })
      .eq('id', p.id)
      .select();
      
    if (updateErr) {
      console.error('Update error:', updateErr);
    } else {
      console.log('Update success! Updated record:', updated);
      
      // Let's revert it back to 'Aberto' so we don't mess up their actual data
      const { data: reverted, error: revertErr } = await supabase
        .from('protocolo_digital')
        .update({
          status: p.status,
          historico_tramitacao: p.historico_tramitacao,
          data_conclusao: p.data_conclusao,
          updated_at: p.updated_at
        })
        .eq('id', p.id)
        .select();
        
      if (revertErr) {
        console.error('Revert error:', revertErr);
      } else {
        console.log('Reverted successfully');
      }
    }
  } catch (e) {
    console.error('Exception:', e);
  }
}

testUpdate();
