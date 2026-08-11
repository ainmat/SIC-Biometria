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
