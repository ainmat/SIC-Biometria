import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      || 'https://iemysploewouodsoevyv.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { params: { eventsPerSecond: 2 } },
});

export function sanitize(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

export async function fetchChamados() {
  const { data, error } = await supabase
    .from('chamados')
    .select('*')
    .order('ticket', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => {
    let sec = sanitize(r.secretaria);
    let und = sanitize(r.unidade);
    const mot = sanitize(r.motivo);
    
    // Se for problema de sistema e não tiver secretaria/unidade identificada, atribui à ADVANCIS
    const ehSistema = (mot === 'ESPELHO DE PONTO' || mot === 'CADASTRO');
    const isNaoId = (s) => !s || s.toUpperCase() === 'NÃO IDENTIFICADO' || s.toUpperCase() === 'NAO IDENTIFICADO' || s.toUpperCase() === 'N/I';
    
    if (ehSistema) {
      if (isNaoId(sec)) sec = 'ADVANCIS';
      if (isNaoId(und)) und = 'ADVANCIS';
    }

    return {
      ...r,
      ticket: sanitize(r.ticket),
      secretaria: sec,
      unidade: und,
      problema: sanitize(r.problema),
      responsavel: sanitize(r.responsavel),
    };
  });
}

export async function fetchEquipamentos() {
  const { data, error } = await supabase
    .from('equipamentos')
    .select('id, codigo, nome, ip_equipamento, secretaria, modulo, fabricante, endereco, cep, latitude, longitude')
    .order('codigo', { ascending: true });
  if (error) throw error;
  return data || [];
}

