/**
 * Motor de Estrutura Organizacional e Gestão de Lideranças
 * Exclusivo: SECRETARIA DA SAÚDE - PREFEITURA DO MUNICÍPIO DE OSASCO (Código 58.00.00)
 */

import * as xlsx from 'xlsx';
import defaultLiderancas from '../data/Lideranca_SS.json';
import defaultUnidades from '../data/estruturaUnidadesSaude.json';

export const LEADERSHIP_RANKS = [
  { rank: 1, key: 'SECRETARIO', label: 'Secretário / Titular', color: '#0D7C3D', bg: 'rgba(13, 124, 61, 0.12)', border: '#0D7C3D' },
  { rank: 2, key: 'SECRETARIO_ADJUNTO', label: 'Secretária Adjunta / Gabinete', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', border: '#059669' },
  { rank: 3, key: 'DIRETOR', label: 'Diretor Geral / Depto', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)', border: '#2563eb' },
  { rank: 4, key: 'GERENTE', label: 'Gerente de Unidade / Serviço', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', border: '#7c3aed' },
  { rank: 5, key: 'SUPERVISOR', label: 'Supervisor Setorial', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', border: '#d97706' },
  { rank: 6, key: 'ASSESSOR', label: 'Assessor Especial / Executivo', color: '#0284c7', bg: 'rgba(2, 132, 199, 0.12)', border: '#0284c7' },
];

export const EIXOS_SAUDE = [
  { key: 'ALL', label: 'Toda a Secretaria de Saúde', codePrefix: '58' },
  { key: '58-0', label: 'Gabinete do Secretário & Assessoramento', codePrefix: '58-0' },
  { key: '58-3', label: 'Atenção Primária em Saúde (UBSs, CAIs)', codePrefix: '58-3' },
  { key: '58-4', label: 'Atenção Secundária (Policlínicas, CEO, CAPS)', codePrefix: '58-4' },
  { key: '58-5', label: 'Urgência e Emergência (UPAs, PSs, SAMU)', codePrefix: '58-5' },
  { key: '58-6', label: 'Hospital Maternidade Amador Aguiar (HMMAA)', codePrefix: '58-6' },
  { key: '58-7', label: 'Gestão, Vigilância e Farmácia', codePrefix: '58-7' },
];

export function getLeaderRank(cargo = '') {
  if (!cargo) return 999;
  const c = cargo.toUpperCase();
  if (/SECRET[ÁA]RIO\s+DE\s+SAUDE|SECRET[ÁA]RIO\s+MUNICIPAL/i.test(c)) return 1;
  if (/SECRET[ÁA]RIO\s+ADJUNTO|CHEFE\s+DE\s+GABINETE/i.test(c)) return 2;
  if (/DIRETOR/i.test(c)) return 3;
  if (/GERENTE/i.test(c)) return 4;
  if (/SUPERVISOR|SUPERVISAO/i.test(c)) return 5;
  if (/ASSESSOR/i.test(c)) return 6;
  return 999;
}

export function getLeaderBadge(cargo = '') {
  const rank = getLeaderRank(cargo);
  return LEADERSHIP_RANKS.find(r => r.rank === rank) || {
    rank: 999,
    key: 'OUTRO',
    label: 'Liderança',
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.12)',
    border: '#64748b',
  };
}

export function getLevelInfo(level, code = '') {
  if (code.startsWith('58-0')) {
    return { label: 'Gabinete do Secretário', color: '#0D7C3D', bg: 'rgba(13, 124, 61, 0.12)', border: '#0D7C3D' };
  }
  if (code.startsWith('58-1') || code.startsWith('58-2')) {
    return { label: 'Órgão de Assessoramento', color: '#059669', bg: 'rgba(5, 150, 105, 0.12)', border: '#059669' };
  }
  if (/^58-[3-7]-0-0-0$/.test(code) || level === 1) {
    return { label: 'Diretoria Geral / Eixo', color: '#2563eb', bg: 'rgba(37, 99, 235, 0.12)', border: '#2563eb' };
  }
  if (/^58-[3-7]-[1-7]-0-0$/.test(code) || level === 2) {
    return { label: 'Departamento / Divisão', color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', border: '#7c3aed' };
  }
  if (code.includes('UBS') || code.includes('1-1-') || level >= 3) {
    return { label: 'Unidade Operacional (UBS/Serviço)', color: '#0d9488', bg: 'rgba(13, 148, 136, 0.12)', border: '#0d9488' };
  }
  return { label: 'Setor Administrativo', color: '#d97706', bg: 'rgba(217, 119, 6, 0.12)', border: '#d97706' };
}

/**
 * Constrói a Árvore Oficial da Secretaria de Saúde integrando:
 * 1. Base oficial de Unidades (102 órgãos)
 * 2. Lideranças (Diretores, Gerentes e Supervisores da planilha)
 * 3. Base de Servidores Ativos de Saúde
 */
export function buildSaudeTree(customLiderancas = null, servidoresDb = null) {
  const liderancas = Array.isArray(customLiderancas) && customLiderancas.length > 0
    ? customLiderancas
    : defaultLiderancas;

  const rawUnidades = defaultUnidades.filter(u => u.codigo && u.codigo.startsWith('58'));

  const unitMap = new Map();

  // 1. Criar nós para todas as unidades oficiais
  rawUnidades.forEach(u => {
    unitMap.set(u.codigo, {
      id: u.codigo,
      code: u.codigo,
      name: u.nome,
      tipo: u.tipo,
      nivel: Number(u.nivel) || 1,
      titularPlanilha: u.titular || '',
      cargoTitularPlanilha: u.cargoTitular || '',
      totalServidores: Number(u.totalServidores) || 0,
      comissionados: Number(u.comissionados) || 0,
      efetivos: Number(u.efetivos) || 0,
      leaders: [],
      members: [],
      children: [],
    });
  });

  // Garantir a Raiz (Gabinete da Secretaria de Saúde)
  if (!unitMap.has('58-0-0-0-0')) {
    unitMap.set('58-0-0-0-0', {
      id: '58-0-0-0-0',
      code: '58-0-0-0-0',
      name: 'SECRETARIA DA SAÚDE - SS (GABINETE DO SECRETÁRIO)',
      tipo: 'Secretaria / Órgão Superior',
      nivel: 0,
      totalServidores: 4320,
      comissionados: 98,
      efetivos: 4222,
      leaders: [],
      members: [],
      children: [],
    });
  }

  // Garantir Departamentos intermediários chave caso não estejam na lista
  const intermediarios = [
    { code: '58-3-2-0-0', name: 'DEPARTAMENTO DE ATENÇÃO PRIMÁRIA - ZONA NORTE', tipo: 'Diretoria / Departamento', nivel: 2 },
    { code: '58-6-1-0-0', name: 'DIRETORIA CLÍNICA - HMMAA', tipo: 'Diretoria / Departamento', nivel: 2 },
    { code: '58-6-2-0-0', name: 'DIRETORIA DE ENFERMAGEM - HMMAA', tipo: 'Diretoria / Departamento', nivel: 2 },
    { code: '58-6-3-0-0', name: 'DIRETORIA DE GESTÃO HOSPITALAR - HMMAA', tipo: 'Diretoria / Departamento', nivel: 2 },
    { code: '58-1-0-0-0', name: 'CORREGEDORIA DE SAÚDE', tipo: 'Órgão de Controle / Assessoramento', nivel: 1 },
    { code: '58-2-0-0-0', name: 'OUVIDORIA DE SAÚDE', tipo: 'Órgão de Controle / Assessoramento', nivel: 1 },
  ];

  intermediarios.forEach(inter => {
    if (!unitMap.has(inter.code)) {
      unitMap.set(inter.code, {
        id: inter.code,
        code: inter.code,
        name: inter.name,
        tipo: inter.tipo,
        nivel: inter.nivel,
        totalServidores: 0,
        comissionados: 0,
        efetivos: 0,
        leaders: [],
        members: [],
        children: [],
      });
    }
  });

  // 2. Mapear cada liderança para a unidade correspondente
  liderancas.forEach(lead => {
    let target = null;
    const unitCode = lead.unitCode || '';
    const local = lead.localTrabalho || '';
    const sigla = lead.siglaCargo || '';

    // Match exato por código da unidade
    if (unitCode && unitMap.has(unitCode)) {
      target = unitMap.get(unitCode);
    }

    // Match por código dentro do local de trabalho
    if (!target) {
      for (const [code, u] of unitMap.entries()) {
        if (local.includes(code)) {
          target = u;
          break;
        }
      }
    }

    // Match por sigla de cargo
    if (!target) {
      const mSigla = sigla.match(/(58[-\d.]+)/);
      if (mSigla) {
        const cleanSigla = mSigla[1].split('.')[0];
        if (unitMap.has(cleanSigla)) target = unitMap.get(cleanSigla);
      }
    }

    // Fallback para a grande diretoria
    if (!target) {
      const m = sigla.match(/^58-(\d+)/) || local.match(/58-(\d+)/);
      const branchCode = m ? `58-${m[1]}-0-0-0` : '58-0-0-0-0';
      target = unitMap.get(branchCode) || unitMap.get('58-0-0-0-0');
    }

    if (target) {
      target.leaders.push(lead);
    }
  });

  // Se houver servidores do banco de dados (funcionarios_infos da Saúde)
  if (Array.isArray(servidoresDb) && servidoresDb.length > 0) {
    servidoresDb.forEach(s => {
      const local = s.Des_LocalTrab || '';
      for (const [code, u] of unitMap.entries()) {
        if (local.includes(code)) {
          u.members.push(s);
          break;
        }
      }
    });
  }

  // 3. Montar relações de Pai e Filho (Hierarquia Decimal)
  const rootCode = '58-0-0-0-0';

  function findParentCode(code) {
    if (code === rootCode) return null;

    // Conexões especiais de governança direta
    if (code.startsWith('58-1') || code.startsWith('58-2')) return rootCode;
    if (/^58-[3-7]-0-0-0$/.test(code)) return rootCode;

    // Atenção Primária - Zona Norte
    if (code.startsWith('58-3-2-')) {
      return code === '58-3-2-0-0' ? '58-3-0-0-0' : '58-3-2-0-0';
    }
    // Atenção Primária - Zona Sul
    if (code.startsWith('58-3-3-')) {
      return code === '58-3-3-0-0' ? '58-3-0-0-0' : '58-3-3-0-0';
    }

    // Maternidade HMMAA (58-6)
    if (code.startsWith('58-6-')) {
      if (code === '58-6-0-0-0') return rootCode;
      if (code.startsWith('58-6-1')) return '58-6-0-0-0';
      if (code.startsWith('58-6-2')) return '58-6-0-0-0';
      if (code.startsWith('58-6-3-1')) return unitMap.has('58-6-3-0-0') ? '58-6-3-0-0' : '58-6-0-0-0';
      if (code.startsWith('58-6-3-2')) return unitMap.has('58-6-3-0-0') ? '58-6-3-0-0' : '58-6-0-0-0';
      return '58-6-0-0-0';
    }

    // Algoritmo Geral por Zeramento Progressivo
    const parts = code.split('-').map(Number);
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidateParts = [...parts];
      for (let j = i; j < candidateParts.length; j++) candidateParts[j] = 0;

      const cand1 = candidateParts.join('-');
      if (unitMap.has(cand1) && cand1 !== code) return cand1;

      if (candidateParts.length > 5) {
        const cand2 = candidateParts.slice(0, 5).join('-');
        if (unitMap.has(cand2) && cand2 !== code) return cand2;
      }
    }

    // Fallback de Diretoria Mãe
    const branch = `58-${parts[1]}-0-0-0`;
    if (unitMap.has(branch) && branch !== code) return branch;

    return rootCode;
  }

  // Ligar os nós
  for (const [code, u] of unitMap.entries()) {
    if (code === rootCode) continue;
    const parentCode = findParentCode(code);
    const parent = unitMap.get(parentCode);
    if (parent && parent !== u) {
      parent.children.push(u);
      u.parentCode = parentCode;
    } else {
      unitMap.get(rootCode).children.push(u);
      u.parentCode = rootCode;
    }
  }

  // 4. Determinar Titular Principal e Lideranças Secundárias para cada nó
  for (const u of unitMap.values()) {
    // Ordenar líderes: menor rank (Diretor > Gerente > Supervisor)
    u.leaders.sort((a, b) => {
      const rA = getLeaderRank(a.cargo);
      const rB = getLeaderRank(b.cargo);
      if (rA !== rB) return rA - rB;
      return a.nome.localeCompare(b.nome);
    });

    u.primaryLeader = u.leaders[0] || null;
    u.secondaryLeaders = u.leaders.slice(1);
    u.levelInfo = getLevelInfo(u.nivel, u.code);

    // Se o nó raiz não tiver titular preenchido na planilha, atribui o Secretário Oficial
    if (u.code === rootCode && !u.primaryLeader) {
      u.primaryLeader = {
        nome: 'DR. FERNANDO MACHADO OLIVEIRA',
        cargo: 'SECRETÁRIO MUNICIPAL DA SAÚDE',
        roleCategory: 'SECRETARIO',
        situacao: 'Titular do Cargo',
        matricula: 193240,
        padrao: 'AGENTE POLÍTICO',
        vinculo: 'Nomeado em Comissão',
      };
      u.secondaryLeaders = [
        {
          nome: 'DRA. SUZETE SOUZA FRANCO SILVA',
          cargo: 'SECRETÁRIA ADJUNTA DE SAÚDE',
          roleCategory: 'SECRETARIO_ADJUNTO',
          matricula: 188744,
          situacao: 'Titular',
        },
        {
          nome: 'JOÃO RICARDO MORINA DA SILVA',
          cargo: 'CHEFE DE GABINETE DA SAÚDE',
          roleCategory: 'SECRETARIO_ADJUNTO',
          matricula: 188060,
          situacao: 'Titular',
        },
      ];
    }
  }

  // 5. Ordenar filhos (Diretorias Gerais primeiro, depois por código/nome)
  function sortChildren(node) {
    node.children.sort((a, b) => {
      if (a.nivel !== b.nivel) return a.nivel - b.nivel;
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    });
    node.children.forEach(sortChildren);
  }
  const rootNode = unitMap.get(rootCode);
  if (rootNode) sortChildren(rootNode);

  // 6. Computar totais recursivos
  function computeTotals(node) {
    let subLeaders = node.leaders.length;
    let subTotal = node.totalServidores || 0;
    let subCom = node.comissionados || 0;
    let subEf = node.efetivos || 0;

    for (const child of node.children) {
      const c = computeTotals(child);
      subLeaders += c.leaders;
      if (node.totalServidores === 0) {
        subTotal += c.total;
        subCom += c.com;
        subEf += c.ef;
      }
    }

    node.aggregateLeaders = subLeaders;
    if (node.totalServidores === 0 && subTotal > 0) {
      node.totalServidores = subTotal;
      node.comissionados = subCom;
      node.efetivos = subEf;
    }

    return {
      leaders: subLeaders,
      total: node.totalServidores,
      com: node.comissionados,
      ef: node.efetivos,
    };
  }
  if (rootNode) computeTotals(rootNode);

  return {
    root: rootNode,
    totalUnits: unitMap.size,
    totalLiderancas: liderancas.length,
    allUnitsMap: unitMap,
    liderancas,
  };
}

/**
 * Lê e Converte uma Planilha Excel (.xlsx, .xls) carregada pelo Usuário
 */
export async function parseLiderancasExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = xlsx.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        if (!rows || rows.length < 2) {
          throw new Error('Planilha sem dados ou formato incompatível.');
        }

        // Encontrar a linha do cabeçalho procurando colunas chave
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 10); i++) {
          const rowStr = (rows[i] || []).join(' ').toUpperCase();
          if (rowStr.includes('NOME') && (rowStr.includes('CARGO') || rowStr.includes('LOCAL') || rowStr.includes('MATRÍCULA') || rowStr.includes('MATRICULA'))) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          // Fallback para primeira linha com mais de 3 itens
          headerRowIdx = rows.findIndex(r => r && r.length > 3) || 0;
        }

        const headers = rows[headerRowIdx].map(h => String(h || '').trim());
        const dataRows = rows.slice(headerRowIdx + 1);

        // Mapear índices das colunas
        function findIdx(patterns) {
          return headers.findIndex(h => {
            const clean = h.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return patterns.some(p => clean.includes(p.toUpperCase()));
          });
        }

        const idxNome = findIdx(['NOME FUNCIONARIO', 'NOME', 'FUNCIONARIO']);
        const idxCargo = findIdx(['DESCRICAO CARGO', 'CARGO', 'DESCRICAO CONTRATO', 'FUNCAO']);
        const idxLocal = findIdx(['DESCRICAO LOCAL TRABALHO', 'LOCAL TRABALHO', 'LOCAL']);
        const idxSigla = findIdx(['SIGLA CARGO', 'SIGLA', 'CODIGO CARGO']);
        const idxMatricula = findIdx(['MATRICULA', 'REGISTRO', 'NUMERO REGISTRO']);
        const idxCPF = findIdx(['CPF']);
        const idxSituacao = findIdx(['SITUACAO']);
        const idxPadrao = findIdx(['SIMBOLO PADRAO', 'PADRAO SALARIO', 'PADRAO']);
        const idxVinculo = findIdx(['DESCRICAO CATEGORIA FUNCIONAL', 'CATEGORIA', 'REGIME', 'VINCULO']);
        const idxAdmissao = findIdx(['DATA ADMISSAO', 'ADMISSAO']);

        const parsedLiderancas = [];

        dataRows.forEach((r, idx) => {
          if (!r || r.length === 0) return;
          const nome = String(r[idxNome] || '').trim();
          const cargo = String(r[idxCargo] || '').trim();
          if (!nome || !cargo || nome === 'Nome Funcionário') return;

          const local = String(r[idxLocal] || '').trim();
          const sigla = String(r[idxSigla] || '').trim();
          const matricula = r[idxMatricula] || '';
          const cpf = String(r[idxCPF] || '').trim();
          const situacao = String(r[idxSituacao] || 'Normal').trim();
          const padrao = String(r[idxPadrao] || '').trim();
          const vinculo = String(r[idxVinculo] || '').trim();
          const admissao = r[idxAdmissao] || '';

          // Categorizar papel
          let roleCategory = 'SUPERVISOR';
          if (/SECRET[ÁA]RIO|CHEFE\s+DE\s+GABINETE/i.test(cargo)) roleCategory = 'GABINETE';
          else if (/DIRETOR/i.test(cargo)) roleCategory = 'DIRETOR';
          else if (/GERENTE/i.test(cargo)) roleCategory = 'GERENTE';
          else if (/SUPERVISOR|SUPERVISAO/i.test(cargo)) roleCategory = 'SUPERVISOR';

          // Extrair código da unidade
          const mLocal = local.match(/(58[-\d.]+)/);
          const mSigla = sigla.match(/(58[-\d.]+)/);
          const unitCode = mSigla ? mSigla[1].split('.')[0] : (mLocal ? mLocal[1] : '58-0-0-0-0');

          parsedLiderancas.push({
            id: `custom_${idx}_${matricula || Math.random()}`,
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
            admissao,
          });
        });

        resolve(parsedLiderancas);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (e) => reject(new Error('Erro na leitura do arquivo Excel.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Exporta a Estrutura Organizacional e Lideranças para Excel (.xlsx)
 */
export function exportSaudeOrganogramaToExcel(treeRoot, liderancas = []) {
  if (!treeRoot) return;

  const wb = xlsx.utils.book_new();

  // Aba 1: Estrutura Linear com Titulares
  const rowsUnits = [
    ['ORGANOGRAMA OFICIAL DA SECRETARIA DA SAÚDE — MUNICÍPIO DE OSASCO'],
    [`Gerado em ${new Date().toLocaleDateString('pt-BR')} • Total de Unidades Mapeadas: ${liderancas.length} Lideranças`],
    [],
    ['Nível', 'Código Decimal', 'Unidade / Órgão', 'Titular / Liderança Principal', 'Cargo do Titular', 'Outros Líderes da Unidade', 'Total Servidores', 'Comissionados', 'Efetivos'],
  ];

  function collectUnits(node, depth = 0) {
    const secundarias = (node.secondaryLeaders || []).map(l => `${l.nome} (${l.cargo})`).join('; ');
    rowsUnits.push([
      depth,
      node.code,
      node.name,
      node.primaryLeader ? node.primaryLeader.nome : '—',
      node.primaryLeader ? node.primaryLeader.cargo : '—',
      secundarias || '—',
      node.totalServidores || 0,
      node.comissionados || 0,
      node.efetivos || 0,
    ]);
    (node.children || []).forEach(c => collectUnits(c, depth + 1));
  }
  collectUnits(treeRoot, 0);

  const wsUnits = xlsx.utils.aoa_to_sheet(rowsUnits);
  xlsx.utils.book_append_sheet(wb, wsUnits, 'Estrutura Hierárquica');

  // Aba 2: Quadro Completo de Lideranças
  const rowsLideres = [
    ['Matrícula', 'Nome do Líder', 'Cargo Oficial', 'Categoria', 'Padrão Salarial', 'Situação', 'Código Lotação', 'Local de Trabalho', 'Sigla Cargo', 'Vínculo'],
  ];

  liderancas.forEach(l => {
    rowsLideres.push([
      l.matricula || '',
      l.nome || '',
      l.cargo || '',
      l.roleCategory || '',
      l.padrao || '',
      l.situacao || '',
      l.unitCode || '',
      l.localTrabalho || '',
      l.siglaCargo || '',
      l.vinculo || '',
    ]);
  });

  const wsLideres = xlsx.utils.aoa_to_sheet(rowsLideres);
  xlsx.utils.book_append_sheet(wb, wsLideres, 'Quadro de Lideranças');

  xlsx.writeFile(wb, `Organograma_Secretaria_Saude_Osasco_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Busca Recursiva por Servidor, Cargo, Unidade ou Matrícula
 */
export function searchInSaudeTree(node, query, path = []) {
  if (!node || !query) return [];
  const q = query.toLowerCase().trim();
  const currentPath = [...path, node.id];
  let matches = [];

  const matchUnit = (node.name || '').toLowerCase().includes(q) || (node.code || '').toLowerCase().includes(q);

  const matchingLeaders = (node.leaders || []).filter(l =>
    (l.nome || '').toLowerCase().includes(q) ||
    (l.cargo || '').toLowerCase().includes(q) ||
    String(l.matricula).includes(q)
  );

  const matchPrimary = node.primaryLeader && (
    (node.primaryLeader.nome || '').toLowerCase().includes(q) ||
    (node.primaryLeader.cargo || '').toLowerCase().includes(q) ||
    String(node.primaryLeader.matricula).includes(q)
  );

  if (matchUnit || matchPrimary || matchingLeaders.length > 0) {
    matches.push({
      node,
      path: currentPath,
      matchType: matchPrimary || matchingLeaders.length > 0 ? 'leader' : 'unit',
      matchingLeaders: matchPrimary && matchingLeaders.length === 0 ? [node.primaryLeader] : matchingLeaders,
    });
  }

  for (const child of node.children || []) {
    matches = matches.concat(searchInSaudeTree(child, q, currentPath));
  }

  return matches;
}
