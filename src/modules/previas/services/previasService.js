import { supabase } from '@/lib/supabase';
import { CODIGO_FALTA, CODIGO_ATRASO } from '@/modules/previas/utils/analise';

const BATCH_SIZE = 500;

// P12 — Registra operação no audit_log (fire-and-forget)
async function logAudit(operacao, dados = {}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('audit_log').insert({
      operacao,
      tabela_alvo:      dados.tabela   ?? null,
      competencia:      dados.periodo  ?? null,
      secretaria:       dados.secretaria ?? null,
      registros_afetados: dados.registros ?? null,
      usuario_email:    user?.email ?? 'anonimo',
    });
  } catch {}
}

// P11 — Busca histórico de secretaria via RPC (agregação no banco)
export async function fetchHistoricoSecretaria(secretariaCodigo, periodoExcluir = null) {
  const { data, error } = await supabase.rpc('get_historico_secretaria', {
    p_secretaria:       secretariaCodigo,
    p_periodo_excluir:  periodoExcluir || null,
  });

  // Fallback para query direta se a RPC não existir ainda
  if (error?.code === 'PGRST202' || error?.message?.includes('function') || error?.code === '42883') {
    return _fetchHistoricoSecretariaLegado(secretariaCodigo, periodoExcluir);
  }
  if (error) throw error;

  return (data || []).map(r => ({
    periodo_referencia:  r.periodo_referencia,
    total_ocorrencias:   Number(r.total_ocorrencias   || 0),
    total_faltas:        Number(r.total_faltas        || 0),
    total_atrasos:       Number(r.total_atrasos       || 0),
    servidores_afetados: Number(r.servidores_afetados || 0),
    desconto_total:      Number(r.desconto_total      || 0),
  }));
}

async function _fetchHistoricoSecretariaLegado(secretariaCodigo, periodoExcluir) {
  let query = supabase
    .from('previas_frequencia')
    .select('periodo_referencia, matricula, codigo_ocorrencia, percentual_desconto')
    .eq('secretaria_codigo', secretariaCodigo);

  if (periodoExcluir) query = query.lt('periodo_referencia', periodoExcluir);

  const { data, error } = await query;
  if (error) throw error;

  const porPeriodo = {};
  (data || []).forEach(r => {
    if (!porPeriodo[r.periodo_referencia]) {
      porPeriodo[r.periodo_referencia] = { matriculas: new Set(), total: 0, faltas: 0, atrasos: 0, desconto: 0 };
    }
    const p = porPeriodo[r.periodo_referencia];
    p.total++;
    p.matriculas.add(r.matricula);
    p.desconto += r.percentual_desconto || 0;
    if (r.codigo_ocorrencia === CODIGO_FALTA)  p.faltas++;
    if (r.codigo_ocorrencia === CODIGO_ATRASO) p.atrasos++;
  });

  return Object.entries(porPeriodo)
    .map(([periodo, s]) => ({
      periodo_referencia:  periodo,
      total_ocorrencias:   s.total,
      total_faltas:        s.faltas,
      total_atrasos:       s.atrasos,
      servidores_afetados: s.matriculas.size,
      desconto_total:      s.desconto,
    }))
    .sort((a, b) => b.periodo_referencia.localeCompare(a.periodo_referencia));
}

export async function verificarPublicacaoExistente(secretariaCodigo, competencia) {
  const { count, error } = await supabase
    .from('previas_publicadas')
    .select('id', { count: 'exact', head: true })
    .eq('secretaria_codigo', secretariaCodigo)
    .eq('competencia', competencia);
  if (error) throw error;
  return (count || 0) > 0;
}

// P03 — Publicação atômica via RPC (com fallback para query legada)
export async function publicarPrevia({ secretariaCodigo, secretariaNome, competencia, registros, analise }) {
  const servidores    = new Set(registros.map(r => r.matricula)).size;
  const descontoTotal = registros.reduce((s, r) => s + (r.percentual_desconto || 0), 0);
  const mediaDesconto = registros.length ? descontoTotal / registros.length : 0;
  const totalFaltas   = registros.filter(r => r.codigo_ocorrencia === CODIGO_FALTA).length;
  const totalAtrasos  = registros.filter(r => r.codigo_ocorrencia === CODIGO_ATRASO).length;

  const metadados = {
    secretaria_nome:          secretariaNome,
    total_ocorrencias:        registros.length,
    total_faltas:             totalFaltas,
    total_atrasos:            totalAtrasos,
    servidores_impactados:    servidores,
    total_desconto_acumulado: descontoTotal,
    media_desconto:           Math.round(mediaDesconto * 100) / 100,
    z_score:                  analise?.zScore ?? null,
    classificacao_alerta:     analise?.classificacao ?? 'sem_historico',
  };

  // Tenta a RPC atômica primeiro
  const registrosJSON = registros.map(r => ({
    matricula:           r.matricula,
    data_ocorrencia:     r.data_ocorrencia   || null,
    codigo_ocorrencia:   r.codigo_ocorrencia || null,
    percentual_desconto: r.percentual_desconto || 0,
  }));

  const { error: rpcErr } = await supabase.rpc('republica_previa', {
    p_secretaria_codigo:  secretariaCodigo,
    p_periodo_referencia: competencia,
    p_registros:          registrosJSON,
    p_metadados:          metadados,
  });

  if (rpcErr?.code === 'PGRST202' || rpcErr?.message?.includes('function') || rpcErr?.code === '42883') {
    // Fallback: DELETE + INSERT separados (sem atomicidade)
    await _publicarPreviaLegado({ secretariaCodigo, secretariaNome, competencia, registros, metadados });
  } else if (rpcErr) {
    throw rpcErr;
  }

  await logAudit('publicar_previa', {
    secretaria: secretariaCodigo,
    periodo:    competencia,
    registros:  registros.length,
  });

  return true;
}

async function _publicarPreviaLegado({ secretariaCodigo, competencia, registros, metadados }) {
  const { error: delErr } = await supabase
    .from('previas_frequencia')
    .delete()
    .eq('secretaria_codigo', secretariaCodigo)
    .eq('periodo_referencia', competencia);
  if (delErr) throw delErr;

  for (let i = 0; i < registros.length; i += BATCH_SIZE) {
    const lote = registros.slice(i, i + BATCH_SIZE).map(r => ({
      secretaria_codigo:   secretariaCodigo,
      periodo_referencia:  competencia,
      matricula:           r.matricula,
      data_ocorrencia:     r.data_ocorrencia || null,
      codigo_ocorrencia:   r.codigo_ocorrencia || null,
      percentual_desconto: r.percentual_desconto || 0,
    }));
    const { error } = await supabase.from('previas_frequencia').insert(lote);
    if (error) throw error;
  }

  const { error: pubErr } = await supabase
    .from('previas_publicadas')
    .upsert(
      { secretaria_codigo: secretariaCodigo, competencia, ...metadados },
      { onConflict: 'secretaria_codigo,competencia' }
    );
  if (pubErr) throw pubErr;
}

export async function fetchPublicadas({ secretaria, de, ate } = {}) {
  let query = supabase
    .from('previas_publicadas')
    .select('*')
    .order('competencia', { ascending: false });

  if (secretaria) query = query.eq('secretaria_codigo', secretaria);
  if (de)         query = query.gte('competencia', de);
  if (ate)        query = query.lte('competencia', ate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchBIPublicadas() {
  const { data, error } = await supabase
    .from('previas_publicadas')
    .select('*')
    .order('competencia', { ascending: true });
  if (error) throw error;
  return data || [];
}

// P11 — Top matrículas via RPC
export async function fetchTopMatriculas(limite = 10, secretariaCodigo = null) {
  const { data, error } = await supabase.rpc('get_top_matriculas', {
    p_limite:     limite,
    p_secretaria: secretariaCodigo || null,
  });

  if (error?.code === 'PGRST202' || error?.message?.includes('function') || error?.code === '42883') {
    return _fetchTopMatriculasLegado(limite, secretariaCodigo);
  }
  if (error) throw error;
  return data || [];
}

async function _fetchTopMatriculasLegado(limite, secretariaCodigo) {
  let query = supabase
    .from('previas_frequencia')
    .select('matricula, secretaria_codigo, percentual_desconto');
  if (secretariaCodigo) query = query.eq('secretaria_codigo', secretariaCodigo);
  const { data, error } = await query;
  if (error) throw error;

  const mapa = {};
  (data || []).forEach(r => {
    if (!mapa[r.matricula]) mapa[r.matricula] = { matricula: r.matricula, ocorrencias: 0, desconto: 0 };
    mapa[r.matricula].ocorrencias++;
    mapa[r.matricula].desconto += r.percentual_desconto || 0;
  });
  return Object.values(mapa).sort((a, b) => b.ocorrencias - a.ocorrencias).slice(0, limite);
}

// P11 — Evolução mensal via RPC
export async function fetchEvolucaoMensal() {
  const { data, error } = await supabase.rpc('get_evolucao_mensal');

  if (error?.code === 'PGRST202' || error?.message?.includes('function') || error?.code === '42883') {
    return _fetchEvolucaoMensalLegado();
  }
  if (error) throw error;

  return (data || []).map(r => ({
    periodo_referencia:  r.periodo_referencia,
    total_ocorrencias:   Number(r.total_ocorrencias   || 0),
    servidores_afetados: Number(r.servidores_afetados || 0),
    desconto_total:      Number(r.desconto_total      || 0),
  }));
}

async function _fetchEvolucaoMensalLegado() {
  const { data, error } = await supabase
    .from('previas_frequencia')
    .select('periodo_referencia, matricula, percentual_desconto');
  if (error) throw error;

  const porMes = {};
  (data || []).forEach(r => {
    if (!porMes[r.periodo_referencia]) {
      porMes[r.periodo_referencia] = { ocorrencias: 0, matriculas: new Set(), desconto: 0 };
    }
    porMes[r.periodo_referencia].ocorrencias++;
    porMes[r.periodo_referencia].matriculas.add(r.matricula);
    porMes[r.periodo_referencia].desconto += r.percentual_desconto || 0;
  });

  return Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, s]) => ({
      periodo_referencia:  periodo,
      total_ocorrencias:   s.ocorrencias,
      servidores_afetados: s.matriculas.size,
      desconto_total:      s.desconto,
    }));
}
