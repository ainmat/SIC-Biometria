/**
 * Serviço de persistência para o arquivo unificado de ponto biométrico.
 *
 * Tabelas necessárias no Supabase (criar antes de usar):
 * ─────────────────────────────────────────────────────
 *
 * CREATE TABLE ponto_previa_marcacoes (
 *   id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   matricula       TEXT NOT NULL,
 *   vinculo         TEXT NOT NULL,
 *   data            DATE NOT NULL,
 *   codigo_bruto    TEXT NOT NULL,   -- ⚠️ CONFIRMAR significado com setor de ponto
 *   competencia     TEXT NOT NULL,   -- YYYY-MM
 *   arquivo_origem  TEXT NOT NULL,
 *   importado_em    TIMESTAMPTZ DEFAULT now()
 * );
 * CREATE UNIQUE INDEX uq_marcacao ON ponto_previa_marcacoes (matricula, vinculo, data, competencia);
 * ALTER TABLE ponto_previa_marcacoes ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "anon_all" ON ponto_previa_marcacoes FOR ALL USING (true) WITH CHECK (true);
 *
 * CREATE TABLE ponto_previa_totais (
 *   id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   matricula       TEXT NOT NULL,
 *   vinculo         TEXT NOT NULL,
 *   codigo_bruto    TEXT NOT NULL,   -- ⚠️ CONFIRMAR: prefixo 0024, resto = valor acumulado?
 *   competencia     TEXT NOT NULL,   -- YYYY-MM
 *   arquivo_origem  TEXT NOT NULL,
 *   importado_em    TIMESTAMPTZ DEFAULT now()
 * );
 * CREATE UNIQUE INDEX uq_total ON ponto_previa_totais (matricula, vinculo, competencia);
 * ALTER TABLE ponto_previa_totais ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "anon_all" ON ponto_previa_totais FOR ALL USING (true) WITH CHECK (true);
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

/**
 * Busca todos os servidores de funcionarios_infos e retorna um Map<matricula_string, info>.
 * Usa paginação de 1000 para não exceder o limite do PostgREST.
 */
export async function fetchMapaServidores() {
  const campos = 'Matricula,Nome_Funcionario,Des_LocalTrab,Des_Secretaria,SiglaSec,Des_Cargo,Des_Horario';
  const mapa = new Map();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('funcionarios_infos')
      .select(campos)
      .range(from, from + 999);
    if (error) throw error;
    data.forEach(r => mapa.set(String(r.Matricula), r));
    if (data.length < 1000) break;
    from += 1000;
  }

  return mapa;
}

/**
 * Remove todos os registros de uma competência antes de reimportar.
 * ⚠️ CONFIRMAR política com o setor: substituir (padrão) vs acumular.
 */
export async function deletarCompetenciaPonto(competencia) {
  const [r1, r2] = await Promise.all([
    supabase.from('ponto_previa_marcacoes').delete().eq('competencia', competencia),
    supabase.from('ponto_previa_totais').delete().eq('competencia', competencia),
  ]);
  if (r1.error) throw r1.error;
  if (r2.error) throw r2.error;
}

/** Insere registros do Tipo 1 (marcações diárias) em lotes de 500. */
export async function inserirMarcacoes(tipo1, competencia, arquivoOrigem, onProgress) {
  const rows = tipo1.map(r => ({
    matricula:      r.matricula,
    vinculo:        r.vinculo,
    data:           r.data,
    codigo_bruto:   r.codigo,
    competencia,
    arquivo_origem: arquivoOrigem,
  }));
  return batchInsert('ponto_previa_marcacoes', rows, onProgress);
}

/** Insere registros do Tipo 2 (totais mensais) em lotes de 500. */
export async function inserirTotais(tipo2, competencia, arquivoOrigem) {
  const rows = tipo2.map(r => ({
    matricula:      r.matricula,
    vinculo:        r.vinculo,
    codigo_bruto:   r.codigo,
    competencia,
    arquivo_origem: arquivoOrigem,
  }));
  return batchInsert('ponto_previa_totais', rows);
}

/** Verifica se já existe importação para a competência (retorna { marcacoes, totais } contagens). */
export async function verificarImportacaoExistente(competencia) {
  const [r1, r2] = await Promise.all([
    supabase.from('ponto_previa_marcacoes').select('id', { count: 'exact', head: true }).eq('competencia', competencia),
    supabase.from('ponto_previa_totais').select('id', { count: 'exact', head: true }).eq('competencia', competencia),
  ]);
  return { marcacoes: r1.count ?? 0, totais: r2.count ?? 0 };
}
