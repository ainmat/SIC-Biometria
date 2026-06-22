export const CODIGO_FALTA  = '171';
export const CODIGO_ATRASO = '335';

export function calcularMedia(valores) {
  if (!valores.length) return 0;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

export function calcularDesvioPadrao(valores) {
  if (valores.length < 2) return 0;
  const media = calcularMedia(valores);
  const variancia = valores.reduce((s, v) => s + (v - media) ** 2, 0) / (valores.length - 1);
  return Math.sqrt(variancia);
}

export function calcularZScore(valor, media, desvio) {
  if (!desvio || desvio === 0) return null;
  return (valor - media) / desvio;
}

export function classificarZScore(z) {
  if (z === null || z === undefined) return 'sem_historico';
  if (z >= 2.0) return 'anomalia_critica';
  if (z >= 1.5) return 'atencao';
  if (z >= 1.0) return 'elevado';
  return 'normal';
}

export function labelClassificacao(classificacao) {
  const map = {
    anomalia_critica: '🚨 ANOMALIA CRÍTICA',
    atencao:          '⚠️ ATENÇÃO',
    elevado:          '📈 ELEVADO',
    normal:           '✅ NORMAL',
    sem_historico:    '📋 SEM HISTÓRICO',
  };
  return map[classificacao] || classificacao;
}

export function corClassificacao(classificacao) {
  const map = {
    anomalia_critica: '#ef4444',
    atencao:          '#f59e0b',
    elevado:          '#f97316',
    normal:           '#10b981',
    sem_historico:    '#64748b',
  };
  return map[classificacao] || '#64748b';
}

/**
 * Analisa o total atual comparado ao histórico de períodos anteriores.
 * historico: [{ periodo_referencia, total_ocorrencias, total_faltas?, total_atrasos? }]
 * ordenado DESC (mais recente primeiro).
 */
export function analisarComHistorico(totalAtual, historico) {
  const valores = historico.map(h => h.total_ocorrencias);

  const slice3  = valores.slice(0, 3);
  const slice6  = valores.slice(0, 6);
  const slice12 = valores.slice(0, 12);

  const media3m  = calcularMedia(slice3);
  const media6m  = calcularMedia(slice6);
  const media12m = calcularMedia(slice12);

  const desvio3m = calcularDesvioPadrao(slice3);
  const zScore   = slice3.length >= 2 ? calcularZScore(totalAtual, media3m, desvio3m) : null;

  const delta = (atual, media) => media ? Math.round(((atual - media) / media) * 100) : null;

  return {
    media3m:       Math.round(media3m),
    media6m:       Math.round(media6m),
    media12m:      Math.round(media12m),
    desvio3m:      Math.round(desvio3m * 10) / 10,
    zScore:        zScore !== null ? Math.round(zScore * 100) / 100 : null,
    classificacao: classificarZScore(zScore),
    deltaPct3m:    delta(totalAtual, media3m),
    deltaPct6m:    delta(totalAtual, media6m),
    deltaPct12m:   delta(totalAtual, media12m),
    mesesHistorico: historico.length,
  };
}

/**
 * P10 — Calcula Z-Scores separados para faltas e atrasos,
 * além do Z-Score total. Retorna tudo mesclado.
 * historico deve ter total_faltas e total_atrasos por período.
 */
export function analisarComHistoricoTipado(faltasAtual, atrasosAtual, historico) {
  const total = faltasAtual + atrasosAtual;

  const analiseTotal = analisarComHistorico(total, historico);

  const calcZTipo = (atual, campo) => {
    const valores = historico.map(h => h[campo] ?? 0);
    const slice3  = valores.slice(0, 3);
    if (slice3.length < 2) return null;
    const media  = calcularMedia(slice3);
    const desvio = calcularDesvioPadrao(slice3);
    return calcularZScore(atual, media, desvio);
  };

  const zFaltas  = calcZTipo(faltasAtual,  'total_faltas');
  const zAtrasos = calcZTipo(atrasosAtual, 'total_atrasos');

  const media3mFaltas  = Math.round(calcularMedia(historico.slice(0, 3).map(h => h.total_faltas  ?? 0)));
  const media3mAtrasos = Math.round(calcularMedia(historico.slice(0, 3).map(h => h.total_atrasos ?? 0)));

  return {
    ...analiseTotal,
    zScoreFaltas:        zFaltas  !== null ? Math.round(zFaltas  * 100) / 100 : null,
    zScoreAtrasos:       zAtrasos !== null ? Math.round(zAtrasos * 100) / 100 : null,
    classificacaoFaltas:  classificarZScore(zFaltas),
    classificacaoAtrasos: classificarZScore(zAtrasos),
    media3mFaltas,
    media3mAtrasos,
  };
}

export function detectarAnomalias(registros, historico) {
  const anomalias = [];
  const totalAtual = registros.length;

  if (historico.length >= 2) {
    const analise = analisarComHistorico(totalAtual, historico);
    const { classificacao, deltaPct3m, media3m } = analise;

    if (classificacao === 'anomalia_critica' || classificacao === 'atencao') {
      anomalias.push({
        nivel: classificacao,
        mensagem: `Total de ocorrências ${deltaPct3m > 0 ? `${deltaPct3m}% acima` : `${Math.abs(deltaPct3m)}% abaixo`} da média histórica de 3 meses (média: ${media3m})`,
      });
    }
  }

  const contagem = {};
  registros.forEach(r => {
    contagem[r.matricula] = (contagem[r.matricula] || 0) + 1;
  });
  const comMultiplas = Object.entries(contagem)
    .filter(([, c]) => c >= 3)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (comMultiplas.length > 0) {
    anomalias.push({
      nivel: 'atencao',
      mensagem: `${comMultiplas.length} matrícula(s) com 3 ou mais ocorrências`,
      detalhe: comMultiplas.map(([m, c]) => `${m}: ${c} ocorrências`).join(' · '),
    });
  }

  const descontos = {};
  registros.forEach(r => {
    descontos[r.matricula] = (descontos[r.matricula] || 0) + (r.percentual_desconto || 0);
  });
  const altoDesconto = Object.entries(descontos)
    .filter(([, d]) => d >= 50)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (altoDesconto.length > 0) {
    anomalias.push({
      nivel: 'atencao',
      mensagem: `${altoDesconto.length} matrícula(s) com 50% ou mais de desconto acumulado`,
      detalhe: altoDesconto.map(([m, d]) => `${m}: ${d}%`).join(' · '),
    });
  }

  return anomalias;
}

export function classificarOcorrencias(registros) {
  const temCodigo = registros.some(r => r.codigo_ocorrencia);

  if (!temCodigo) {
    return { faltas: 0, atrasos: 0, outros: 0, outrosCodigos: [], semCodigo: true };
  }

  const faltas     = registros.filter(r => r.codigo_ocorrencia === CODIGO_FALTA).length;
  const atrasos    = registros.filter(r => r.codigo_ocorrencia === CODIGO_ATRASO).length;
  const outrosRegs = registros.filter(r => r.codigo_ocorrencia !== CODIGO_FALTA && r.codigo_ocorrencia !== CODIGO_ATRASO);
  const outros     = outrosRegs.length;

  const porCodigo = {};
  outrosRegs.forEach(r => {
    porCodigo[r.codigo_ocorrencia] = (porCodigo[r.codigo_ocorrencia] || 0) + 1;
  });
  const outrosCodigos = Object.entries(porCodigo).sort(([, a], [, b]) => b - a);

  return { faltas, atrasos, outros, outrosCodigos, semCodigo: false };
}

export function parsePosicional(texto) {
  const linhas = texto.split(/\r?\n/);
  const validos = [];
  const descartados = [];

  linhas.forEach((linha, idx) => {
    if (!linha || linha.trim() === '') return;

    if (linha.length < 29) {
      descartados.push({ linha: idx + 1, motivo: `Linha curta (${linha.length} chars)`, raw: linha });
      return;
    }

    const areaMatricula  = linha.substring(2, 8).trim();
    const areaData       = linha.substring(10, 20).trim();
    const areaCodigo     = linha.substring(21, 24).trim();
    const areaPercentual = linha.substring(26, 29).trim();

    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(areaData)) {
      // Linhas sem data = outras rubricas/verbas — não são faltas/atrasos, ignora silenciosamente
      return;
    }

    const percentual = parseInt(areaPercentual, 10);
    if (isNaN(percentual) || percentual < 0) {
      descartados.push({ linha: idx + 1, motivo: `Percentual inválido: "${areaPercentual}"`, raw: linha });
      return;
    }

    const [d, m, a] = areaData.split('/');
    validos.push({
      matricula:           areaMatricula,
      data_ocorrencia:     `${a}-${m}-${d}`,
      codigo_ocorrencia:   areaCodigo,
      percentual_desconto: percentual,
    });
  });

  return { validos, descartados };
}

export function parseDelimitado(texto) {
  const linhas = texto.split(/\r?\n/);
  const validos = [];
  const descartados = [];

  linhas.forEach((linha, idx) => {
    const t = linha.trim();
    if (!t) return;

    const partes = t.split(/[;\t,|]/);
    if (partes.length < 2) {
      descartados.push({ linha: idx + 1, motivo: 'Separador não encontrado', raw: t });
      return;
    }

    const matricula = partes[0]?.trim();
    const pct = parseFloat(partes[1]?.trim().replace(',', '.'));

    if (!matricula || matricula.length < 3) {
      descartados.push({ linha: idx + 1, motivo: 'Matrícula inválida', raw: t });
      return;
    }
    if (isNaN(pct) || pct < 0) {
      descartados.push({ linha: idx + 1, motivo: 'Percentual inválido', raw: t });
      return;
    }

    validos.push({ matricula, percentual_desconto: pct });
  });

  return { validos, descartados };
}

export function parseArquivo(texto) {
  const primeiras = texto.split(/\r?\n/).filter(l => l.trim()).slice(0, 10);
  // Formato SIC posicional: linhas de 29+ chars começando com 10 dígitos (matrícula)
  const posicional = primeiras.length > 0 && primeiras.every(l => l.length >= 29 && /^\d{10}/.test(l));
  return posicional ? parsePosicional(texto) : parseDelimitado(texto);
}

/**
 * Compara dois arrays de registros parseados e retorna as diferenças por matrícula.
 * Não faz chamadas a backend — lógica puramente local.
 */
export function compararArquivos(validosA, validosB) {
  const agrupar = (registros) => {
    const mapa = {};
    for (const r of registros) {
      if (!r.matricula) continue;
      if (!mapa[r.matricula]) mapa[r.matricula] = { faltas: 0, atrasos: 0 };
      if (r.codigo_ocorrencia === CODIGO_FALTA)  mapa[r.matricula].faltas++;
      if (r.codigo_ocorrencia === CODIGO_ATRASO) mapa[r.matricula].atrasos++;
    }
    return mapa;
  };

  const mapaA = agrupar(validosA);
  const mapaB = agrupar(validosB);
  const matsA = new Set(Object.keys(mapaA));
  const matsB = new Set(Object.keys(mapaB));

  const apenasA = [...matsA]
    .filter(m => !matsB.has(m))
    .sort()
    .map(m => ({
      matricula: m,
      faltasA: mapaA[m].faltas,  atrasosA: mapaA[m].atrasos,
      faltasB: 0,                 atrasosB: 0,
      diffFaltas: -mapaA[m].faltas, diffAtrasos: -mapaA[m].atrasos,
      status: 'apenas_a',
    }));

  const apenasB = [...matsB]
    .filter(m => !matsA.has(m))
    .sort()
    .map(m => ({
      matricula: m,
      faltasA: 0,                  atrasosA: 0,
      faltasB: mapaB[m].faltas,    atrasosB: mapaB[m].atrasos,
      diffFaltas: mapaB[m].faltas, diffAtrasos: mapaB[m].atrasos,
      status: 'apenas_b',
    }));

  const comuns = [...matsA]
    .filter(m => matsB.has(m))
    .map(m => {
      const a = mapaA[m], b = mapaB[m];
      const diffFaltas  = b.faltas  - a.faltas;
      const diffAtrasos = b.atrasos - a.atrasos;
      return {
        matricula: m,
        faltasA:  a.faltas,  atrasosA: a.atrasos,
        faltasB:  b.faltas,  atrasosB: b.atrasos,
        diffFaltas, diffAtrasos,
        status: diffFaltas === 0 && diffAtrasos === 0 ? 'igual' : 'alterado',
      };
    });

  const alterados = comuns
    .filter(r => r.status === 'alterado')
    .sort((a, b) => (Math.abs(b.diffFaltas) + Math.abs(b.diffAtrasos)) - (Math.abs(a.diffFaltas) + Math.abs(a.diffAtrasos)));

  const iguais = comuns
    .filter(r => r.status === 'igual')
    .sort((a, b) => a.matricula.localeCompare(b.matricula));

  return { apenasA, apenasB, alterados, iguais, totalA: matsA.size, totalB: matsB.size };
}
