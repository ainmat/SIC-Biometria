import { supabase } from '@/lib/supabase';

const COLS_RESUMO = [
  'Matricula','Nome_Funcionario','Sexo','Des_GrInstrucao',
  'Des_RegTrab','Des_CategSefip','Des_Padrao_Adm',
  'Des_Secretaria','SiglaSec','DtAdmissao','DtNomeacao',
  'Idade','Tempo_Contrato_Anos','Des_Cargo','Des_LocalTrab',
  'Des_Horario',
].join(',');

const COLS_LISTA = [
  'Matricula','Nome_Funcionario','Des_Cargo','Des_Secretaria',
  'SiglaSec','Des_LocalTrab','Des_RegTrab','Des_CategSefip',
  'Des_Padrao_Adm','DtAdmissao','Con','Pr',
].join(',');

// Cache de sessão — evita repetir 19 requisições ao navegar entre telas
let _resumoCache   = null;
let _resumoPromise = null;

export async function fetchResumoServidores() {
  if (_resumoCache) return _resumoCache;
  if (!_resumoPromise) {
    _resumoPromise = (async () => {
      try {
        const PAGE_SIZE = 1000;
        
        // 1. Pegar o total de registros (1 requisição rápida)
        const { count, error: countErr } = await supabase
          .from('funcionarios_infos')
          .select('*', { count: 'exact', head: true })
          .eq('ativo', true);
          
        if (countErr) throw countErr;
        if (!count || count === 0) return [];
        
        // 2. Criar um array de promessas para baixar tudo em paralelo
        const promises = [];
        for (let i = 0; i < count; i += PAGE_SIZE) {
          promises.push(
            supabase
              .from('funcionarios_infos')
              .select(COLS_RESUMO)
              .eq('ativo', true)
              .range(i, i + PAGE_SIZE - 1)
          );
        }
        
        // 3. Executar todas as requisições simultaneamente
        const results = await Promise.all(promises);
        
        let all = [];
        for (const res of results) {
          if (res.error) throw res.error;
          if (res.data) all = all.concat(res.data);
        }
        
        _resumoCache = all;
        return all;
      } catch (e) {
        _resumoPromise = null; // permite retry
        throw e;
      }
    })();
  }
  return _resumoPromise;
}

export async function fetchServidoresPaginado(filtros = {}, page = 0, perPage = 50) {
  const { busca = '', secretaria = '', regime = '', padrao = '' } = filtros;

  let q = supabase
    .from('funcionarios_infos')
    .select(COLS_LISTA, { count: 'exact' })
    .eq('ativo', true);

  if (busca.trim()) {
    const t = busca.trim();
    q = q.or(`Nome_Funcionario.ilike.%${t}%,Des_Cargo.ilike.%${t}%,Matricula.eq.${parseInt(t) || 0}`);
  }
  if (secretaria) q = q.eq('Des_Secretaria', secretaria);
  if (regime)     q = q.eq('Des_RegTrab', regime);
  if (padrao)     q = q.eq('Des_Padrao_Adm', padrao);

  q = q.order('Nome_Funcionario').range(page * perPage, (page + 1) * perPage - 1);

  const { data, count, error } = await q;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}

export async function fetchServidorDetalhe(matricula) {
  const { data, error } = await supabase
    .from('funcionarios_infos')
    .select('*')
    .eq('Matricula', matricula)
    .limit(1)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchOpcoesServidores() {
  const PAGE_SIZE = 1000;
  const sets = { Des_Secretaria: new Set(), Des_RegTrab: new Set(), Des_Padrao_Adm: new Set() };
  const { count } = await supabase
    .from('funcionarios_infos')
    .select('*', { count: 'exact', head: true })
    .eq('ativo', true);
    
  if (count) {
    const promises = [];
    for (let i = 0; i < count; i += PAGE_SIZE) {
      promises.push(
        supabase
          .from('funcionarios_infos')
          .select('Des_Secretaria,Des_RegTrab,Des_Padrao_Adm')
          .eq('ativo', true)
          .range(i, i + PAGE_SIZE - 1)
      );
    }
    
    const results = await Promise.all(promises);
    for (const res of results) {
      if (res.data) {
        for (const r of res.data) {
          if (r.Des_Secretaria) sets.Des_Secretaria.add(r.Des_Secretaria);
          if (r.Des_RegTrab)    sets.Des_RegTrab.add(r.Des_RegTrab);
          if (r.Des_Padrao_Adm) sets.Des_Padrao_Adm.add(r.Des_Padrao_Adm);
        }
      }
    }
  }
  return {
    secretarias: [...sets.Des_Secretaria].sort(),
    regimes:     [...sets.Des_RegTrab].sort(),
    padroes:     [...sets.Des_Padrao_Adm].sort(),
  };
}

import fallbackLiderancasSS from '../data/Lideranca_SS.json';

/**
 * Busca o quadro de lideranças da Secretaria de Saúde na tabela Lideranca_SS do Supabase
 * Caso a tabela esteja vazia ou ocorra erro de conexão/RLS, utiliza a base de dados correta Lideranca_SS.json
 */
export async function fetchLiderancasSS() {
  try {
    let { data, error } = await supabase.from('Lideranca_SS').select('*');
    if (error || !data || data.length === 0) {
      const res2 = await supabase.from('Lideraca_SS').select('*');
      if (!res2.error && res2.data && res2.data.length > 0) {
        data = res2.data;
      }
    }

    if (data && data.length > 0) {
      return data.map((row, idx) => {
        const cargo = row['Descrição Cargo'] || row['Descricao_Cargo'] || row['Cargo'] || row['cargo'] || '';
        const nome = row['Nome Funcionário'] || row['Nome_Funcionario'] || row['Nome'] || row['nome'] || '';
        const local = row['Descrição Local Trabalho'] || row['Descricao_LocalTrab'] || row['localTrabalho'] || '';
        const sigla = row['Sigla Cargo'] || row['Sigla_Cargo'] || row['siglaCargo'] || '';
        const matricula = row['Matrícula'] || row['Matricula'] || row['matricula'] || '';
        const situacao = row['Situação'] || row['Situacao'] || row['situacao'] || 'Normal';
        const padrao = row['Símbolo Padrão Salário'] || row['Simbolo_Padrao_Salario'] || row['padrao'] || '';
        const vinculo = row['Descrição Categoria Funcional'] || row['vinculo'] || '';
        const cpf = row['CPF'] || row['cpf'] || '';
        const regime = row['Regime Trabalho'] || row['regime'] || '';
        const admissao = row['Data Admissão'] || row['admissao'] || '';

        let roleCategory = 'SUPERVISOR';
        if (/SECRET[ÁA]RIO|CHEFE\s+DE\s+GABINETE/i.test(cargo)) roleCategory = 'GABINETE';
        else if (/DIRETOR/i.test(cargo)) roleCategory = 'DIRETOR';
        else if (/GERENTE/i.test(cargo)) roleCategory = 'GERENTE';
        else if (/SUPERVISOR|SUPERVISAO/i.test(cargo)) roleCategory = 'SUPERVISOR';

        const mLocal = local.match(/(58[-\d.]+)/);
        const mSigla = sigla.match(/(58[-\d.]+)/);
        const unitCode = mSigla ? mSigla[1].split('.')[0] : (mLocal ? mLocal[1] : '58-0-0-0-0');

        return {
          id: `lead_${idx + 1}_${matricula}`,
          matricula,
          cpf,
          nome,
          cargo,
          roleCategory,
          unitCode,
          localTrabalho: local,
          siglaCargo: sigla,
          situacao,
          vinculo,
          padrao,
          regime,
          admissao,
          raw: row,
        };
      });
    }
  } catch (e) {
    console.warn('Aviso: Utilizando base Lideranca_SS:', e);
  }

  return fallbackLiderancasSS;
}

