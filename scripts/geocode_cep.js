import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://iemysploewouodsoevyv.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XggfXmsdnywLlSXKiTl3_A_nTwAHa8Y';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('Buscando equipamentos no banco de dados...');
  const { data: equipamentos, error } = await supabase
    .from('equipamentos')
    .select('id, nome, cep')
    .filter('latitude', 'is', 'null');

  if (error) {
    console.error('Erro ao buscar:', error);
    return;
  }

  console.log(`Encontrados ${equipamentos.length} equipamentos sem coordenadas. Iniciando geocodificação via CEP...`);
  
  let successCount = 0;
  
  for (const eq of equipamentos) {
    if (!eq.cep) continue;

    // Limpar o CEP (remover traços e espaços)
    const cleanCep = eq.cep.replace(/\D/g, '');
    
    if (cleanCep.length !== 8) {
      console.log(`⚠️ CEP inválido para ${eq.nome}: ${eq.cep}`);
      continue;
    }

    try {
      // Usando a AwesomeAPI que retorna latitude e longitude de graça pelo CEP!
      const response = await fetch(`https://cep.awesomeapi.com.br/json/${cleanCep}`);
      
      if (response.ok) {
        const results = await response.json();
        
        if (results.lat && results.lng) {
          const lat = parseFloat(results.lat);
          const lon = parseFloat(results.lng);
          
          const { error: updateError } = await supabase
            .from('equipamentos')
            .update({ latitude: lat, longitude: lon })
            .eq('id', eq.id);
            
          if (updateError) {
            console.error(`❌ Erro ao atualizar ${eq.nome}:`, updateError.message);
          } else {
            console.log(`✅ [${successCount+1}] Sucesso: ${eq.nome} -> Lat: ${lat}, Lng: ${lon}`);
            successCount++;
          }
        } else {
           console.log(`⚠️ CEP encontrado, mas sem coordenadas para: ${eq.nome} (${eq.cep})`);
        }
      } else {
        console.log(`⚠️ CEP não encontrado: ${eq.nome} (${eq.cep})`);
      }
      
    } catch (err) {
      console.error(`Erro de rede ao buscar ${eq.nome}:`, err.message);
    }
    
    // A API pede pra não sobrecarregar
    await sleep(300); 
  }
  
  console.log(`\n🎉 Geocodificação finalizada! ${successCount} equipamentos foram atualizados com sucesso.`);
}

main();
