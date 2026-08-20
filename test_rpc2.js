import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'mateus.carvalho@osasco.sp.gov.br', // Just a guess for master? Or maybe I shouldn't guess
    password: 'password'
  });
  console.log(authData);
}
run();
