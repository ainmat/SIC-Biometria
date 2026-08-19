import * as XLSX from 'xlsx';

// Parse de datas do Excel/String
export function parseExcelDate(val) {
  if (!val) return null;
  
  // Se for um número (Data serial do Excel)
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  // Se for string formato DD/MM/YYYY HH:mm
  const s = String(val).trim();
  const regexBR = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/;
  const match = s.match(regexBR);
  if (match) {
    const [, dia, mes, ano, hora = '00', min = '00'] = match;
    const date = new Date(`${ano}-${mes}-${dia}T${hora}:${min}:00`);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

import { SECRETARIAS } from '@/lib/secretarias';

export function limparSecretaria(sec) {
  if (!sec) return 'Outros';
  let s = String(sec).trim();
  
  const upper = s.toUpperCase();
  const matched = SECRETARIAS.find(x => 
     x.nome.toUpperCase() === upper || 
     x.sigla.toUpperCase() === upper ||
     x.nomesXLS.some(nx => nx === upper)
  );
  if (matched) return matched.nome;

  let semPrefixo = s.replace(/^(secretaria\s+de\s+|secretaria\s+do\s+|secretaria\s+da\s+|sec\.\s+de\s+|sec\s+de\s+)/i, '').trim();
  const upperSemPrefixo = semPrefixo.toUpperCase();
  const matched2 = SECRETARIAS.find(x => 
     x.nome.toUpperCase().includes(upperSemPrefixo) ||
     x.nomesXLS.some(nx => nx.includes(upperSemPrefixo))
  );
  if (matched2) return matched2.nome;

  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function lerArquivoXLS(arquivo) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Ler todas as linhas como array de arrays
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.readAsArrayBuffer(arquivo);
  });
}

export function processarLinhasPlanilha(rows) {
  if (!rows || rows.length === 0) {
    throw new Error('Planilha vazia ou inválida.');
  }

  // 1. Achar a linha do cabeçalho
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    // Procuramos uma linha que contenha as palavras chave "Protocolo" e "Requerente"
    const temProtocolo = r.some(cell => String(cell).toLowerCase().trim() === 'protocolo');
    const temRequerente = r.some(cell => String(cell).toLowerCase().trim() === 'requerente');
    if (temProtocolo && temRequerente) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('Cabeçalho da planilha não identificado. Certifique-se de que a planilha possui as colunas "Protocolo" e "Requerente".');
  }

  const headers = rows[headerRowIdx].map(h => String(h).toLowerCase().trim());
  
  // 2. Mapear os índices das colunas
  const colIdx = {
    protocolo: headers.indexOf('protocolo'),
    assunto: headers.findIndex(h => h === 'assunto'),
    detalhamento: headers.findIndex(h => h.includes('detalhamento') || h.includes('descrição')),
    secretaria: headers.findIndex(h => h.includes('secretar') || h.includes('origem')),
    requerente: headers.indexOf('requerente'),
    dataAbertura: headers.findIndex(h => h.includes('abertura') || h.includes('início')),
    tarefa: headers.indexOf('tarefa'),
    prioridade: headers.indexOf('prioridade'),
    dataRecebimento: headers.findIndex(h => h.includes('recebimento') || h.includes('setor'))
  };

  // Validação básica de colunas críticas
  if (colIdx.protocolo === -1 || colIdx.requerente === -1) {
    throw new Error('Colunas críticas ("Protocolo" e "Requerente") não foram encontradas.');
  }

  const protocolosProcessados = [];

  // 3. Processar linhas de dados abaixo do cabeçalho
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    
    // Ignorar linhas vazias ou sem número de protocolo
    const numProtVal = colIdx.protocolo !== -1 ? String(r[colIdx.protocolo]).trim() : '';
    if (!numProtVal) continue;

    const requerente_nome = colIdx.requerente !== -1 ? String(r[colIdx.requerente]).trim() : 'Não informado';
    if (!requerente_nome || requerente_nome.toLowerCase() === 'requerente') continue; // evita ler cabeçalhos repetidos

    const assunto = colIdx.assunto !== -1 ? String(r[colIdx.assunto]).trim() : 'Outros';
    const detalhamento = colIdx.detalhamento !== -1 ? String(r[colIdx.detalhamento]).trim() : '';
    const secretariaRaw = colIdx.secretaria !== -1 ? String(r[colIdx.secretaria]).trim() : 'Outros';
    const secretaria = limparSecretaria(secretariaRaw);
    
    const dataAberturaRaw = colIdx.dataAbertura !== -1 ? r[colIdx.dataAbertura] : null;
    const data_abertura = parseExcelDate(dataAberturaRaw) || new Date().toISOString();

    const tarefa = colIdx.tarefa !== -1 ? String(r[colIdx.tarefa]).trim() : '';
    const prioridadeRaw = colIdx.prioridade !== -1 ? String(r[colIdx.prioridade]).trim() : 'Normal';
    const prioridade = prioridadeRaw ? prioridadeRaw.charAt(0).toUpperCase() + prioridadeRaw.slice(1).toLowerCase() : 'Normal';
    const dataRecebimentoRaw = colIdx.dataRecebimento !== -1 ? r[colIdx.dataRecebimento] : null;
    const data_recebimento = parseExcelDate(dataRecebimentoRaw);

    // Inferir status e criar histórico
    let status = 'Aberto';
    const historico_tramitacao = [
      { data: data_abertura, status: 'Aberto', observacao: 'Protocolo aberto pelo cidadão/servidor.' }
    ];

    if (data_recebimento) {
      historico_tramitacao.push({
        data: data_recebimento,
        status: 'Aberto',
        observacao: `Recebido no setor para: ${tarefa || 'Análise de Solicitação'} (Prioridade: ${prioridade})`
      });
    }

    // Prazo estimado: 10 dias após abertura
    const dataAberturaObj = new Date(data_abertura);
    const prazo_estimado = new Date(dataAberturaObj.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    protocolosProcessados.push({
      numero_protocolo: numProtVal,
      requerente_nome,
      requerente_matricula: null, // O relatório XLSX não contém matrícula explicítica
      secretaria,
      tipo_solicitacao: assunto,
      descricao: detalhamento,
      status,
      prioridade,
      data_abertura,
      prazo_estimado,
      historico_tramitacao,
      documento_anexo: null
    });
  }

  return protocolosProcessados;
}
