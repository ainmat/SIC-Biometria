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
 * Busca todos os servidores de funcionarios_infos → Map<matricula, info>.
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
 * Remove todos os registros da competência de previas_frequencia e previas_publicadas.
 * ⚠️ Apaga TODAS as secretarias desta competência — só usar no fluxo unificado.
 */
export async function deletarCompetenciaPonto(competencia) {
  const [r1, r2] = await Promise.all([
    supabase.from('previas_frequencia').delete().eq('periodo_referencia', competencia),
    supabase.from('previas_publicadas').delete().eq('competencia', competencia),
  ]);
  if (r1.error) throw r1.error;
  if (r2.error) throw r2.error;
}

/**
 * Insere os registros Tipo 1 em previas_frequencia.
 * enriquecidosMap: Map<matricula, { SiglaSec, Des_Secretaria, ... }> — resultado do join.
 */
export async function inserirMarcacoes(tipo1, competencia, _arquivoOrigem, enriquecidosMap, onProgress) {
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
  return batchInsert('previas_frequencia', rows, onProgress);
}

/**
 * Calcula e grava resumos por secretaria em previas_publicadas.
 * Chamado após inserirMarcacoes para que o Histórico e o BI reflitam os dados.
 */
export async function publicarResumosPorSecretaria(tipo1, competencia, enriquecidosMap) {
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

  for (const s of Object.values(secStats)) {
    const { error } = await supabase
      .from('previas_publicadas')
      .upsert({
        secretaria_codigo:        s.secretaria_codigo,
        competencia,
        secretaria_nome:          s.secretaria_nome,
        total_ocorrencias:        s.ocorrencias,
        total_faltas:             s.faltas,
        total_atrasos:            s.atrasos,
        servidores_impactados:    s.matriculas.size,
        total_desconto_acumulado: 0,
        media_desconto:           0,
        z_score:                  null,
        classificacao_alerta:     'sem_historico',
      }, { onConflict: 'secretaria_codigo,competencia' });
    if (error) throw error;
  }

  return Object.keys(secStats).length;
}
