import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  let allData = [];
  let start = 0;
  const step = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('protocolo_digital')
      .select('id, numero_protocolo')
      .range(start, start + step - 1);

    if (error) {
      console.error(error);
      process.exit(1);
    }
    
    if (data && data.length > 0) {
      allData.push(...data);
      if (data.length < step) {
        hasMore = false;
      } else {
        start += step;
      }
    } else {
      hasMore = false;
    }
  }

  console.log('Total de registros puxados:', allData.length);

  const protocolosMap = new Map();
  const duplicados = [];
  
  allData.forEach(item => {
    if (protocolosMap.has(item.numero_protocolo)) {
      duplicados.push(item.numero_protocolo);
    } else {
      protocolosMap.set(item.numero_protocolo, true);
    }
  });

  console.log('Quantidade de protocolos únicos (pelo numero_protocolo):', protocolosMap.size);
  console.log('Quantidade de duplicatas detectadas:', duplicados.length);
  
  if (duplicados.length > 0) {
    console.log('Alguns números de protocolo duplicados:', duplicados.slice(0, 10));
  }
}

check();
