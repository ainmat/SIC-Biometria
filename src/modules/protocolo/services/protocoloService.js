import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'sic_biometria_protocolos';

function obterToken() {
  try {
    const s = sessionStorage.getItem('sic_sessao');
    return s ? JSON.parse(s)?.token : null;
  } catch {
    return null;
  }
}

// Dados simulados iniciais para quando o Supabase não tiver a tabela
const MOCK_PROTOCOLOS = [
  {
    id: 1,
    numero_protocolo: 'PROT-2026-0001',
    requerente_nome: 'Mariana Silva Costa',
    requerente_matricula: '102030',
    secretaria: 'Saúde',
    tipo_solicitacao: 'Abono de Faltas - Atestado Médico',
    descricao: 'Solicito abono do dia 20/07/2026 devido a consulta médica conforme atestado médico em anexo.',
    status: 'Concluído',
    prioridade: 'Normal',
    responsavel: 'Mateus Carvalho',
    data_conclusao: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    data_abertura: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    prazo_estimado: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    historico_tramitacao: [
      { data: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), status: 'Aberto', observacao: 'Protocolo aberto pelo servidor' },
      { data: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), status: 'Em Análise', observacao: 'Documentação encaminhada para perícia médica' },
      { data: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), status: 'Concluído', observacao: 'Falta abonada de acordo com parecer médico favorável' }
    ],
    documento_anexo: 'atestado_medico_mariana.pdf'
  },
  {
    id: 2,
    numero_protocolo: 'PROT-2026-0002',
    requerente_nome: 'Carlos Eduardo Alves',
    requerente_matricula: '405060',
    secretaria: 'Educação',
    tipo_solicitacao: 'Retificação de Batida de Ponto',
    descricao: 'Esquecimento de registro na saída do dia 21/07/2026. Solicito inclusão manual.',
    status: 'Em Análise',
    prioridade: 'Normal',
    responsavel: 'Cassia Fernanda',
    data_conclusao: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    data_abertura: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    prazo_estimado: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    historico_tramitacao: [
      { data: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), status: 'Aberto', observacao: 'Solicitação criada' },
      { data: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), status: 'Em Análise', observacao: 'Aguardando assinatura da chefia imediata no espelho físico' }
    ],
    documento_anexo: 'espelho_assinatura_carlos.jpg'
  },
  {
    id: 3,
    numero_protocolo: 'PROT-2026-0003',
    requerente_nome: 'Roberto Souza Santos',
    requerente_matricula: '708090',
    secretaria: 'Administração',
    tipo_solicitacao: 'Solicitação de Acesso Biométrico',
    descricao: 'Solicito liberação de acesso biométrico para as dependências da nova subprefeitura.',
    status: 'Aberto',
    prioridade: 'Alta',
    responsavel: null,
    data_conclusao: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    data_abertura: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    prazo_estimado: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    historico_tramitacao: [
      { data: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), status: 'Aberto', observacao: 'Protocolo gerado e distribuído à TI' }
    ],
    documento_anexo: null
  },
  {
    id: 4,
    numero_protocolo: 'PROT-2026-0004',
    requerente_nome: 'Ana Paula Oliveira',
    requerente_matricula: '258369',
    secretaria: 'Educação',
    tipo_solicitacao: 'Licença Prêmio',
    descricao: 'Requeiro gozo de 30 dias de licença prêmio referente ao quinquênio 2018-2023.',
    status: 'Concluído',
    prioridade: 'Urgente',
    responsavel: 'Carlos Alves',
    data_conclusao: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    data_abertura: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    prazo_estimado: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    historico_tramitacao: [
      { data: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), status: 'Aberto', observacao: 'Requerimento formalizado com base na CLT e estatuto do servidor' },
      { data: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), status: 'Concluído', observacao: 'Indeferido por conveniência administrativa e necessidade imperiosa do serviço na unidade escolar' }
    ],
    documento_anexo: 'requerimento_licenca_prêmio.pdf'
  }
];

// Inicializa LocalStorage com dados fictícios caso não existam
function initLocalStorage() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_PROTOCOLOS));
  }
}

// Verifica se é erro de falta de tabela ("relation ... does not exist") ou falha de conexão/fetch com o Supabase
function isMissingTableError(error) {
  if (!error) return false;
  const msg = error.message?.toLowerCase() || '';
  return (
    (msg.includes('relation') && msg.includes('does not exist')) ||
    error.code === '42P01' ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch') ||
    error.name === 'TypeError' ||
    msg.includes('network') ||
    msg.includes('cors') ||
    msg.includes('schema cache') ||
    msg.includes('column')
  );
}


export async function fetchProtocolos() {
  try {
    const { data, error } = await supabase
      .from('protocolo_digital')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      throw error;
    }
    return { data: data || [], isMock: false };
  } catch (err) {
    if (isMissingTableError(err)) {
      initLocalStorage();
      const localData = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { data: localData, isMock: true };
    }
    throw err;
  }
}

export async function fetchProtocoloDetalhe(id) {
  try {
    const { data, error } = await supabase
      .from('protocolo_digital')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }
    return { data, isMock: false };
  } catch (err) {
    if (isMissingTableError(err)) {
      initLocalStorage();
      const localData = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const item = localData.find(p => p.id === Number(id));
      return { data: item || null, isMock: true };
    }
    throw err;
  }
}

export async function criarProtocolo(novo) {
  const now = new Date().toISOString();
  
  // Gerar número de protocolo
  const numRandom = Math.floor(1000 + Math.random() * 9000);
  const ano = new Date().getFullYear();
  const numero_protocolo = `PROT-${ano}-${numRandom}`;
  
  const protocoloParaSalvar = {
    requerente_nome: novo.requerente_nome,
    requerente_matricula: novo.requerente_matricula || null,
    secretaria: novo.secretaria,
    tipo_solicitacao: novo.tipo_solicitacao,
    descricao: novo.descricao || '',
    status: 'Aberto',
    prioridade: novo.prioridade || 'Normal',
    data_abertura: now,
    prazo_estimado: novo.prazo_estimado || new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    historico_tramitacao: [
      { data: now, status: 'Aberto', observacao: 'Protocolo aberto pelo operador/servidor' }
    ],
    documento_anexo: novo.documento_anexo || null
  };

  try {
    const token = obterToken();
    const { data, error } = await supabase.rpc('criar_protocolo_rpc', {
      p_token: token,
      p_protocolo: { ...protocoloParaSalvar, numero_protocolo }
    });

    if (error) {
      throw error;
    }
    return { data, isMock: false };
  } catch (err) {
    if (isMissingTableError(err)) {
      initLocalStorage();
      const localData = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const newId = localData.length > 0 ? Math.max(...localData.map(p => p.id)) + 1 : 1;
      const mockProtocolo = {
        id: newId,
        numero_protocolo,
        ...protocoloParaSalvar
      };
      localData.unshift(mockProtocolo);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localData));
      return { data: mockProtocolo, isMock: true };
    }
    throw err;
  }
}

export async function atualizarStatusProtocolo(id, status, observacao, operador = 'Sistema') {
  const now = new Date().toISOString();
  const novaTramitacao = { data: now, status, observacao: `${observacao} (${operador})` };

  // Buscar registro atual primeiro para poder anexar ao histórico
  const { data: atual, isMock } = await fetchProtocoloDetalhe(id);
  if (!atual) throw new Error('Protocolo não encontrado');

  const novoHistorico = [...(atual.historico_tramitacao || []), novaTramitacao];

  if (isMock) {
    const localData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const idx = localData.findIndex(p => p.id === Number(id));
    if (idx !== -1) {
      localData[idx].status = status;
      localData[idx].historico_tramitacao = novoHistorico;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localData));
      return { data: localData[idx], isMock: true };
    }
    throw new Error('Protocolo não encontrado no LocalStorage');
  }

  try {
    const token = obterToken();
    const { data, error } = await supabase.rpc('atualizar_status_protocolo_rpc', {
      p_token: token,
      p_id: Number(id),
      p_status: status,
      p_historico: novoHistorico
    });

    if (error) throw error;
    return { data, isMock: false };
  } catch (err) {
    console.error('Erro ao atualizar status do protocolo no Supabase:', err);
    throw err;
  }
}

export async function atualizarProtocolo(id, campos) {
  const now = new Date().toISOString();
  
  // Buscar registro atual primeiro para fallback
  const { data: atual, isMock } = await fetchProtocoloDetalhe(id);
  if (!atual) throw new Error('Protocolo não encontrado');

  const params = {
    ...campos,
    updated_at: now
  };

  if (isMock) {
    const localData = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const idx = localData.findIndex(p => p.id === Number(id));
    if (idx !== -1) {
      localData[idx] = {
        ...localData[idx],
        ...params
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localData));
      return { data: localData[idx], isMock: true };
    }
    throw new Error('Protocolo não encontrado no LocalStorage');
  }

  try {
    const token = obterToken();
    const { data, error } = await supabase.rpc('atualizar_protocolo_rpc', {
      p_token: token,
      p_id: Number(id),
      p_campos: campos
    });

    if (error) throw error;
    return { data, isMock: false };
  } catch (err) {
    console.error('Erro ao atualizar protocolo no Supabase:', err);
    throw err;
  }
}

export async function importarProtocolos(lista) {
  if (!lista || lista.length === 0) return { data: [], count: 0, isMock: false };

  try {
    // 1. Obter todos os protocolos atuais do Supabase
    const { data: dbProtocolos, error: fetchErr } = await supabase
      .from('protocolo_digital')
      .select('*');

    if (fetchErr) throw fetchErr;

    const dbProts = dbProtocolos || [];
    const now = new Date().toISOString();
    const hojeData = now.split('T')[0];

    // 2. Identificar protocolos ausentes (estão no banco, não estão na planilha, e não estão Concluídos)
    const ausentes = dbProts.filter(dbP => {
      const naPlanilha = lista.some(p => p.numero_protocolo === dbP.numero_protocolo);
      return !naPlanilha && dbP.status !== 'Concluído';
    });

    // 3. Atualizar ausentes para "Concluído" no Supabase
    const token = obterToken();
    if (ausentes.length > 0) {
      for (const p of ausentes) {
        const novoHistorico = [
          ...(p.historico_tramitacao || []),
          { data: now, status: 'Concluído', observacao: 'Concluído por ausência na listagem (puxado para a mesa de trabalho).' }
        ];
        const { error: updateErr } = await supabase.rpc('atualizar_status_protocolo_rpc', {
          p_token: token,
          p_id: p.id,
          p_status: 'Concluído',
          p_historico: novoHistorico
        });

        if (updateErr) {
          throw updateErr;
        }
      }
    }

    // 4. Processar a lista de entrada (novos e existentes)
    const paraUpsert = [];
    lista.forEach(p => {
      const existente = dbProts.find(dbP => dbP.numero_protocolo === p.numero_protocolo);
      if (existente) {
        // Se já existe, atualiza apenas os campos mutáveis e preserva estado/histórico
        const statusReaberto = existente.status === 'Concluído' ? 'Aberto' : existente.status;
        const historicoReaberto = existente.status === 'Concluído'
          ? [...(existente.historico_tramitacao || []), { data: now, status: 'Aberto', observacao: 'Protocolo reaberto via nova importação de planilha.' }]
          : existente.historico_tramitacao;

        paraUpsert.push({
          numero_protocolo: p.numero_protocolo,
          requerente_nome: p.requerente_nome || existente.requerente_nome,
          requerente_matricula: existente.requerente_matricula,
          secretaria: p.secretaria || existente.secretaria,
          tipo_solicitacao: p.tipo_solicitacao || existente.tipo_solicitacao,
          descricao: p.descricao || existente.descricao,
          status: statusReaberto,
          prioridade: p.prioridade || existente.prioridade,
          data_abertura: existente.data_abertura,
          prazo_estimado: p.prazo_estimado || existente.prazo_estimado,
          historico_tramitacao: historicoReaberto,
          documento_anexo: existente.documento_anexo,
          responsavel: existente.status === 'Concluído' ? null : existente.responsavel,
          data_conclusao: existente.status === 'Concluído' ? null : existente.data_conclusao,
          updated_at: now
        });
      } else {
        // Se é novo, inserimos
        paraUpsert.push({
          ...p,
          created_at: now,
          updated_at: now
        });
      }
    });

    // Executa o upsert no Supabase
    const { data: upsertedData, error: upsertErr } = await supabase.rpc('importar_protocolos_rpc', {
      p_token: token,
      p_rows: paraUpsert
    });

    if (upsertErr) throw upsertErr;

    return { data: paraUpsert, count: paraUpsert.length, isMock: false };

  } catch (err) {
    console.warn("Erro ao tentar salvar no Supabase (desviando para LocalStorage):", err);
    if (isMissingTableError(err)) {
      // --- CAMINHO LOCALSTORAGE (MOCK) ---
      initLocalStorage();
      const localData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
      const now = new Date().toISOString();
      const hojeData = now.split('T')[0];

      // 1. Identificar e marcar ausentes no LocalStorage como Concluídos
      localData.forEach(item => {
        const naPlanilha = lista.some(p => p.numero_protocolo === item.numero_protocolo);
        if (!naPlanilha && item.status !== 'Concluído') {
          item.status = 'Concluído';
          if (!item.historico_tramitacao) item.historico_tramitacao = [];
          item.historico_tramitacao.push({
            data: now,
            status: 'Concluído',
            observacao: 'Concluído por ausência na listagem (puxado para a mesa de trabalho).'
          });
          item.data_conclusao = hojeData;
        }
      });

      // 2. Processar inserção/atualização no LocalStorage
      let maxId = localData.length > 0 ? Math.max(...localData.map(p => p.id)) : 0;
      
      lista.forEach(p => {
        const idx = localData.findIndex(item => item.numero_protocolo === p.numero_protocolo);
        if (idx !== -1) {
          // Existe no LocalStorage: atualiza preservando campos necessários
          const existente = localData[idx];
          const statusReaberto = existente.status === 'Concluído' ? 'Aberto' : existente.status;
          if (!existente.historico_tramitacao) existente.historico_tramitacao = [];
          const historicoReaberto = existente.status === 'Concluído'
            ? [...existente.historico_tramitacao, { data: now, status: 'Aberto', observacao: 'Protocolo reaberto via nova importação de planilha.' }]
            : existente.historico_tramitacao;

          localData[idx] = {
            ...existente,
            requerente_nome: p.requerente_nome || existente.requerente_nome,
            secretaria: p.secretaria || existente.secretaria,
            tipo_solicitacao: p.tipo_solicitacao || existente.tipo_solicitacao,
            descricao: p.descricao || existente.descricao,
            prioridade: p.prioridade || existente.prioridade,
            prazo_estimado: p.prazo_estimado || existente.prazo_estimado,
            status: statusReaberto,
            historico_tramitacao: historicoReaberto,
            responsavel: existente.status === 'Concluído' ? null : existente.responsavel,
            data_conclusao: existente.status === 'Concluído' ? null : existente.data_conclusao
          };
        } else {
          // Não existe: adiciona como novo
          maxId++;
          localData.unshift({
            id: maxId,
            ...p
          });
        }
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(localData));
      return { data: lista, count: lista.length, isMock: true };
    }
    throw err;
  }
}
