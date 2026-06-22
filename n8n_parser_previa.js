/**
 * Parser Posicional de Prévia de Frequência - Nó Code do n8n
 * Nome do Arquivo: n8n_parser_previa.js
 * Localização: Raiz do projeto (para referência e uso em fluxos n8n)
 * 
 * Este script foi desenvolvido para rodar dentro de um nó "Code" do n8n.
 * Ele espera receber no input do nó um objeto contendo o texto bruto do arquivo .txt
 * e retorna os registros parseados prontos para inserção no Supabase,
 * além de uma lista de linhas descartadas para fins de auditoria e log.
 */

// 1. Obter o conteúdo do input (n8n armazena o item em $input.item ou $input.all())
// O script assume que o texto bruto do arquivo está na propriedade "conteudo" do JSON recebido.
// Exemplo de payload anterior: { "conteudo": "001234560117/06/2026010100050\n..." }
const itemInput = $input.item ? $input.item.json : $input.all()[0].json;
const conteudoArquivo = itemInput.conteudo || "";

// Arrays para armazenar registros válidos e as linhas que falharam nas regras
const registrosValidos = [];
const linhasDescartadas = [];

// Helper para detectar espaços consecutivos (dois ou mais espaços em branco)
function temEspacosConsecutivos(str) {
  return /  +/.test(str);
}

// Helper para converter data de DD/MM/YYYY para YYYY-MM-DD (compatível com o tipo DATE do Postgres)
function converterDataISO(dataStr) {
  const partes = dataStr.split('/');
  if (partes.length !== 3) return null;
  const dia = partes[0];
  const mes = partes[1];
  const ano = partes[2];
  return `${ano}-${mes}-${dia}`;
}

if (conteudoArquivo && conteudoArquivo.trim() !== '') {
  // Divisão do arquivo por linhas (tratando quebras de linha Windows \r\n e Unix \n)
  const linhas = conteudoArquivo.split(/\r?\n/);
  
  linhas.forEach((linha, index) => {
    const numeroLinha = index + 1;
    
    // Regra de Descarte 1: Linhas vazias ou compostas apenas por espaços
    if (!linha || linha.trim() === '') {
      return; // Ignora silenciosamente linhas vazias
    }
    
    // Regra de Descarte 2: Comprimento da linha menor que 29 caracteres
    if (linha.length < 29) {
      linhasDescartadas.push({
        linha: numeroLinha,
        motivo: `Linha muito curta (${linha.length} caracteres), esperado mínimo de 29`,
        conteudo: linha
      });
      return;
    }
    
    // Extração das substrings conforme o layout posicional fixo (0-indexed)
    const areaMatricula  = linha.substring(2, 8);   // Posição 2 a 8 (matrícula)
    const areaData       = linha.substring(10, 20); // Posição 10 a 20 (data DD/MM/YYYY)
    const areaCodigo     = linha.substring(21, 24); // Posição 21 a 24 (código ocorrência)
    const areaPercentual = linha.substring(26, 29); // Posição 26 a 29 (percentual desconto)
    
    // Regra de Descarte 3: Dois ou mais espaços consecutivos na área de Data
    if (temEspacosConsecutivos(areaData)) {
      linhasDescartadas.push({
        linha: numeroLinha,
        motivo: "Espaços consecutivos na área de data",
        conteudo: linha
      });
      return;
    }
    
    // Regra de Descarte 3 (continuação): Dois ou mais espaços consecutivos na área do Código
    if (temEspacosConsecutivos(areaCodigo)) {
      linhasDescartadas.push({
        linha: numeroLinha,
        motivo: "Espaços consecutivos na área de código da ocorrência",
        conteudo: linha
      });
      return;
    }
    
    const matricula = areaMatricula.trim();
    const dataOcorrencia = areaData.trim();
    const codigoOcorrencia = areaCodigo.trim();
    const percentualStr = areaPercentual.trim();
    
    // Regra de Descarte 4: Validação do formato de data (DD/MM/YYYY)
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataOcorrencia)) {
      linhasDescartadas.push({
        linha: numeroLinha,
        motivo: `Formato de data inválido "${dataOcorrencia}", esperado DD/MM/YYYY`,
        conteudo: linha
      });
      return;
    }
    
    // Conversão da data para YYYY-MM-DD
    const dataConvertida = converterDataISO(dataOcorrencia);
    if (!dataConvertida) {
      linhasDescartadas.push({
        linha: numeroLinha,
        motivo: `Falha ao converter data "${dataOcorrencia}" para formato ISO`,
        conteudo: linha
      });
      return;
    }
    
    // Regra de Descarte 5: Validação do percentual de desconto (numérico inteiro entre 0 e 100)
    const percentual = parseInt(percentualStr, 10);
    if (isNaN(percentual) || percentual < 0 || percentual > 100) {
      linhasDescartadas.push({
        linha: numeroLinha,
        motivo: `Percentual de desconto inválido "${percentualStr}", esperado inteiro entre 0 e 100`,
        conteudo: linha
      });
      return;
    }
    
    // Se passou em todas as regras, adiciona o registro estruturado
    registrosValidos.push({
      matricula: matricula,
      data_ocorrencia: dataConvertida,
      codigo_ocorrencia: codigoOcorrencia,
      percentual_desconto: percentual
    });
  });
}

// Retorna o resultado estruturado no padrão que o n8n espera
return [
  {
    json: {
      total_linhas_processadas: (conteudoArquivo.split(/\r?\n/) || []).length,
      qtd_registros_validos: registrosValidos.length,
      qtd_linhas_descartadas: linhasDescartadas.length,
      registros: registrosValidos,
      descartados: linhasDescartadas
    }
  }
];
