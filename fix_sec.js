import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { SECRETARIAS } from './src/lib/secretarias.js';
dotenv.config();

function limpar(sec) {
  if (!sec) return 'Outros';
  let s = String(sec).trim();
  const upper = s.toUpperCase();
  const matched = SECRETARIAS.find(x => 
     x.nome.toUpperCase() === upper || 
     x.sigla.toUpperCase() === upper ||
     x.nomesXLS.some(nx => nx === upper)
  );
  if (matched) return matched.nome;

  let semPrefixo = s.replace(/^(secretaria\s+de\s+|secretaria\s+do\s+|secretaria\s+da\s+|sec\.\s+de\s+|sec\s+de\s+)/i, '').trim();
  const upperSemPrefixo = semPrefixo.toUpperCase();
  const matched2 = SECRETARIAS.find(x => 
     x.nome.toUpperCase().includes(upperSemPrefixo) ||
     x.nomesXLS.some(nx => nx.includes(upperSemPrefixo))
  );
  if (matched2) return matched2.nome;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('protocolo_digital').select('id, secretaria');
  if (error) { console.error(error); return; }
  
  for (const d of data) {
    const novoNome = limpar(d.secretaria);
    if (novoNome !== d.secretaria) {
      console.log(`Updating ${d.secretaria} -> ${novoNome}`);
      await supabase.from('protocolo_digital').update({ secretaria: novoNome }).eq('id', d.id);
    }
  }
  console.log("Done");
}
run();
