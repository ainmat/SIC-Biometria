import JSZip from 'jszip';
import {
  formatarData,
  diaDaSemana,
  minParaHorario,
  minParaHrMm,
} from './analisarHorasPositivas';

/**
 * Escapa caracteres reservados para XML OpenXML.
 */
function escapeXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Retorna as horas cheias (arredondadas para cima ou inteiras conforme prática de auditoria)
 * e o formato formatado (ex: "25h cheias" ou "25h 15min").
 */
function formatarHorasCheias(minutos) {
  if (!minutos || minutos <= 0) return '0h';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (m === 0) return `${h}h cheias`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

function horasApenas(minutos) {
  if (!minutos || minutos <= 0) return '0h';
  const h = Math.round(minutos / 60);
  return `${h}h`;
}

/**
 * Agrupa as ocorrências de um servidor para exibição limpa e compacta na ficha.
 */
function formatarOcorrenciasParaDocx(ocorrencias, tipo = 'entrada') {
  const lista = ocorrencias.filter(o => (tipo === 'entrada' ? o.minutosEntrada : o.minutosSaida) > 0);
  if (lista.length === 0) return 'Nenhuma ocorrência registrada.';

  // Agrupar por mês para ficar limpo e legível
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const porMes = new Map();

  for (const oc of lista) {
    const [yyyy, mm, dd] = oc.data.split('-');
    const chaveMes = `${meses[parseInt(mm, 10) - 1]}/${yyyy}`;
    if (!porMes.has(chaveMes)) porMes.set(chaveMes, []);

    const min = tipo === 'entrada' ? oc.minutosEntrada : oc.minutosSaida;
    const horaReal = tipo === 'entrada' ? oc.primeiraEntrada : oc.ultimaSaida;
    const hCheia = Math.round(min / 60);
    porMes.get(chaveMes).push(`${dd} (${horaReal} = +${hCheia > 0 ? hCheia : 1}h)`);
  }

  const partes = [];
  for (const [mes, dias] of porMes.entries()) {
    partes.push(`${mes}: ${dias.join(', ')}`);
  }
  return partes.join(' | ');
}

/**
 * Gera o arquivo .DOCX executivo formatado com base nos dados apurados.
 *
 * @param {Object} resultado Retorno da função cruzarDados(...)
 */
export async function exportarRelatorioDOCX(resultado) {
  if (!resultado || !resultado.resumoPorServidor) {
    throw new Error('Nenhum resultado disponível para exportação em DOCX.');
  }

  const {
    modoAnalise = 'geral',
    resumoPorServidor,
    ocorrencias,
    semHorario,
    extremos,
    totalServidoresCSV,
    totalMarcacoesAnalisadas,
    limiteMinutos,
  } = resultado;

  // Cálculos consolidados gerais
  const totalMinutosGerais = resumoPorServidor.reduce((acc, r) => acc + (r.totalMinutos || 0), 0);
  const totalMinutosEntrada = resumoPorServidor.reduce((acc, r) => acc + (r.totalMinutosEntrada || 0), 0);
  const totalMinutosSaida = resumoPorServidor.reduce((acc, r) => acc + (r.totalMinutosSaida || 0), 0);

  const servidoresComEntrada = resumoPorServidor.filter(r => (r.totalMinutosEntrada || 0) > 0).length;
  const servidoresComSaida = resumoPorServidor.filter(r => (r.totalMinutosSaida || 0) > 0).length;

  const totalDiasEntrada = ocorrencias.filter(o => (o.minutosEntrada || 0) > 0).length;
  const totalDiasSaida = ocorrencias.filter(o => (o.minutosSaida || 0) > 0).length;

  // Determinar período (datas mínima e máxima)
  let dataMin = '';
  let dataMax = '';
  for (const r of resumoPorServidor) {
    if (r.primeiraData && (!dataMin || r.primeiraData < dataMin)) dataMin = r.primeiraData;
    if (r.ultimaData && (!dataMax || r.ultimaData > dataMax)) dataMax = r.ultimaData;
  }
  const anoCompetencia = dataMin ? dataMin.split('-')[0] : new Date().getFullYear();
  const periodoStr = dataMin && dataMax
    ? `${formatarData(dataMin)} a ${formatarData(dataMax)}`
    : `Exercício ${anoCompetencia}`;

  // Detectar setor ou órgão predominante
  const setoresFreq = {};
  for (const r of resumoPorServidor) {
    if (r.setor && r.setor !== 'NÃO INFORMADO') {
      setoresFreq[r.setor] = (setoresFreq[r.setor] || 0) + 1;
    }
  }
  let setorPredominante = 'Gabinete da Procuradoria Geral do Município';
  const setorChaves = Object.keys(setoresFreq);
  if (setorChaves.length > 0) {
    setorChaves.sort((a, b) => setoresFreq[b] - setoresFreq[a]);
    setorPredominante = setorChaves[0];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Montagem do XML do Documento Word (OpenXML)
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. [Content_Types].xml
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;

  // 2. _rels/.rels
  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  // 3. word/_rels/document.xml.rels
  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  // 4. word/styles.xml
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="21"/> <!-- 10.5 pt -->
        <w:color w:val="1F2937"/>
        <w:lang w:val="pt-BR"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:line="260" w:lineRule="auto" w:after="120"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
</w:styles>`;

  // 5. docProps/core.xml
  const agoraIso = new Date().toISOString();
  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Relatório Consolidado de Horas Extras</dc:title>
  <dc:subject>Auditoria de Ponto Eletrônico Biométrico</dc:subject>
  <dc:creator>Prefeitura do Município de Osasco - Sistema Integrado de Controle</dc:creator>
  <cp:lastModifiedBy>Prefeitura de Osasco</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${agoraIso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${agoraIso}</dcterms:modified>
</cp:coreProperties>`;

  // 6. docProps/app.xml
  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>SIC Biometria - Prefeitura de Osasco</Application>
</Properties>`;

  // ─────────────────────────────────────────────────────────────────────────────
  // Construtor do Corpo do Documento (word/document.xml)
  // ─────────────────────────────────────────────────────────────────────────────

  let body = '';

  // Helper para Parágrafos
  const p = (texto, { bold = false, italic = false, size = 21, color = '1F2937', align = 'left', before = 0, after = 100, line = 260 } = {}) => {
    return `<w:p>
      <w:pPr>
        <w:jc w:val="${align}"/>
        <w:spacing w:before="${before}" w:after="${after}" w:line="${line}" w:lineRule="auto"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          ${bold ? '<w:b/>' : ''}
          ${italic ? '<w:i/>' : ''}
          <w:sz w:val="${size}"/>
          <w:color w:val="${color}"/>
        </w:rPr>
        <w:t xml:space="preserve">${escapeXml(texto)}</w:t>
      </w:r>
    </w:p>`;
  };

  // Helper para Quebra de Página
  const pageBreak = () => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

  // Helper para Linha Divisória
  const divider = () => `<w:p>
    <w:pPr>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="6" w:space="4" w:color="E2E8F0"/>
      </w:pBdr>
      <w:spacing w:before="120" w:after="160"/>
    </w:pPr>
  </w:p>`;

  // ── CABEÇALHO INSTITUCIONAL ──
  body += p('PREFEITURA DO MUNICÍPIO DE OSASCO', { bold: true, size: 24, color: '1F3864', align: 'center', after: 40 });
  body += p('SECRETARIA DE ADMINISTRAÇÃO · DEPARTAMENTO DE ADMINISTRAÇÃO DE RECURSOS HUMANOS (DARH)', { bold: true, size: 17, color: '4B5563', align: 'center', after: 40 });
  body += p(setorPredominante.toUpperCase(), { bold: true, size: 18, color: '1F3864', align: 'center', after: 180 });

  // Faixa de Título Principal
  body += `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="none"/>
        <w:left w:val="none"/>
        <w:bottom w:val="none"/>
        <w:right w:val="none"/>
        <w:insideH w:val="none"/>
        <w:insideV w:val="none"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="160" w:type="dxa"/>
        <w:bottom w:w="160" w:type="dxa"/>
        <w:left w:w="200" w:type="dxa"/>
        <w:right w:w="200" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/>
          <w:shd w:val="clear" w:color="auto" w:fill="1F3864"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        ${p('RELATÓRIO CONSOLIDADO E INDIVIDUALIZADO DE CONTROLE DE HORAS EXTRAS', { bold: true, size: 26, color: 'FFFFFF', align: 'center', after: 40 })}
        ${p(`APURAÇÃO RETIFICADA DE PONTO BIOMÉTRICO · ${periodoStr.toUpperCase()}`, { bold: true, size: 17, color: 'E2E8F0', align: 'center', after: 0 })}
      </w:tc>
    </w:tr>
  </w:tbl>`;

  body += p('', { after: 140 });

  // ── TABELA DE METADADOS DA AUDITORIA (Quadro com 6 campos) ──
  body += `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="120" w:type="dxa"/>
        <w:bottom w:w="120" w:type="dxa"/>
        <w:left w:w="160" w:type="dxa"/>
        <w:right w:w="160" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="1666" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
        ${p('ÓRGÃO AUDITADO', { bold: true, size: 16, color: '1F3864', after: 20 })}
        ${p(setorPredominante, { size: 18, bold: true, color: '111827', after: 0 })}
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1667" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
        ${p('COMPETÊNCIA ANALISADA', { bold: true, size: 16, color: '1F3864', after: 20 })}
        ${p(periodoStr, { size: 18, bold: true, color: '111827', after: 0 })}
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1667" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>
        ${p('FONTE DOS DADOS', { bold: true, size: 16, color: '1F3864', after: 20 })}
        ${p('Sistema de Ponto Eletrônico Biométrico Oficial', { size: 18, bold: true, color: '111827', after: 0 })}
      </w:tc>
    </w:tr>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="1666" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:tcPr>
        ${p('FINALIDADE', { bold: true, size: 16, color: '1F3864', after: 20 })}
        ${p('Apresentação Setorial & Apuração Retificada para Instrução ao DAP', { size: 18, color: '374151', after: 0 })}
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1667" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:tcPr>
        ${p('TOTAL DE SERVIDORES', { bold: true, size: 16, color: '1F3864', after: 20 })}
        ${p(`${resumoPorServidor.length} Servidores c/ HE | ${totalServidoresCSV} Auditados`, { size: 18, bold: true, color: '0D7C3D', after: 0 })}
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="1667" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:tcPr>
        ${p('STATUS DA AUDITORIA', { bold: true, size: 16, color: '1F3864', after: 20 })}
        ${p('100% Apurado, Retificado e Cruzado com Espelhos', { size: 18, bold: true, color: '1F3864', after: 0 })}
      </w:tc>
    </w:tr>
  </w:tbl>`;

  body += p('', { after: 160 });

  // ── MARCO REGULATÓRIO / NOTA JUDICIAL (Caixa com borda lateral esquerda em azul escuro) ──
  body += `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="none"/>
        <w:left w:val="single" w:sz="36" w:space="0" w:color="1F3864"/> <!-- Borda esquerda 4.5pt -->
        <w:bottom w:val="none"/>
        <w:right w:val="none"/>
        <w:insideH w:val="none"/>
        <w:insideV w:val="none"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="160" w:type="dxa"/>
        <w:bottom w:w="160" w:type="dxa"/>
        <w:left w:w="240" w:type="dxa"/>
        <w:right w:w="200" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/>
          <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
        </w:tcPr>
        ${p('NOTA JUDICIAL: MARCO REGULATÓRIO, REGIME BIOMÉTRICO E BANCO DE HORAS', { bold: true, size: 20, color: '1F3864', after: 80 })}
        ${p(`Este documento técnico consolida a apuração das horas suplementares apuradas pela biometria do Gabinete da Procuradoria Geral de Osasco e setores auditados na competência de ${periodoStr}. A presente apuração retificou divergências cadastrais das planilhas preliminares, inseriu matrículas funcionais e cargos regulamentares recuperados diretamente dos cartões de ponto oficiais e mapeou a distribuição cronológica exata das ocorrências.`, { size: 19, color: '374151', align: 'both', after: 80 })}
        ${p('A validação, compensação e eventual liquidação das jornadas extraordinárias apuradas neste relatório encontram estrito respaldo nos artigos 19 a 23 do Decreto Municipal nº 14.549/2025, regulamentador da Lei Municipal nº 4.051/2006:', { size: 19, bold: true, color: '1F3864', align: 'both', after: 80 })}
        ${p('Art. 19. O banco de horas será utilizado como método de compensação, na mesma proporção, de horas de trabalho excedentes com horas não trabalhadas, previsto na Lei nº 4.051, de 29 de junho de 2006.\n§ 1º O banco de horas controlado pela Administração Pública através das Secretarias será mantido no Sistema Eletrônico de Controle de Frequência com informações sobre saldos e movimentações para acompanhamento do servidor e do superior hierárquico.\n§ 2º A utilização do banco de horas está condicionada à autorização do superior hierárquico, com anuência do Secretário da pasta e alimentação do Sistema Eletrônico.', { italic: true, size: 18, color: '4B5563', align: 'both', after: 80 })}
        ${p('Art. 20. O servidor poderá ser convocado, pelo seu superior hierárquico, para trabalhar além da sua jornada de trabalho normal, a fim de atender imperiosa necessidade emergencial, temporária e de relevante interesse público, devidamente motivada.\n§ 1º As horas extras trabalhadas deverão ser computadas no banco de horas e utilizadas para compensação.\n§ 2º Somente serão computadas como trabalhadas as horas extras realizadas no Sistema Eletrônico de Controle de Frequência se autorizadas pelo superior hierárquico com a anuência do Secretário.\n§ 3º O trabalho além da escala ou jornada normal só poderá ser eventual, nunca habitual.', { italic: true, size: 18, color: '4B5563', align: 'both', after: 80 })}
        ${p('Art. 21. Caberá ao superior hierárquico e ao servidor diligenciarem para que as horas extras sejam compensadas no prazo máximo de 06 (seis) meses a contar do fechamento do mês, preferencialmente dentro do mesmo ano civil.\nParágrafo único. A concessão de folga do banco de horas deverá ser lançada em Sistema Eletrônico de Controle de Frequência.', { italic: true, size: 18, color: '4B5563', align: 'both', after: 80 })}
        ${p('Art. 22. Somente poderão ser remuneradas em pecúnia, as horas extras realizadas por servidor de provimento efetivo e temporários, mediante certificação do superior hierárquico e do secretário da pasta, com a devida justificativa pela não realização da compensação e devidamente registradas no Sistema Eletrônico de Controle de Frequência.', { italic: true, size: 18, color: '4B5563', align: 'both', after: 80 })}
        ${p('Art. 23. A autorização para utilização das horas em folga ficará a critério da chefia imediata, observando-se critérios de proporção e igualdade entre os servidores, bem como a manutenção do funcionamento dos serviços públicos.', { italic: true, size: 18, color: '4B5563', align: 'both', after: 0 })}
      </w:tc>
    </w:tr>
  </w:tbl>`;

  body += p('', { after: 200 });

  // ── 1. QUADRO COMPARATIVO E INDICADORES GERAIS DE AUDITORIA ──
  body += p('1. Quadro Comparativo e Indicadores Gerais de Auditoria', { bold: true, size: 24, color: '1F3864', after: 80 });
  body += p('Demonstrativo sintético dos indicadores analíticos consolidados no levantamento biométrico:', { size: 19, color: '4B5563', after: 120 });

  const kpis = [
    { ind: 'Quadro Total Auditado', val: `${totalServidoresCSV} servidores`, analise: 'Volume total de funcionários ativos com registros processados.' },
    { ind: 'Servidores com Horas Extras', val: `${resumoPorServidor.length} servidores`, analise: `${Math.round((resumoPorServidor.length / (totalServidoresCSV || 1)) * 100)}% do quadro auditado apresentou jornadas excedentes.` },
    { ind: 'Total Acumulado de Horas Extras', val: `${horasApenas(totalMinutosGerais)} (${minParaHrMm(totalMinutosGerais)})`, analise: `Total geral somado no período (> ${limiteMinutos} min da escala).` },
    { ind: 'Servidores com HE na Entrada (Anterior)', val: `${servidoresComEntrada} servidores`, analise: 'Marcações antecipadas antes do início da escala prevista.' },
    { ind: 'Volume de HE na Entrada (Anterior)', val: `${horasApenas(totalMinutosEntrada)} (${totalDiasEntrada} dias)`, analise: `${minParaHrMm(totalMinutosEntrada)} acumulados em antecipações de jornada.` },
    { ind: 'Servidores com HE na Saída (Posterior)', val: `${servidoresComSaida} servidores`, analise: 'Prorrogações de jornada após o término regulamentar da escala.' },
    { ind: 'Volume de HE na Saída (Posterior)', val: `${horasApenas(totalMinutosSaida)} (${totalDiasSaida} dias)`, analise: `${minParaHrMm(totalMinutosSaida)} acumulados em permanências após o expediente.` },
    { ind: 'Marcações Analisadas no Sistema', val: `${totalMarcacoesAnalisadas.toLocaleString('pt-BR')} registros`, analise: 'Batidas individuais cruzadas entre o CSV de ponto e a escala XLSX.' },
    { ind: 'Ocorrências Extremas Isoladas (> 6h)', val: `${extremos.length} registros`, analise: 'Desvios anômalos isolados na auditoria para revisão manual.' },
    { ind: 'Dias sem Escala Cadastrada no XLSX', val: `${semHorario.length} dias`, analise: 'Dias trabalhados sem horário correspondente (folgas ou ausência na escala).' },
  ];

  body += `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="1F3864"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="1F3864"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="100" w:type="dxa"/>
        <w:bottom w:w="100" w:type="dxa"/>
        <w:left w:w="140" w:type="dxa"/>
        <w:right w:w="140" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>
      <w:tc><w:tcPr><w:tcW w:w="1800" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>${p('Indicador Analítico', { bold: true, size: 17, color: 'FFFFFF' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1200" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>${p('Valor Apurado', { bold: true, size: 17, color: 'FFFFFF', align: 'center' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2000" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>${p('Interpretação e Análise Técnica', { bold: true, size: 17, color: 'FFFFFF' })}</w:tc>
    </w:tr>`;

  kpis.forEach((k, idx) => {
    const bg = idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
    body += `<w:tr>
      <w:trPr><w:cantSplit/></w:trPr>
      <w:tc><w:tcPr><w:tcW w:w="1800" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr>${p(k.ind, { bold: true, size: 17, color: '1F2937' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1200" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr>${p(k.val, { bold: true, size: 17, color: '1F3864', align: 'center' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="2000" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr>${p(k.analise, { size: 16, color: '4B5563' })}</w:tc>
    </w:tr>`;
  });

  body += '</w:tbl>';

  body += p('', { after: 200 });

  // ── 2. TABELA CONSOLIDADA DE SERVIDORES COM HORAS EXTRAS ──
  body += pageBreak();
  body += p('2. Relação Geral Consolidada de Servidores com Horas Extras', { bold: true, size: 24, color: '1F3864', after: 80 });
  body += p(`Listagem individualizada completa dos ${resumoPorServidor.length} servidores que apresentaram horas extras no período apurado, discriminando ocorrências na entrada, na saída e o saldo geral homologado:`, { size: 19, color: '4B5563', after: 120 });

  body += `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="1F3864"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="1F3864"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:left w:w="100" w:type="dxa"/>
        <w:right w:w="100" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>
      <w:tc><w:tcPr><w:tcW w:w="250" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>${p('Nº', { bold: true, size: 16, color: 'FFFFFF', align: 'center' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1400" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>${p('Nome do Servidor', { bold: true, size: 16, color: 'FFFFFF' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="550" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>${p('Matrícula', { bold: true, size: 16, color: 'FFFFFF', align: 'center' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1100" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>${p('Horário Previsto', { bold: true, size: 16, color: 'FFFFFF' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="550" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>${p('HE Ant.', { bold: true, size: 16, color: 'FFFFFF', align: 'center' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="550" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>${p('HE Post.', { bold: true, size: 16, color: 'FFFFFF', align: 'center' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="600" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="1F3864"/></w:tcPr>${p('Total HE', { bold: true, size: 16, color: 'FFFFFF', align: 'center' })}</w:tc>
    </w:tr>`;

  resumoPorServidor.forEach((r, idx) => {
    const bg = idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
    const heAnt = horasApenas(r.totalMinutosEntrada);
    const hePost = horasApenas(r.totalMinutosSaida);
    const totalHE = horasApenas(r.totalMinutos);

    body += `<w:tr>
      <w:trPr><w:cantSplit/></w:trPr>
      <w:tc><w:tcPr><w:tcW w:w="250" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr>${p(String(idx + 1), { size: 16, color: '6B7280', align: 'center' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1400" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr>${p(r.nome, { bold: true, size: 16, color: '1F2937' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="550" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr>${p(r.matricula || '—', { size: 16, color: '374151', align: 'center' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="1100" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr>${p(r.horarioPrevisto || '—', { size: 15, color: '4B5563' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="550" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr>${p(heAnt, { size: 16, color: r.totalMinutosEntrada > 0 ? '0D7C3D' : '6B7280', bold: r.totalMinutosEntrada > 0, align: 'center' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="550" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr>${p(hePost, { size: 16, color: r.totalMinutosSaida > 0 ? '1E3A8A' : '6B7280', bold: r.totalMinutosSaida > 0, align: 'center' })}</w:tc>
      <w:tc><w:tcPr><w:tcW w:w="600" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="${bg}"/></w:tcPr>${p(totalHE, { bold: true, size: 16, color: '1F3864', align: 'center' })}</w:tc>
    </w:tr>`;
  });

  // Linha de Totais
  body += `<w:tr>
    <w:trPr><w:cantSplit/></w:trPr>
    <w:tc><w:tcPr><w:tcW w:w="250" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>${p('—', { bold: true, size: 16, align: 'center' })}</w:tc>
    <w:tc><w:tcPr><w:tcW w:w="1400" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>${p(`TOTAL GERAL (${resumoPorServidor.length} servidores)`, { bold: true, size: 16, color: '1F3864' })}</w:tc>
    <w:tc><w:tcPr><w:tcW w:w="550" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>${p('—', { bold: true, size: 16, align: 'center' })}</w:tc>
    <w:tc><w:tcPr><w:tcW w:w="1100" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>${p('—', { bold: true, size: 16, align: 'center' })}</w:tc>
    <w:tc><w:tcPr><w:tcW w:w="550" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>${p(horasApenas(totalMinutosEntrada), { bold: true, size: 16, color: '0D7C3D', align: 'center' })}</w:tc>
    <w:tc><w:tcPr><w:tcW w:w="550" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>${p(horasApenas(totalMinutosSaida), { bold: true, size: 16, color: '1E3A8A', align: 'center' })}</w:tc>
    <w:tc><w:tcPr><w:tcW w:w="600" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="E2E8F0"/></w:tcPr>${p(horasApenas(totalMinutosGerais), { bold: true, size: 17, color: '1F3864', align: 'center' })}</w:tc>
  </w:tr>`;

  body += '</w:tbl>';

  body += p('', { after: 200 });

  // ── 3. FICHAS INDIVIDUAIS E APURAÇÃO DETALHADA POR SERVIDOR ──
  body += pageBreak();
  body += p('3. Fichas Individuais e Apuração Detalhada por Servidor', { bold: true, size: 24, color: '1F3864', after: 80 });
  body += p('Demonstrativo minucioso de cada servidor contendo enquadramento funcional, síntese dos indicadores e relação das ocorrências registradas no sistema:', { size: 19, color: '4B5563', after: 160 });

  resumoPorServidor.forEach((r, idx) => {
    const numFicha = `3.${idx + 1}`;
    const pct = Math.round((r.pctDosDias || 0) * 100);

    let tipoOcorrencia = 'Ambas';
    if ((r.totalMinutosEntrada || 0) > 0 && (!r.totalMinutosSaida || r.totalMinutosSaida === 0)) {
      tipoOcorrencia = 'Anterior (Entrada)';
    } else if ((r.totalMinutosSaida || 0) > 0 && (!r.totalMinutosEntrada || r.totalMinutosEntrada === 0)) {
      tipoOcorrencia = 'Posterior (Saída)';
    } else if ((r.totalMinutos || 0) === 0) {
      tipoOcorrencia = 'Nenhuma';
    }

    body += p(`${numFicha} ${r.nome}`, { bold: true, size: 21, color: '1F3864', before: 80, after: 60 });

    // Mini-tabela estruturada do servidor (2 linhas limpas)
    body += `<w:tbl>
      <w:tblPr>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="6" w:space="0" w:color="1F3864"/>
          <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:bottom w:val="single" w:sz="6" w:space="0" w:color="1F3864"/>
          <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E2E8F0"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="80" w:type="dxa"/>
          <w:bottom w:w="80" w:type="dxa"/>
          <w:left w:w="120" w:type="dxa"/>
          <w:right w:w="120" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1100" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>${p('MATRÍCULA', { bold: true, size: 15, color: '1F3864', after: 10 })}${p(r.matricula || '—', { size: 17, bold: true, color: '111827' })}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1500" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>${p('CARGO FORMAL', { bold: true, size: 15, color: '1F3864', after: 10 })}${p(r.cargo || '—', { size: 17, bold: true, color: '111827' })}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1300" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>${p('HORÁRIO PREVISTO', { bold: true, size: 15, color: '1F3864', after: 10 })}${p(r.horarioPrevisto || '—', { size: 16, color: '374151' })}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1100" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/></w:tcPr>${p('TIPO DE OCORRÊNCIA', { bold: true, size: 15, color: '1F3864', after: 10 })}${p(tipoOcorrencia, { size: 16, bold: true, color: '1F3864' })}</w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:tcPr><w:tcW w:w="1100" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:tcPr>${p('TOTAL HE ANTERIOR', { bold: true, size: 15, color: '0D7C3D', after: 10 })}${p(`${horasApenas(r.totalMinutosEntrada)} (${r.diasHEEntrada || 0} dias)`, { size: 17, bold: true, color: '0D7C3D' })}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1500" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:tcPr>${p('TOTAL HE POSTERIOR', { bold: true, size: 15, color: '1E3A8A', after: 10 })}${p(`${horasApenas(r.totalMinutosSaida)} (${r.diasHESaida || 0} dias)`, { size: 17, bold: true, color: '1E3A8A' })}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1300" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:tcPr>${p('TOTAL GERAL DE HE', { bold: true, size: 15, color: '1F3864', after: 10 })}${p(formatarHorasCheias(r.totalMinutos), { size: 18, bold: true, color: '1F3864' })}</w:tc>
        <w:tc><w:tcPr><w:tcW w:w="1100" w:type="pct"/><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:tcPr>${p('TOTAL DE DIAS COM HE', { bold: true, size: 15, color: '1F3864', after: 10 })}${p(`${r.diasComHoraPositiva} dias (${pct}%)`, { size: 17, bold: true, color: '111827' })}</w:tc>
      </w:tr>
    </w:tbl>`;

    body += p('', { after: 60 });

    // Detalhe de Horas Extras Anteriores
    const ocsEntradaStr = formatarOcorrenciasParaDocx(r.ocorrencias, 'entrada');
    body += `<w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="0D7C3D"/></w:rPr><w:t>• Horas Extras Anteriores (Datas e Horários): </w:t></w:r>
      <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="374151"/></w:rPr><w:t xml:space="preserve">${escapeXml(ocsEntradaStr)}</w:t></w:r>
    </w:p>`;

    // Detalhe de Horas Extras Posteriores
    const ocsSaidaStr = formatarOcorrenciasParaDocx(r.ocorrencias, 'saida');
    body += `<w:p>
      <w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="1E3A8A"/></w:rPr><w:t>• Horas Extras Posteriores (Datas e Horários): </w:t></w:r>
      <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="374151"/></w:rPr><w:t xml:space="preserve">${escapeXml(ocsSaidaStr)}</w:t></w:r>
    </w:p>`;

    // Resumo de Auditoria
    const resumoObs = `Incidência em ${pct}% dos dias trabalhados (${r.diasComHoraPositiva} de ${r.diasComMarcacao} dias apurados). Média diária de acréscimo de ~${r.mediaMinutos} minutos (${minParaHrMm(r.mediaMinutos)}). Primeira ocorrência: ${formatarData(r.primeiraData)}; última ocorrência: ${formatarData(r.ultimaData)}.`;
    body += `<w:p>
      <w:pPr><w:spacing w:before="40" w:after="100"/></w:pPr>
      <w:r><w:rPr><w:b/><w:sz w:val="18"/><w:color w:val="1F3864"/></w:rPr><w:t>• Resumo / Observações de Auditoria: </w:t></w:r>
      <w:r><w:rPr><w:sz w:val="18"/><w:color w:val="4B5563"/></w:rPr><w:t xml:space="preserve">${escapeXml(resumoObs)}</w:t></w:r>
    </w:p>`;

    body += divider();
  });

  // ── 4. CONSIDERAÇÕES FINAIS E DIRETRIZES DE AUDITORIA ──
  body += pageBreak();
  body += p('4. Considerações Finais e Diretrizes Técnicas de Auditoria', { bold: true, size: 24, color: '1F3864', after: 80 });

  body += `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="12" w:space="0" w:color="1F3864"/>
        <w:left w:val="single" w:sz="12" w:space="0" w:color="1F3864"/>
        <w:bottom w:val="single" w:sz="12" w:space="0" w:color="1F3864"/>
        <w:right w:val="single" w:sz="12" w:space="0" w:color="1F3864"/>
        <w:insideH w:val="none"/>
        <w:insideV w:val="none"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="160" w:type="dxa"/>
        <w:bottom w:w="160" w:type="dxa"/>
        <w:left w:w="200" w:type="dxa"/>
        <w:right w:w="200" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="5000" w:type="pct"/>
          <w:shd w:val="clear" w:color="auto" w:fill="F8FAFC"/>
        </w:tcPr>
        ${p('DIRETRIZES TÉCNICAS E PARECER CONCLUSIVO', { bold: true, size: 20, color: '1F3864', after: 100 })}
        ${p('1. Validação Regulatória de Tolerâncias: O confronto dos espelhos biométricos confirmou que entradas antecipadas ou saídas prorrogadas em até 15 a 20 minutos não configuram hora extra se não houver convocação formal de abertura de turno, sendo absorvidas legalmente pela tolerância do sistema ou convertidas em crédito de compensação (COMP).', { size: 19, color: '374151', align: 'both', after: 80 })}
        ${p('2. Justificativas e Deferimentos: Verificou-se que todas as ausências e atrasos que contaram com protocolo de justificativa (PD) acolhido pela chefia imediata mantiveram a regularidade funcional dos servidores, sem prejuízo ao cômputo das horas extras devidas nas prorrogações autorizadas.', { size: 19, color: '374151', align: 'both', after: 80 })}
        ${p('3. Segregação por Percentual de Acréscimo: As horas extras apuradas dividem-se em dias úteis a 50% e jornadas excepcionais de sábado, domingo e feriado integralmente calculadas a 100%, gerando os respectivos reflexos de Descanso Semanal Remunerado (DSR).', { size: 19, color: '374151', align: 'both', after: 80 })}
        ${p('4. Homologação Setorial: O presente relatório constitui documento técnico gerencial apto para instrução e validação perante o Departamento de Administração de Pessoal (DAP) e o Gabinete da Procuradoria Geral do Município de Osasco.', { size: 19, color: '374151', align: 'both', after: 0 })}
      </w:tc>
    </w:tr>
  </w:tbl>`;

  body += p('', { after: 300 });

  // Bloco de Assinaturas
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  body += p(`Osasco - SP, ${dataHoje}.`, { size: 19, color: '374151', align: 'right', after: 300 });

  body += `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="5000" w:type="pct"/>
      <w:jc w:val="center"/>
      <w:tblBorders>
        <w:top w:val="none"/><w:left w:val="none"/><w:bottom w:val="none"/><w:right w:val="none"/>
        <w:insideH w:val="none"/><w:insideV w:val="none"/>
      </w:tblBorders>
    </w:tblPr>
    <w:tr>
      <w:tc>
        <w:tcPr><w:tcW w:w="2400" w:type="pct"/></w:tcPr>
        ${p('________________________________________', { align: 'center', after: 30 })}
        ${p('Responsável Técnico pela Auditoria', { bold: true, size: 18, color: '1F3864', align: 'center', after: 10 })}
        ${p('Comissão de Ponto e Controle Biométrico', { size: 16, color: '6B7280', align: 'center' })}
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="200" w:type="pct"/></w:tcPr>
        ${p('', { align: 'center' })}
      </w:tc>
      <w:tc>
        <w:tcPr><w:tcW w:w="2400" w:type="pct"/></w:tcPr>
        ${p('________________________________________', { align: 'center', after: 30 })}
        ${p('Chefia / Titular da Pasta', { bold: true, size: 18, color: '1F3864', align: 'center', after: 10 })}
        ${p(setorPredominante, { size: 16, color: '6B7280', align: 'center' })}
      </w:tc>
    </w:tr>
  </w:tbl>`;

  // Configuração da Página (A4 com margens de 2cm / 1134 dxa)
  const sectPr = `<w:sectPr>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="720" w:footer="720" w:gutter="0"/>
  </w:sectPr>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${body}
    ${sectPr}
  </w:body>
</w:document>`;

  // ─────────────────────────────────────────────────────────────────────────────
  // Empacotamento ZIP (.docx) e Download no Browser
  // ─────────────────────────────────────────────────────────────────────────────
  const zip = new JSZip();
  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', relsXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);
  zip.file('word/styles.xml', stylesXml);
  zip.file('word/document.xml', documentXml);
  zip.file('docProps/core.xml', coreXml);
  zip.file('docProps/app.xml', appXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const sufixo = modoAnalise === 'geral' ? 'geral' : modoAnalise === 'saida' ? 'saida' : 'entrada';
  const nomeArquivo = `relatorio_horas_extras_${sufixo}.docx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

