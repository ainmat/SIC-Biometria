import { supabase } from '@/lib/supabase';

const BATCH = 100;
const MAX_ROWS = 100000;

export async function upsertFolha(registros, token, onProgress) {
  let processados = 0;

  for (let i = 0; i < registros.length; i += BATCH) {
    const lote = registros.slice(i, i + BATCH);
    const { data, error } = await supabase.rpc('inserir_folha_batch_rpc', {
      p_token: token,
      p_rows:  lote,
    });
    if (error) throw error;

    processados += data;
    onProgress && onProgress(Math.round((processados / registros.length) * 100));

    await new Promise(r => setTimeout(r, 0));
  }

  return { processados };
}

// P05 — verifica se já existe dados para uma competência (retorna contagem)
export async function verificarCompetenciaExistente(competencia) {
  const { count, error } = await supabase
    .from('folha_previas')
    .select('*', { count: 'exact', head: true })
    .eq('competencia', competencia);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchCompetencias() {
  const { data, error } = await supabase.rpc('get_competencias_folha');
  if (error) throw error;
  return (data || []).map(r => r.competencia);
}

export async function fetchFolhaRanking({ competencia, secretaria = null, unidade = null } = {}) {
  if (!competencia) return [];
  const { data, error } = await supabase.rpc('get_folha_ranking', {
    p_competencia: competencia,
    p_secretaria:  secretaria || null,
    p_unidade:     unidade    || null,
  });
  if (error) throw error;
  return (data || []).map(r => ({
    ...r,
    servidores:       Number(r.servidores       || 0),
    faltas:           Number(r.faltas           || 0),
    atrasos_fracao:   Number(r.atrasos_fracao   || 0),
    atrasos_dia:      Number(r.atrasos_dia      || 0),
    dsr:              Number(r.dsr              || 0),
    hora_extra_50:    Number(r.hora_extra_50    || 0),
    hora_extra_100:   Number(r.hora_extra_100   || 0),
    adicional_noturno:Number(r.adicional_noturno|| 0),
  }));
}

export async function fetchSecretariasDaCompetencia(competencia) {
  const { data, error } = await supabase
    .from('folha_previas')
    .select('secretaria_sigla, secretaria')
    .eq('competencia', competencia)
    .limit(MAX_ROWS);
  if (error) throw error;

  const uniq = {};
  (data || []).forEach(r => {
    if (r.secretaria_sigla && !uniq[r.secretaria_sigla]) {
      uniq[r.secretaria_sigla] = r.secretaria;
    }
  });
  return Object.entries(uniq)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sigla, nome]) => ({ sigla, nome }));
}

export async function fetchUnidadesDaCompetencia(competencia, secretaria = null) {
  let q = supabase
    .from('folha_previas')
    .select('unidade')
    .eq('competencia', competencia)
    .limit(MAX_ROWS);
  if (secretaria) q = q.eq('secretaria_sigla', secretaria);
  const { data, error } = await q;
  if (error) throw error;
  return [...new Set((data || []).map(r => r.unidade).filter(Boolean))].sort();
}

export async function fetchEvolucaoUnidade(unidade) {
  const { data, error } = await supabase
    .from('folha_previas')
    .select('competencia, faltas, atrasos_fracao, atrasos_dia, dsr, hora_extra_50, hora_extra_100')
    .eq('unidade', unidade)
    .order('competencia', { ascending: true })
    .limit(MAX_ROWS);
  if (error) throw error;

  const map = {};
  (data || []).forEach(r => {
    const k = r.competencia;
    if (!map[k]) map[k] = {
      competencia: k, servidores: 0,
      faltas: 0, atrasos_fracao: 0, atrasos_dia: 0,
      dsr: 0, hora_extra_50: 0, hora_extra_100: 0,
    };
    map[k].servidores++;
    map[k].faltas         += Number(r.faltas         || 0);
    map[k].atrasos_fracao += Number(r.atrasos_fracao || 0);
    map[k].atrasos_dia    += Number(r.atrasos_dia    || 0);
    map[k].dsr            += Number(r.dsr            || 0);
    map[k].hora_extra_50  += Number(r.hora_extra_50  || 0);
    map[k].hora_extra_100 += Number(r.hora_extra_100 || 0);
  });
  return Object.values(map).sort((a, b) => a.competencia.localeCompare(b.competencia));
}

// P09 — histórico longitudinal de um servidor específico
export async function fetchEvolucaoServidor(matricula) {
  const { data, error } = await supabase
    .from('folha_previas')
    .select('competencia, faltas, atrasos_fracao, atrasos_dia, dsr, hora_extra_50, hora_extra_100, adicional_noturno, unidade, secretaria_sigla')
    .eq('matricula', matricula)
    .order('competencia', { ascending: true })
    .limit(36);
  if (error) throw error;
  return (data || []).map(r => ({
    ...r,
    faltas:            Number(r.faltas            || 0),
    atrasos_fracao:    Number(r.atrasos_fracao    || 0),
    atrasos_dia:       Number(r.atrasos_dia       || 0),
    dsr:               Number(r.dsr               || 0),
    hora_extra_50:     Number(r.hora_extra_50     || 0),
    hora_extra_100:    Number(r.hora_extra_100    || 0),
    adicional_noturno: Number(r.adicional_noturno || 0),
    totalDesconto:     Number(r.faltas||0) + Number(r.atrasos_dia||0) + Number(r.atrasos_fracao||0) * 0.333 + Number(r.dsr||0),
  }));
}

export async function fetchComparativoGeral(competencias) {
  const { data, error } = await supabase.rpc('get_comparativo_geral', { p_competencias: competencias });
  if (error) throw error;
  const map = {};
  (data || []).forEach(r => {
    map[r.competencia] = {
      servidores:     Number(r.servidores     || 0),
      faltas:         Number(r.faltas         || 0),
      atrasos_fracao: Number(r.atrasos_fracao || 0),
      atrasos_dia:    Number(r.atrasos_dia    || 0),
      dsr:            Number(r.dsr            || 0),
      hora_extra_50:  Number(r.hora_extra_50  || 0),
      hora_extra_100: Number(r.hora_extra_100 || 0),
    };
  });
  return map;
}

export async function fetchComparativoSecretaria(competencias) {
  const { data, error } = await supabase.rpc('get_comparativo_secretaria', { p_competencias: competencias });
  if (error) throw error;
  const map = {};
  (data || []).forEach(r => {
    const sec = r.secretaria_sigla;
    if (!map[sec]) map[sec] = {};
    map[sec][r.competencia] = {
      servidores:     Number(r.servidores     || 0),
      faltas:         Number(r.faltas         || 0),
      atrasos_fracao: Number(r.atrasos_fracao || 0),
      atrasos_dia:    Number(r.atrasos_dia    || 0),
      dsr:            Number(r.dsr            || 0),
      hora_extra_50:  Number(r.hora_extra_50  || 0),
      hora_extra_100: Number(r.hora_extra_100 || 0),
    };
  });
  return map;
}

export async function fetchComparativoUnidade(competencias, secretaria = null) {
  const { data, error } = await supabase.rpc('get_comparativo_unidade', {
    p_competencias: competencias,
    p_secretaria:   secretaria,
  });
  if (error) throw error;
  const map = {};
  (data || []).forEach(r => {
    const key = r.unidade;
    if (!map[key]) map[key] = {};
    map[key][r.competencia] = {
      servidores:     Number(r.servidores     || 0),
      faltas:         Number(r.faltas         || 0),
      atrasos_fracao: Number(r.atrasos_fracao || 0),
      atrasos_dia:    Number(r.atrasos_dia    || 0),
      dsr:            Number(r.dsr            || 0),
      hora_extra_50:  Number(r.hora_extra_50  || 0),
      hora_extra_100: Number(r.hora_extra_100 || 0),
    };
  });
  return map;
}

export async function fetchServidoresDaUnidade(competencia, unidade) {
  const { data, error } = await supabase
    .from('folha_previas')
    .select('*')
    .eq('competencia', competencia)
    .eq('unidade', unidade)
    .order('nome')
    .limit(5000);
  if (error) throw error;
  return data || [];
}

export async function fetchServidoresDaCompetencia(competencia) {
  const { data, error } = await supabase
    .from('folha_previas')
    .select('*')
    .eq('competencia', competencia)
    .order('nome')
    .limit(15000);
  if (error) throw error;
  return data || [];
}

// P07 — Conferência Biômetro × Folha
export async function listarFolhasImportadas() {
  const { data, error } = await supabase.rpc('get_competencias_folha');
  if (error) throw error;
  const competencias = (data || []).map(r => r.competencia);
  if (competencias.length === 0) return [];
  const counts = await Promise.all(competencias.map(c => verificarCompetenciaExistente(c)));
  return competencias
    .map((c, i) => ({ competencia: c, total: counts[i] }))
    .sort((a, b) => b.competencia.localeCompare(a.competencia));
}

export async function deletarFolha(competencia, token) {
  const { error } = await supabase.rpc('deletar_folha_rpc', {
    p_token: token,
    p_competencia: competencia,
  });
  if (error) throw error;
}

export async function fetchConferencia({ competencia, secretaria = null }) {
  if (!competencia) return [];
  const { data, error } = await supabase
    .rpc('get_conferencia_biometria_folha', {
      p_competencia: competencia,
      p_secretaria:  secretaria || null,
    })
    .limit(MAX_ROWS);
  if (error) throw error;
  return (data || []).map(r => ({
    ...r,
    faltas_ponto:         Number(r.faltas_ponto         || 0),
    atrasos_ponto:        Number(r.atrasos_ponto        || 0),
    faltas_folha:         Number(r.faltas_folha         || 0),
    atrasos_fracao_folha: Number(r.atrasos_fracao_folha || 0),
    atrasos_dia_folha:    Number(r.atrasos_dia_folha    || 0),
  }));
}

export async function fetchFolhaDescontos(competencia) {
  if (!competencia) return [];
  const { data, error } = await supabase
    .from('folha_previas')
    .select('unidade, matricula, nome, faltas, atrasos_fracao, atrasos_dia, dsr, secretaria_sigla')
    .eq('competencia', competencia)
    .or('faltas.gt.0,atrasos_fracao.gt.0,atrasos_dia.gt.0,dsr.gt.0')
    .limit(MAX_ROWS);
  if (error) throw error;
  
  return (data || []).map(r => ({
    ...r,
    faltas: Number(r.faltas || 0),
    atrasos_fracao: Number(r.atrasos_fracao || 0),
    atrasos_dia: Number(r.atrasos_dia || 0),
    dsr: Number(r.dsr || 0),
    totalOcorrencias: Number(r.faltas || 0) + Number(r.atrasos_fracao || 0) + Number(r.atrasos_dia || 0)
  }));
}
