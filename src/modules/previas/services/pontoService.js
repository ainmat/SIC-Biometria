/**
 * Serviço de importação do arquivo unificado de ponto biométrico.
 *
 * Grava diretamente em previas_frequencia e previas_publicadas,
 * as mesmas tabelas usadas pelo fluxo "Por Secretaria" / "Lote".
 *
 * Mapeamento do codigo_bruto (9 chars, ex: "033500020"):
 *   String(parseInt(codBruto, 10)).slice(0, 3) → "335" (atraso), "171" (falta), "504" (DSR)
 */

import { supabase } from '@/lib/supabase';

const CHUNK = 500;

async function batchInsert(tabela, rows, onProgress) {
  let inseridos = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(tabela).insert(batch);
    if (error) throw error;
    inseridos += batch.length;
    onProgress?.(inseridos, rows.length);
  }
  return inseridos;
}

function extrairCodigo(codBruto) {
  return String(parseInt(codBruto, 10)).slice(0, 3);
}

/**
 * Busca os servidores correspondentes às matrículas informadas via RPC server-side.
 */
export async function fetchMapaServidores(p_matriculas = []) {
  if (!p_matriculas || p_matriculas.length === 0) return new Map();
  const mapa = new Map();
  const CHUNK_SIZE = 1000;

  for (let i = 0; i < p_matriculas.length; i += CHUNK_SIZE) {
    const chunk = p_matriculas.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase.rpc('get_funcionarios_por_matriculas', {
      p_matriculas: chunk
    });
    if (error) throw error;
    (data || []).forEach(r => mapa.set(String(r.Matricula), r));
  }
  return mapa;
}

/**
 * Verifica se já existe importação para a competência.
 */
export async function verificarImportacaoExistente(competencia) {
  const [r1, r2] = await Promise.all([
    supabase.from('previas_frequencia').select('id', { count: 'exact', head: true }).eq('periodo_referencia', competencia),
    supabase.from('previas_publicadas').select('id', { count: 'exact', head: true }).eq('competencia', competencia),
  ]);
  return { marcacoes: r1.count ?? 0, totais: r2.count ?? 0 };
}

/**
 * Remove todos os registros da competência usando a RPC protegida por token.
 */
export async function deletarCompetenciaPonto(competencia, token) {
  const { error } = await supabase.rpc('deletar_competencia_ponto_rpc', {
    p_token: token,
    p_competencia: competencia,
  });
  if (error) throw error;
}

/**
 * Insere os registros Tipo 1 usando a RPC em lotes protegida por token.
 */
export async function inserirMarcacoes(tipo1, competencia, _arquivoOrigem, enriquecidosMap, token, onProgress) {
  const rows = tipo1
    .filter(r => enriquecidosMap.get(r.matricula)?.SiglaSec)
    .map(r => {
      const info = enriquecidosMap.get(r.matricula);
      return {
        secretaria_codigo:   info.SiglaSec,
        periodo_referencia:  competencia,
        matricula:           r.matricula,
        data_ocorrencia:     r.data,
        codigo_ocorrencia:   extrairCodigo(r.codigo),
        percentual_desconto: 0,
      };
    });

  let inseridos = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { data, error } = await supabase.rpc('inserir_marcacoes_batch_rpc', {
      p_token: token,
      p_rows: batch
    });
    if (error) throw error;
    inseridos += data;
    onProgress?.(inseridos, rows.length);
  }
  return inseridos;
}

/**
 * Calcula e grava resumos por secretaria usando a RPC consolidada protegida por token.
 */
export async function publicarResumosPorSecretaria(tipo1, competencia, enriquecidosMap, token) {
  const secStats = {};

  tipo1.forEach(r => {
    const info = enriquecidosMap.get(r.matricula);
    const sigla = info?.SiglaSec;
    if (!sigla) return;

    if (!secStats[sigla]) {
      secStats[sigla] = {
        secretaria_codigo: sigla,
        secretaria_nome:   info.Des_Secretaria || sigla,
        ocorrencias: 0, faltas: 0, atrasos: 0, matriculas: new Set(),
      };
    }
    const s = secStats[sigla];
    s.ocorrencias++;
    s.matriculas.add(r.matricula);
    const cod = extrairCodigo(r.codigo);
    if (cod === '171') s.faltas++;
    if (cod === '335') s.atrasos++;
  });

  const rows = Object.values(secStats).map(s => ({
    secretaria_codigo:     s.secretaria_codigo,
    secretaria_nome:       s.secretaria_nome,
    total_ocorrencias:     s.ocorrencias,
    total_faltas:          s.faltas,
    total_atrasos:         s.atrasos,
    servidores_impactados: s.matriculas.size,
  }));

  const { data, error } = await supabase.rpc('publicar_resumos_ponto_rpc', {
    p_token: token,
    p_competencia: competencia,
    p_rows: rows
  });
  if (error) throw error;

  return data;
}
