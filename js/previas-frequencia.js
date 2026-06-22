// SIC-Biometria — Prévia de Frequência
import {
  getPreviasRegistros,
  countPreviasExistentes,
  deletePreviasPeriodo,
  insertPreviasLote
} from './api.js';
import { Toast } from './components.js';

const BATCH_SIZE = 500;
const PREVIEW_LIMIT = 50;

// Estado da aplicação
let arquivoSelecionado = null;
let registrosValidos = [];
let linhasDescartadas = [];
let totalLinhasLidas = 0;
let processando = false;
let zScoreResultado = null;
let todosRegistrosSecretaria = [];
let filaHistorico = []; // { id, file, secretaria_codigo, periodo_referencia }

// ─── Utilitários ───────────────────────────────────────────────

function escapeHtml(value) {
  return String(value ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatarTamanho(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatarPeriodo(periodo) {
  const [ano, mes] = periodo.split('-');
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${meses[parseInt(mes, 10) - 1]}/${ano}`;
}

// ─── Log terminal ──────────────────────────────────────────────

function limparLog() {
  document.getElementById('log-terminal').innerHTML = '';
}

function addLog(mensagem, tipo = 'info') {
  const terminal = document.getElementById('log-terminal');
  const linha = document.createElement('div');
  linha.className = `log-line-${tipo}`;
  linha.textContent = `[${new Date().toLocaleTimeString('pt-BR')}] ${mensagem}`;
  terminal.appendChild(linha);
  terminal.scrollTop = terminal.scrollHeight;
}

// ─── Parser de nome de arquivo ───────────────────────────────────

function extrairMetadadosDoNome(nomeArquivo) {
  const base = nomeArquivo.replace(/\.txt$/i, '');

  // Formato: Previa589_2025-12 ou previa589_2025-12
  const matchHifen = base.match(/[Pp]revia[_]?(\d+)[_-](\d{4})-(\d{2})/);
  if (matchHifen) {
    return {
      secretaria_codigo: matchHifen[1],
      periodo_referencia: `${matchHifen[2]}-${matchHifen[3]}`
    };
  }

  // Formato: previa_589_202512 ou Previa589_202601
  const matchCompacto = base.match(/[Pp]revia[_]?(\d+)[_-](\d{4})(\d{2})/);
  if (matchCompacto) {
    return {
      secretaria_codigo: matchCompacto[1],
      periodo_referencia: `${matchCompacto[2]}-${matchCompacto[3]}`
    };
  }

  // Formato: 589_2026-01 ou 589_202601 (sem prefixo previa)
  const matchSecPeriodo = base.match(/(?:^|[_-])(\d{2,4})[_-](\d{4})-(\d{2})(?:$|[_-])/);
  if (matchSecPeriodo) {
    return {
      secretaria_codigo: matchSecPeriodo[1],
      periodo_referencia: `${matchSecPeriodo[2]}-${matchSecPeriodo[3]}`
    };
  }

  const matchSecCompacto = base.match(/(?:^|[_-])(\d{2,4})[_-](\d{4})(\d{2})(?:$|[_\-.])/);
  if (matchSecCompacto) {
    return {
      secretaria_codigo: matchSecCompacto[1],
      periodo_referencia: `${matchSecCompacto[2]}-${matchSecCompacto[3]}`
    };
  }

  // Apenas período no nome: _2026-01 ou _202601
  const matchSoPeriodoHifen = base.match(/(\d{4})-(\d{2})/);
  if (matchSoPeriodoHifen) {
    return {
      secretaria_codigo: null,
      periodo_referencia: `${matchSoPeriodoHifen[1]}-${matchSoPeriodoHifen[2]}`
    };
  }

  const matchSoPeriodoCompacto = base.match(/(?:^|[_-])(\d{4})(\d{2})(?:$|[_\-.])/);
  if (matchSoPeriodoCompacto) {
    return {
      secretaria_codigo: null,
      periodo_referencia: `${matchSoPeriodoCompacto[1]}-${matchSoPeriodoCompacto[2]}`
    };
  }

  return null;
}

// ─── Parser posicional ───────────────────────────────────────────

function converterData(dataStr) {
  const match = dataStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dia, mes, ano] = match;
  return `${ano}-${mes}-${dia}`;
}

function temEspacosConsecutivos(str) {
  return /  +/.test(str);
}

function parsearLinha(linha, numeroLinha) {
  if (!linha || linha.trim() === '') {
    return { valido: false, motivo: `Linha ${numeroLinha}: vazia ou apenas espaços` };
  }

  if (linha.length < 29) {
    return { valido: false, motivo: `Linha ${numeroLinha}: menos de 29 caracteres (${linha.length})` };
  }

  const areaData = linha.substring(10, 20);
  const areaCodigo = linha.substring(21, 24);

  if (temEspacosConsecutivos(areaData)) {
    return { valido: false, motivo: `Linha ${numeroLinha}: espaços consecutivos na área de data` };
  }

  if (temEspacosConsecutivos(areaCodigo)) {
    return { valido: false, motivo: `Linha ${numeroLinha}: espaços consecutivos na área de código` };
  }

  const matricula = linha.substring(2, 8).trim();
  const dataOcorrencia = areaData.trim();
  const codigoOcorrencia = areaCodigo.trim();
  const percentualStr = linha.substring(26, 29).trim();

  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataOcorrencia)) {
    return { valido: false, motivo: `Linha ${numeroLinha}: data inválida "${dataOcorrencia}"` };
  }

  const dataConvertida = converterData(dataOcorrencia);
  if (!dataConvertida) {
    return { valido: false, motivo: `Linha ${numeroLinha}: falha na conversão de data` };
  }

  const percentual = parseInt(percentualStr, 10);
  if (isNaN(percentual) || percentual < 0 || percentual > 100) {
    return { valido: false, motivo: `Linha ${numeroLinha}: percentual inválido "${percentualStr}"` };
  }

  return {
    valido: true,
    registro: {
      matricula,
      data_ocorrencia: dataConvertida,
      data_exibicao: dataOcorrencia,
      codigo_ocorrencia: codigoOcorrencia,
      percentual_desconto: percentual
    }
  };
}

function parsearArquivo(conteudo) {
  const linhas = conteudo.split(/\r?\n/);
  const validos = [];
  const descartados = [];

  linhas.forEach((linha, idx) => {
    const numeroLinha = idx + 1;
    const resultado = parsearLinha(linha, numeroLinha);
    if (resultado.valido) {
      validos.push(resultado.registro);
    } else if (linha.trim() !== '') {
      descartados.push(resultado.motivo);
    } else if (linha === '' || linha.trim() === '') {
      descartados.push(`Linha ${numeroLinha}: vazia ou apenas espaços`);
    }
  });

  return { validos, descartados, totalLinhas: linhas.length };
}

// ─── Z-Score ─────────────────────────────────────────────────────

function agruparPorPeriodo(registros) {
  const mapa = {};
  registros.forEach(r => {
    if (!mapa[r.periodo_referencia]) {
      mapa[r.periodo_referencia] = {
        periodo_referencia: r.periodo_referencia,
        total_ocorrencias: 0,
        servidores: new Set(),
        desconto_acumulado: 0
      };
    }
    mapa[r.periodo_referencia].total_ocorrencias++;
    mapa[r.periodo_referencia].servidores.add(r.matricula);
    mapa[r.periodo_referencia].desconto_acumulado += r.percentual_desconto;
  });

  return Object.values(mapa).map(p => ({
    periodo_referencia: p.periodo_referencia,
    total_ocorrencias: p.total_ocorrencias,
    servidores_afetados: p.servidores.size,
    desconto_acumulado: p.desconto_acumulado
  }));
}

function contarPorPeriodo(registros) {
  const mapa = {};
  registros.forEach(r => {
    mapa[r.periodo_referencia] = (mapa[r.periodo_referencia] || 0) + 1;
  });
  return mapa;
}

function calcularZScore(totalAtual, contagensAnteriores) {
  if (contagensAnteriores.length < 2) {
    return { zScore: null, media: null, desvio: null, insuficiente: true };
  }

  const media = contagensAnteriores.reduce((s, v) => s + v, 0) / contagensAnteriores.length;

  const variancia = contagensAnteriores.reduce((s, v) => s + Math.pow(v - media, 2), 0) / (contagensAnteriores.length - 1);
  const desvio = Math.sqrt(variancia);

  if (desvio === 0) {
    addLog(`Aviso: desvio padrão é zero (todos os valores anteriores são iguais: ${media}). Não é possível calcular Z-Score.`, 'warn');
    return { zScore: 0, media, desvio: 0, insuficiente: false };
  }

  const zScore = (totalAtual - media) / desvio;
  return { zScore, media, desvio, insuficiente: false };
}

function obterContagensAnteriores(contagensPorPeriodo, periodoReferencia, limite = 3) {
  return Object.entries(contagensPorPeriodo)
    .filter(([periodo]) => periodo < periodoReferencia)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, limite)
    .map(([, total]) => total);
}

// ─── Upload ──────────────────────────────────────────────────────

function setupUpload() {
  console.log('Setting up upload functionality...');
  const zone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');

  if (!zone || !fileInput) {
    console.error('Upload elements not found:', { zone, fileInput });
    return;
  }

  console.log('Upload elements found, adding event listeners');
  zone.addEventListener('click', (e) => {
    console.log('Upload zone clicked');
    e.preventDefault();
    fileInput.click();
  });

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) selecionarArquivo(file);
  });

  fileInput.addEventListener('change', (e) => {
    console.log('File input changed');
    const file = e.target.files[0];
    if (file) selecionarArquivo(file);
  });

  const btnRemover = document.getElementById('btn-remover-arquivo');
  const btnTrocar = document.getElementById('btn-trocar-arquivo');

  if (btnRemover) {
    btnRemover.addEventListener('click', removerArquivo);
  }
  if (btnTrocar) {
    btnTrocar.addEventListener('click', () => fileInput.click());
  }
}

function selecionarArquivo(file) {
  console.log('selecionarArquivo called with file:', file.name);
  if (!file.name.toLowerCase().endsWith('.txt')) {
    if (typeof Toast !== 'undefined' && Toast.show) {
      Toast.show('Apenas arquivos .txt são aceitos', 'error');
    } else {
      alert('Apenas arquivos .txt são aceitos');
    }
    return;
  }

  arquivoSelecionado = file;
  console.log('File selected successfully');

  document.getElementById('upload-file-name').textContent = file.name;
  document.getElementById('upload-file-size').textContent = formatarTamanho(file.size);
  document.getElementById('upload-file-info').classList.add('show');
  document.getElementById('upload-zone').style.display = 'none';

  const metadados = extrairMetadadosDoNome(file.name);
  if (metadados) {
    document.getElementById('secretaria_codigo').value = metadados.secretaria_codigo;
    document.getElementById('periodo_referencia').value = metadados.periodo_referencia;
    addLog(`Metadados extraídos do nome: secretaria ${metadados.secretaria_codigo}, período ${metadados.periodo_referencia}`, 'info');
    carregarHistorico();
  }

  validarFormulario();
  addLog(`Arquivo selecionado: ${file.name} (${formatarTamanho(file.size)})`, 'info');
}

function removerArquivo() {
  arquivoSelecionado = null;
  document.getElementById('file-input').value = '';
  document.getElementById('upload-file-info').classList.remove('show');
  document.getElementById('upload-zone').style.display = '';
  validarFormulario();
  resetarProcessamento();
}

// ─── Formulário ──────────────────────────────────────────────────

function validarFormulario() {
  const secretaria = document.getElementById('secretaria_codigo').value.trim();
  const periodo = document.getElementById('periodo_referencia').value;
  const btn = document.getElementById('btn-processar');

  btn.disabled = !arquivoSelecionado || !secretaria || !periodo || processando;
}

function setupFormulario() {
  ['secretaria_codigo', 'periodo_referencia', 'threshold_zscore'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      validarFormulario();
      if (id === 'secretaria_codigo') {
        clearTimeout(setupFormulario._debounce);
        setupFormulario._debounce = setTimeout(carregarHistorico, 400);
      }
    });
    document.getElementById(id).addEventListener('change', validarFormulario);
  });

  document.getElementById('btn-processar').addEventListener('click', processarArquivo);
  document.getElementById('preview-busca').addEventListener('input', renderizarPreview);
}

// ─── Processamento ───────────────────────────────────────────────

function resetarProcessamento() {
  registrosValidos = [];
  linhasDescartadas = [];
  totalLinhasLidas = 0;
  zScoreResultado = null;

  document.getElementById('preview-section').classList.remove('show');
  document.getElementById('anomalia-banner').classList.remove('show');
  document.getElementById('progress-bar-wrap').classList.remove('show');
  document.getElementById('resumo-final').classList.remove('show');
}

function readFileAsLatin1(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'latin1');
  });
}

async function processarArquivo() {
  if (processando || !arquivoSelecionado) return;

  processando = true;
  validarFormulario();
  resetarProcessamento();
  limparLog();

  const secretaria = document.getElementById('secretaria_codigo').value.trim();
  const periodo = document.getElementById('periodo_referencia').value;
  const threshold = parseFloat(document.getElementById('threshold_zscore').value);

  addLog('Iniciando processamento do arquivo...', 'info');

  try {
    const conteudo = await readFileAsLatin1(arquivoSelecionado);
    addLog('Arquivo lido com sucesso (encoding: latin1). Iniciando parse posicional...', 'info');

    const resultado = parsearArquivo(conteudo);
    registrosValidos = resultado.validos;
    linhasDescartadas = resultado.descartados;
    totalLinhasLidas = resultado.totalLinhas;

    addLog(`Total de linhas lidas: ${totalLinhasLidas}`, 'info');
    addLog(`Registros válidos: ${registrosValidos.length}`, 'ok');
    addLog(`Linhas descartadas: ${linhasDescartadas.length}`, linhasDescartadas.length > 0 ? 'warn' : 'info');

    // Mostrar primeiras 5 linhas descartadas
    const amostraDescartadas = linhasDescartadas.slice(0, 5);
    amostraDescartadas.forEach(motivo => addLog(motivo, 'warn'));
    if (linhasDescartadas.length > 5) {
      addLog(`... e mais ${linhasDescartadas.length - 5} linhas descartadas`, 'warn');
    }

    if (registrosValidos.length === 0) {
      addLog('Nenhum registro válido encontrado. Processamento encerrado.', 'err');
      processando = false;
      validarFormulario();
      return;
    }

    // Preview
    document.getElementById('preview-section').classList.add('show');
    renderizarPreview();

    // Z-Score
    addLog('Buscando histórico para cálculo de Z-Score...', 'info');
    const registrosHistorico = await getPreviasRegistros(secretaria, periodo);
    const contagensPorPeriodo = contarPorPeriodo(registrosHistorico);
    const contagensAnteriores = obterContagensAnteriores(contagensPorPeriodo, periodo, 3);

    zScoreResultado = calcularZScore(registrosValidos.length, contagensAnteriores);

    if (zScoreResultado.insuficiente) {
      addLog('Histórico insuficiente para cálculo de anomalia — mínimo 2 meses anteriores necessários', 'warn');
      exibirConfirmacaoNeutra();
    } else {
      const z = zScoreResultado.zScore;
      addLog(`Z-Score calculado: ${z.toFixed(2)}σ (média: ${zScoreResultado.media.toFixed(1)}, desvio: ${zScoreResultado.desvio.toFixed(1)})`, 'info');

      if (z >= threshold) {
        exibirBannerAnomalia(z, zScoreResultado.media, threshold);
      } else {
        exibirBannerNormal(z);
      }
    }

  } catch (err) {
    addLog(`Erro no processamento: ${err.message}`, 'err');
    Toast.show('Erro ao processar arquivo', 'error');
  }

  processando = false;
  validarFormulario();
}

// ─── Banners de anomalia ─────────────────────────────────────────

function esconderBanner() {
  document.getElementById('anomalia-banner').classList.remove('show');
}

function exibirBannerAnomalia(z, media, threshold) {
  const banner = document.getElementById('anomalia-banner');
  banner.className = 'anomalia-banner red show';

  document.getElementById('anomalia-title').textContent =
    '🚨 Anomalia Detectada — Revisar antes de enviar ao pagamento';

  document.getElementById('anomalia-msg').textContent =
    `Volume atual (${registrosValidos.length} ocorrências) está ${z.toFixed(2)}σ acima da média histórica de ${media.toFixed(1)} ocorrências. Investigue o arquivo antes de confirmar o envio ao pagamento.`;

  document.getElementById('anomalia-actions').innerHTML = `
    <button class="btn-confirm secondary" id="btn-cancelar-upload" type="button">Cancelar upload</button>
    <button class="btn-confirm danger" id="btn-confirmar-anomalia" type="button">Confirmar mesmo assim</button>
  `;

  // Cancelar: apenas fecha o banner, não insere nada
  document.getElementById('btn-cancelar-upload').addEventListener('click', () => {
    esconderBanner();
    addLog('Upload cancelado pelo usuário — nenhum dado foi inserido.', 'warn');
  });

  // Confirmar: usuário assume o risco e prossegue com o insert
  document.getElementById('btn-confirmar-anomalia').addEventListener('click', () => {
    esconderBanner();
    addLog('Usuário confirmou inserção mesmo com anomalia detectada.', 'warn');
    iniciarInsercao();
  });
}

function exibirConfirmacaoNeutra() {
  const banner = document.getElementById('anomalia-banner');
  banner.className = 'anomalia-banner green show';

  document.getElementById('anomalia-title').textContent = '⚠️ Histórico Insuficiente';
  document.getElementById('anomalia-msg').textContent =
    `${registrosValidos.length} registros válidos parseados. Histórico insuficiente para cálculo de anomalia — mínimo 2 meses anteriores necessários. Use a aba "Importação Histórica" para registrar prévias anteriores e enriquecer o Z-Score.`;

  document.getElementById('anomalia-actions').innerHTML = `
    <button class="btn-confirm secondary" id="btn-cancelar-neutro" type="button">Cancelar</button>
    <button class="btn-confirm primary" id="btn-confirmar-neutro" type="button">Confirmar e inserir</button>
  `;

  // Cancelar: fecha o banner sem inserir
  document.getElementById('btn-cancelar-neutro').addEventListener('click', () => {
    esconderBanner();
    addLog('Upload cancelado pelo usuário.', 'warn');
  });

  // Confirmar: prossegue com insert mesmo sem histórico para comparação
  document.getElementById('btn-confirmar-neutro').addEventListener('click', () => {
    esconderBanner();
    addLog('Inserção confirmada (sem histórico de referência).', 'info');
    iniciarInsercao();
  });
}

function exibirBannerNormal(z) {
  const banner = document.getElementById('anomalia-banner');
  banner.className = 'anomalia-banner green show';

  document.getElementById('anomalia-title').textContent = '✅ Prévia dentro do padrão normal';

  document.getElementById('anomalia-msg').textContent =
    `Prévia dentro do padrão normal (${z.toFixed(2)}σ). Volume de ${registrosValidos.length} ocorrências está dentro da faixa esperada. Pode prosseguir com o envio ao pagamento.`;

  document.getElementById('anomalia-actions').innerHTML = `
    <button class="btn-confirm secondary" id="btn-cancelar-normal" type="button">Cancelar</button>
    <button class="btn-confirm primary" id="btn-confirmar-normal" type="button">Confirmar e inserir</button>
  `;

  // Cancelar: fecha o banner sem inserir
  document.getElementById('btn-cancelar-normal').addEventListener('click', () => {
    esconderBanner();
    addLog('Upload cancelado pelo usuário.', 'warn');
  });

  // Confirmar: prossegue com o insert no Supabase
  document.getElementById('btn-confirmar-normal').addEventListener('click', () => {
    esconderBanner();
    addLog('Inserção confirmada pelo usuário.', 'ok');
    iniciarInsercao();
  });
}

// ─── Inserção no Supabase ────────────────────────────────────────

async function iniciarInsercao() {
  const secretaria = document.getElementById('secretaria_codigo').value.trim();
  const periodo = document.getElementById('periodo_referencia').value;

  const resultado = await executarInsercao(secretaria, periodo, registrosValidos, linhasDescartadas.length, {
    substituirAutomatico: false
  });

  if (!resultado || resultado.pulado) return;

  finalizarResumoInsercao(resultado);
}

function finalizarResumoInsercao(resultado, mensagemToast = null) {
  const { inseridos, erros, descartadas } = resultado;
  const resumo = `✔ ${inseridos} registros inseridos | ⚠ ${erros} erros | ✗ ${descartadas} linhas descartadas`;

  document.getElementById('progress-label').textContent = 'Inserção concluída';

  const resumoEl = document.getElementById('resumo-final');
  resumoEl.textContent = resumo;
  resumoEl.classList.add('show');

  if (inseridos > 0) {
    Toast.show(mensagemToast || `${inseridos} registros inseridos com sucesso`, 'success');
    carregarHistorico();
  }
}

async function executarInsercao(secretaria, periodo, validos, qtdDescartadas, opcoes = {}) {
  const { substituirAutomatico = false, silencioso = false } = opcoes;

  if (!silencioso) addLog('Verificando registros existentes...', 'info');

  try {
    const existentes = await countPreviasExistentes(secretaria, periodo);

    if (existentes > 0) {
      addLog(`Já existem ${existentes} registros para ${periodo} / secretaria ${secretaria}`, 'warn');

      let substituir = substituirAutomatico;
      if (!substituirAutomatico) {
        substituir = confirm(
          'Já existem registros para este período e secretaria.\nDeseja substituir (apagar e reinserir) ou cancelar?'
        );
      }

      if (!substituir) {
        addLog('Inserção cancelada — registros existentes mantidos.', 'warn');
        return { inseridos: 0, erros: 0, descartadas: qtdDescartadas, pulado: true };
      }

      addLog('Removendo registros existentes...', 'info');
      await deletePreviasPeriodo(secretaria, periodo);
      addLog('Registros anteriores removidos.', 'ok');
    }

    return await inserirEmLotes(secretaria, periodo, validos, qtdDescartadas, opcoes);

  } catch (err) {
    addLog(`Erro na inserção: ${err.message}`, 'err');
    if (!silencioso) Toast.show('Erro ao inserir registros', 'error');
    throw err;
  }
}

async function inserirEmLotes(secretaria, periodo, validos, qtdDescartadas, opcoes = {}) {
  const { labelProgresso = null } = opcoes;

  const registros = validos.map(r => ({
    periodo_referencia: periodo,
    secretaria_codigo: secretaria,
    matricula: r.matricula,
    data_ocorrencia: r.data_ocorrencia,
    codigo_ocorrencia: r.codigo_ocorrencia,
    percentual_desconto: r.percentual_desconto
  }));

  const totalLotes = Math.ceil(registros.length / BATCH_SIZE);
  let inseridos = 0;
  let erros = 0;

  const progressWrap = document.getElementById('progress-bar-wrap');
  const progressLabel = document.getElementById('progress-label');
  const progressFill = document.getElementById('progress-fill');
  progressWrap.classList.add('show');

  addLog(`Iniciando inserção em ${totalLotes} lote(s) de até ${BATCH_SIZE} registros...`, 'info');

  for (let i = 0; i < totalLotes; i++) {
    const lote = registros.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const numLote = i + 1;

    const prefixo = labelProgresso ? `${labelProgresso} — ` : '';
    progressLabel.textContent = `${prefixo}Inserindo lote ${numLote} de ${totalLotes}...`;
    progressFill.style.width = `${(numLote / totalLotes) * 100}%`;

    try {
      await insertPreviasLote(lote);
      inseridos += lote.length;
      addLog(`${prefixo}Lote ${numLote}/${totalLotes}: ${lote.length} registros inseridos`, 'ok');
    } catch (err) {
      erros += lote.length;
      addLog(`${prefixo}Lote ${numLote}/${totalLotes}: erro — ${err.message}`, 'err');
    }
  }

  progressFill.style.width = '100%';

  const resumo = `✔ ${inseridos} registros inseridos | ⚠ ${erros} erros | ✗ ${qtdDescartadas} linhas descartadas`;
  addLog(resumo, inseridos > 0 ? 'ok' : 'err');

  return { inseridos, erros, descartadas: qtdDescartadas };
}

// ─── Preview ─────────────────────────────────────────────────────

function renderizarPreview() {
  const busca = document.getElementById('preview-busca').value.trim().toLowerCase();
  const filtrados = busca
    ? registrosValidos.filter(r => r.matricula.toLowerCase().includes(busca))
    : registrosValidos;

  const exibir = filtrados.slice(0, PREVIEW_LIMIT);
  const tbody = document.getElementById('preview-tbody');

  tbody.innerHTML = exibir.map(r => `
    <tr class="${r.percentual_desconto === 100 ? 'row-alerta' : ''}">
      <td>${escapeHtml(r.matricula)}</td>
      <td>${escapeHtml(r.data_exibicao)}</td>
      <td>${escapeHtml(r.codigo_ocorrencia)}</td>
      <td>${r.percentual_desconto}%</td>
      <td><span class="status-valido">Válido</span></td>
    </tr>
  `).join('');

  document.getElementById('preview-counter').textContent =
    `Exibindo ${exibir.length} de ${filtrados.length} registros` +
    (filtrados.length !== registrosValidos.length ? ` (${registrosValidos.length} total)` : '');
}

// ─── Histórico ───────────────────────────────────────────────────

async function carregarHistorico() {
  const secretaria = document.getElementById('secretaria_codigo').value.trim();
  const tbody = document.getElementById('historico-tbody');
  const threshold = parseFloat(document.getElementById('threshold_zscore').value);

  if (!secretaria) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Informe o código da secretaria para ver o histórico</td></tr>';
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Carregando histórico...</td></tr>';

  try {
    const registros = await getPreviasRegistros(secretaria);
    todosRegistrosSecretaria = registros;

    // Load last 6 periods for Tab 1 (simulation)
    const periodos = agruparPorPeriodo(registros)
      .sort((a, b) => b.periodo_referencia.localeCompare(a.periodo_referencia))
      .slice(0, 6);

    if (periodos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Nenhum período registrado para esta secretaria</td></tr>';
      return;
    }

    const contagensPorPeriodo = contarPorPeriodo(registros);

    tbody.innerHTML = periodos.map(p => {
      const contagensAnteriores = obterContagensAnteriores(contagensPorPeriodo, p.periodo_referencia, 3);
      const zResult = calcularZScore(p.total_ocorrencias, contagensAnteriores);

      let zDisplay, statusHtml;

      if (zResult.insuficiente) {
        zDisplay = '—';
        statusHtml = '<span class="status-badge insuficiente">Sem histórico</span>';
      } else {
        zDisplay = `${zResult.zScore.toFixed(2)}σ`;
        const isAnomalia = zResult.zScore >= threshold;
        const isAtencao = zResult.zScore >= 1.5 && zResult.zScore < threshold;
        
        if (isAnomalia) {
          statusHtml = '<span class="status-badge anomalia">Anomalia</span>';
        } else if (isAtencao) {
          statusHtml = '<span class="status-badge atencao">Atenção</span>';
        } else {
          statusHtml = '<span class="status-badge normal">Normal</span>';
        }
      }

      return `
        <tr>
          <td>${formatarPeriodo(p.periodo_referencia)}</td>
          <td>${p.total_ocorrencias.toLocaleString('pt-BR')}</td>
          <td>${p.servidores_afetados.toLocaleString('pt-BR')}</td>
          <td>${p.desconto_acumulado.toLocaleString('pt-BR')}%</td>
          <td class="${zResult.insuficiente ? '' : (zResult.zScore >= threshold ? 'zscore-anomalia' : (zResult.zScore >= 1.5 ? 'zscore-atencao' : 'zscore-normal'))}">${zDisplay}</td>
          <td>${statusHtml}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--red);padding:24px">Erro ao carregar histórico: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ─── Importação histórica em lote ────────────────────────────────

let proximoIdHistorico = 1;

function setupModoTabs() {
  const tabPrevia = document.getElementById('tab-previa');
  const tabHistorico = document.getElementById('tab-historico');
  const panelPrevia = document.getElementById('panel-previa');
  const panelHistorico = document.getElementById('panel-historico');

  tabPrevia.addEventListener('click', () => {
    tabPrevia.classList.add('active');
    tabHistorico.classList.remove('active');
    panelPrevia.classList.add('active');
    panelHistorico.classList.remove('active');
  });

  tabHistorico.addEventListener('click', () => {
    tabHistorico.classList.add('active');
    tabPrevia.classList.remove('active');
    panelHistorico.classList.add('active');
    panelPrevia.classList.remove('active');

    // Sincronizar secretaria entre abas
    const sec = document.getElementById('secretaria_codigo').value.trim();
    if (sec && !document.getElementById('hist_secretaria_codigo').value.trim()) {
      document.getElementById('hist_secretaria_codigo').value = sec;
    }
  });
}

function setupHistoricoUpload() {
  const zone = document.getElementById('hist-upload-zone');
  const fileInput = document.getElementById('hist-file-input');

  zone.addEventListener('click', () => fileInput.click());

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    adicionarArquivosHistorico(Array.from(e.dataTransfer.files));
  });

  fileInput.addEventListener('change', (e) => {
    adicionarArquivosHistorico(Array.from(e.target.files));
    fileInput.value = '';
  });

  document.getElementById('hist_secretaria_codigo').addEventListener('input', () => {
    atualizarSecretariaFilaHistorico();
    validarFilaHistorico();
  });

  document.getElementById('btn-importar-historico').addEventListener('click', importarHistorico);
}

function adicionarArquivosHistorico(files) {
  const secretariaPadrao = document.getElementById('hist_secretaria_codigo').value.trim()
    || document.getElementById('secretaria_codigo').value.trim();

  const txtFiles = files.filter(f => f.name.toLowerCase().endsWith('.txt'));
  if (txtFiles.length === 0) {
    Toast.show('Selecione apenas arquivos .txt', 'error');
    return;
  }

  txtFiles.forEach(file => {
    const metadados = extrairMetadadosDoNome(file.name);
    const jaExiste = filaHistorico.some(item => item.file.name === file.name && item.file.size === file.size);
    if (jaExiste) return;

    filaHistorico.push({
      id: proximoIdHistorico++,
      file,
      secretaria_codigo: metadados?.secretaria_codigo || secretariaPadrao || '',
      periodo_referencia: metadados?.periodo_referencia || ''
    });
  });

  filaHistorico.sort((a, b) => a.periodo_referencia.localeCompare(b.periodo_referencia));
  renderizarFilaHistorico();
  validarFilaHistorico();
}

function atualizarSecretariaFilaHistorico() {
  const padrao = document.getElementById('hist_secretaria_codigo').value.trim();
  filaHistorico.forEach(item => {
    if (!extrairMetadadosDoNome(item.file.name)?.secretaria_codigo) {
      item.secretaria_codigo = padrao;
    }
  });
  renderizarFilaHistorico();
}

function renderizarFilaHistorico() {
  const listEl = document.getElementById('hist-file-list');
  const tbody = document.getElementById('hist-file-tbody');

  if (filaHistorico.length === 0) {
    listEl.style.display = 'none';
    tbody.innerHTML = '';
    return;
  }

  listEl.style.display = 'block';
  tbody.innerHTML = filaHistorico.map(item => {
    const ok = item.secretaria_codigo && item.periodo_referencia;
    return `
      <tr>
        <td title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</td>
        <td>
          <input type="text" data-id="${item.id}" data-field="secretaria" value="${escapeHtml(item.secretaria_codigo)}" maxlength="10">
        </td>
        <td>
          <input type="month" data-id="${item.id}" data-field="periodo" value="${escapeHtml(item.periodo_referencia)}">
        </td>
        <td>${ok ? '<span class="hist-badge-ok">OK</span>' : '<span class="hist-badge-warn">Pendente</span>'}</td>
        <td><button class="btn-sm danger" data-remove="${item.id}" type="button">×</button></td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('input[data-field]').forEach(input => {
    input.addEventListener('change', (e) => {
      const id = parseInt(e.target.dataset.id, 10);
      const field = e.target.dataset.field;
      const item = filaHistorico.find(f => f.id === id);
      if (!item) return;

      if (field === 'secretaria') item.secretaria_codigo = e.target.value.trim();
      if (field === 'periodo') item.periodo_referencia = e.target.value;

      validarFilaHistorico();
      renderizarFilaHistorico();
    });
  });

  tbody.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.remove, 10);
      filaHistorico = filaHistorico.filter(f => f.id !== id);
      renderizarFilaHistorico();
      validarFilaHistorico();
    });
  });
}

function validarFilaHistorico() {
  const btn = document.getElementById('btn-importar-historico');
  const todosOk = filaHistorico.length > 0 && filaHistorico.every(
    f => f.secretaria_codigo && f.periodo_referencia
  );
  btn.disabled = !todosOk || processando;
}

async function importarHistorico() {
  if (processando || filaHistorico.length === 0) return;

  const substituir = document.getElementById('hist-substituir').checked;
  const periodos = filaHistorico.map(f => formatarPeriodo(f.periodo_referencia)).join(', ');

  // First pass: parse all files to get count
  let totalRegistros = 0;
  for (const item of filaHistorico) {
    try {
      const conteudo = await readFileAsLatin1(item.file);
      const resultado = parsearArquivo(conteudo);
      totalRegistros += resultado.validos.length;
    } catch (err) {
      // If parsing fails, we'll handle it in the main loop
    }
  }

  const confirmar = confirm(
    `⚠️ IMPORTAÇÃO PARA HISTÓRICO PERMANENTE ⚠️\n\n` +
    `Você está prestes a adicionar ${totalRegistros.toLocaleString('pt-BR')} registros ao histórico permanente.\n` +
    `Esta ação alimentará as comparações futuras de Z-Score.\n\n` +
    `Arquivos: ${filaHistorico.length}\n` +
    `Períodos: ${periodos}\n` +
    `Secretaria: ${filaHistorico[0].secretaria_codigo}\n\n` +
    (substituir ? 'Períodos existentes serão substituídos.' : 'Períodos existentes serão ignorados.') +
    '\n\nConfirmar importação?'
  );

  if (!confirmar) return;

  processando = true;
  validarFilaHistorico();
  validarFormulario();
  limparLog();
  resetarProcessamento();

  document.getElementById('anomalia-banner').classList.remove('show');
  document.getElementById('preview-section').classList.remove('show');

  addLog('═══ Importação histórica iniciada ═══', 'info');
  addLog(`${filaHistorico.length} arquivo(s) na fila — sem validação de Z-Score`, 'info');

  const filaOrdenada = [...filaHistorico].sort(
    (a, b) => a.periodo_referencia.localeCompare(b.periodo_referencia)
  );

  let totalInseridos = 0;
  let totalErros = 0;
  let totalDescartadas = 0;
  let arquivosOk = 0;

  try {
    for (let i = 0; i < filaOrdenada.length; i++) {
      const item = filaOrdenada[i];
      const label = `${formatarPeriodo(item.periodo_referencia)} (${i + 1}/${filaOrdenada.length})`;

      addLog(`── Processando ${item.file.name} [${label}] ──`, 'info');

      const conteudo = await item.file.text();
      const resultado = parsearArquivo(conteudo);

      addLog(`${label}: ${resultado.validos.length} válidos, ${resultado.descartados.length} descartados`, 'ok');

      if (resultado.validos.length === 0) {
        addLog(`${label}: nenhum registro válido — arquivo ignorado`, 'warn');
        continue;
      }

      const insertResult = await executarInsercao(
        item.secretaria_codigo,
        item.periodo_referencia,
        resultado.validos,
        resultado.descartados.length,
        { substituirAutomatico: substituir, labelProgresso: label }
      );

      if (insertResult && !insertResult.pulado) {
        totalInseridos += insertResult.inseridos;
        totalErros += insertResult.erros;
        totalDescartadas += insertResult.descartadas;
        arquivosOk++;
      }
    }

    addLog('═══ Importação histórica concluída ═══', 'info');
    const resumoGeral = `✔ ${totalInseridos} registros inseridos em ${arquivosOk} período(s) | ⚠ ${totalErros} erros | ✗ ${totalDescartadas} linhas descartadas`;
    addLog(resumoGeral, totalInseridos > 0 ? 'ok' : 'warn');

    finalizarResumoInsercao(
      { inseridos: totalInseridos, erros: totalErros, descartadas: totalDescartadas },
      `Histórico importado: ${arquivosOk} período(s), ${totalInseridos.toLocaleString('pt-BR')} registros`
    );

    if (filaOrdenada[0]?.secretaria_codigo) {
      document.getElementById('secretaria_codigo').value = filaOrdenada[0].secretaria_codigo;
    }

    if (totalInseridos > 0) {
      filaHistorico = [];
      renderizarFilaHistorico();
    }

  } catch (err) {
    addLog(`Erro na importação histórica: ${err.message}`, 'err');
    Toast.show('Erro na importação histórica', 'error');
  }

  processando = false;
  validarFilaHistorico();
  validarFormulario();
  await carregarHistorico();
}

// ─── Inicialização ───────────────────────────────────────────────

function atualizarTopbar() {
  document.getElementById('topbar-date').textContent =
    `Atualizado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`;
}

function inicializar() {
  console.log('Initializing previas-frequencia module');
  atualizarTopbar();
  setupModoTabs();
  setupUpload();
  setupHistoricoUpload();
  setupFormulario();
  validarFormulario();

  // Aguardar config-db carregar
  setTimeout(carregarHistorico, 200);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inicializar);
} else {
  inicializar();
}
