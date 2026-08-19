import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('protocolo_digital').select('secretaria');
  if (error) { console.error(error); return; }
  const secs = new Set(data.map(d => d.secretaria));
  console.log(Array.from(secs));
}
run();
