import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente do arquivo .env
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://iemysploewouodsoevyv.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_XggfXmsdnywLlSXKiTl3_A_nTwAHa8Y';
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_API_KEY) {
  console.error('❌ ERRO: A chave GOOGLE_MAPS_API_KEY não foi encontrada no arquivo .env.');
  console.error('Por favor, adicione-a antes de rodar o script.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log('Buscando equipamentos no banco de dados...');
  // Busca apenas os que ainda não têm latitude (para poder rodar o script novamente se parar no meio)
  const { data: equipamentos, error } = await supabase
    .from('equipamentos')
    .select('id, nome, endereco, cep')
    .filter('latitude', 'is', 'null');

  if (error) {
    console.error('Erro ao buscar:', error);
    return;
  }

  console.log(`Encontrados ${equipamentos.length} equipamentos sem coordenadas. Iniciando geocodificação...`);
  
  let successCount = 0;
  
  for (const eq of equipamentos) {
    if (!eq.endereco) continue;

    const searchQuery = `${eq.endereco}, Osasco, SP, ${eq.cep || ''}`;
    
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${GOOGLE_API_KEY}`);
      
      const results = await response.json();
      
      if (results.status === 'OK' && results.results.length > 0) {
        const location = results.results[0].geometry.location;
        const lat = location.lat;
        const lon = location.lng;
        
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
        console.log(`⚠️ Não encontrado: ${eq.nome} - Motivo: ${results.status}`);
      }
      
    } catch (err) {
      console.error(`Erro de rede ao buscar ${eq.nome}:`, err.message);
    }
    
    // O Google permite muito mais requisições, mas 200ms é seguro
    await sleep(200); 
  }
  
  console.log(`\n🎉 Geocodificação finalizada! ${successCount} equipamentos foram atualizados com sucesso.`);
}

main();
