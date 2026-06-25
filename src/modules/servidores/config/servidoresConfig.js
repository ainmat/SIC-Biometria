// ── Comissionados ────────────────────────────────────────────────────────────
// ⚠️ CONFIRMAR COM RH: substrings que identificam cargo em comissão.
export const COMISSIONADOS = {
  padroes: ['comissão', 'comissao', 'comissionado', 'cargo comiss'],
};

export const ALERTAS = {
  maxPctComissionados: 15, // % acima → alerta
  maxIdadeMedia: 55,
};

// ── Professores / Magistério ──────────────────────────────────────────────────
// ⚠️ CONFIRMAR COM RH: quais substrings em Des_Cargo identificam magistério.
// Redução de 5 anos na idade e contribuição mínima (CF art. 201 §8º / EC 103/2019).
export const PROFESSOR = {
  padroes: ['professor', 'docente', 'magistério', 'magisterio', 'pedagogo', 'educação', 'educacao'],
  reducaoIdadeAnos: 5,    // ⚠️ CONFIRMAR
  reducaoContribAnos: 5,  // ⚠️ CONFIRMAR
};

// ── RPPS detection ───────────────────────────────────────────────────────────
// ⚠️ CONFIRMAR COM RH: Osasco tem RPPS próprio? Quais valores de Des_RegTrab
// identificam RPPS? Deixar vazio enquanto não confirmado — todos serão RGPS.
export const RPPS_PATTERNS = [];

// ── Aposentadoria compulsória (todos os regimes) ─────────────────────────────
// ⚠️ CONFIRMAR COM JURÍDICO.
export const COMPULSORIA = { idade: 75 };

// ── RGPS — valores 2026 (EC 103/2019) ───────────────────────────────────────
// ⚠️ CONFIRMAR COM RH/JURÍDICO antes de usar em decisões formais.
// Nota: regras de transição (pontos, pedágio) permitem elegibilidade mais cedo
// para segurados anteriores a 13/11/2019, mas exigem tempo total (CNIS) —
// não disponível. Este modelo pode SUBESTIMAR elegíveis.
export const RGPS = {
  idadeMin:       { H: 65, M: 62 }, // ⚠️ CONFIRMAR
  contribMinAnos: { H: 20, M: 15 }, // ⚠️ CONFIRMAR
};

// ── RPPS — valores 2026 ───────────────────────────────────────────────────────
// ⚠️ CONFIRMAR: este bloco só entra em vigor quando RPPS_PATTERNS for preenchido.
export const RPPS = {
  idadeMin:              { H: 65, M: 62 }, // ⚠️ CONFIRMAR
  contribMinAnos:        25,                // ⚠️ CONFIRMAR
  servicoPublicoMinAnos: 10,               // ⚠️ CONFIRMAR
  tempoNoCargoMinAnos:   5,                // ⚠️ CONFIRMAR
};

// ── Projeção ─────────────────────────────────────────────────────────────────
export const PROJECAO = {
  horizonteAnos: 5,   // horizonte padrão para alertas e secretarias
  alertaAntes:   3,   // destacar elegíveis em até N anos
  maxCurvaAnos:  10,  // extensão máxima da curva ano a ano
};

// Alias de compatibilidade — telas antigas lêem APOSENTADORIA.alertaAntes etc.
export const APOSENTADORIA = {
  idadeMinima:        { Masculino: RGPS.idadeMin.H, Feminino: RGPS.idadeMin.M, _default: RGPS.idadeMin.H },
  contribuicaoMinima: { Masculino: RGPS.contribMinAnos.H, Feminino: RGPS.contribMinAnos.M, _default: RGPS.contribMinAnos.H },
  horizonte:          PROJECAO.horizonteAnos,
  alertaAntes:        PROJECAO.alertaAntes,
};

// ── Funções utilitárias ──────────────────────────────────────────────────────

export function isComissionado(r) {
  const txt = ((r.Des_CategSefip || '') + ' ' + (r.Des_Padrao_Adm || '')).toLowerCase();
  return COMISSIONADOS.padroes.some(p => txt.includes(p));
}

export function isProfessor(r) {
  const cargo = (r.Des_Cargo || '').toLowerCase();
  return PROFESSOR.padroes.some(p => cargo.includes(p));
}

export function classifyRegime(r) {
  if (RPPS_PATTERNS.length > 0) {
    const txt = (r.Des_RegTrab || '').toLowerCase();
    if (RPPS_PATTERNS.some(p => txt.includes(p))) return 'RPPS';
  }
  return 'RGPS';
}

// ── Motor de elegibilidade ───────────────────────────────────────────────────
//
// Faixas de confiança — retornadas por computeFaixa(r, N):
//
//   elegivel_por_idade    — atingiu os 75 anos (compulsória). Elegível certo,
//                           independente do tempo de contribuição.
//
//   provavelmente_elegivel — atingiu a idade mínima do regime E o tempo de casa
//                            sozinho já satisfaz o mínimo de contribuição.
//                            Alta confiança: fecharia mesmo sem contrib. anterior.
//
//   possivelmente_elegivel — atingiu a idade, mas tempo de casa < mínimo.
//                            Pode ter contribuições anteriores (CNIS) que
//                            completem. Sinalizar para validação individual RH.
//
//   nao_elegivel           — não atingiu a idade mínima no horizonte dado.
//
// ⚠️ Tempo_Contrato_Anos é PISO (só esta prefeitura). Pode subestimar elegíveis.
// ⚠️ Regras de transição (pontos, pedágio) não modeladas (requerem CNIS total).
// ⚠️ Regimes especiais (risco, etc.) fora do escopo — marcados como RGPS.

export function computeFaixa(r, N = 0) {
  const idadeProj = (Number(r.Idade) || 0) + N;
  const tempoProj = (Number(r.Tempo_Contrato_Anos) || 0) + N;
  const sexo      = (r.Sexo || '').toLowerCase().startsWith('m') ? 'H' : 'M';
  const prof      = isProfessor(r);
  const regime    = classifyRegime(r);

  // Compulsória — certa, sem requisito de contribuição
  if (idadeProj >= COMPULSORIA.idade) return 'elegivel_por_idade';

  let idadeMin, contribMin;
  if (regime === 'RPPS') {
    idadeMin   = RPPS.idadeMin[sexo]  - (prof ? PROFESSOR.reducaoIdadeAnos  : 0);
    contribMin = RPPS.contribMinAnos  - (prof ? PROFESSOR.reducaoContribAnos : 0);
  } else {
    idadeMin   = RGPS.idadeMin[sexo]       - (prof ? PROFESSOR.reducaoIdadeAnos  : 0);
    contribMin = RGPS.contribMinAnos[sexo] - (prof ? PROFESSOR.reducaoContribAnos : 0);
  }

  if (idadeProj < idadeMin) return 'nao_elegivel';
  if (tempoProj >= contribMin) return 'provavelmente_elegivel';
  return 'possivelmente_elegivel';
}

// Menor N (anos) para o servidor entrar em qualquer faixa elegível.
// Retorna Infinity se não elegível dentro de maxAnos.
export function anosAteElegivel(r, maxAnos = PROJECAO.maxCurvaAnos) {
  for (let n = 0; n <= maxAnos; n++) {
    if (computeFaixa(r, n) !== 'nao_elegivel') return n;
  }
  return Infinity;
}

// Backward-compat: mantém a API antiga usada em telas existentes.
export function anosParaAposentadoria(r) {
  return anosAteElegivel(r);
}

// Projeção cumulativa por ano (quantos são elegíveis em cada horizonte).
// Retorna array de { ano, elegivel_por_idade, provavelmente_elegivel,
//                    possivelmente_elegivel, nao_elegivel, total_elegiveis }
export function computeProjections(dados, maxAnos = PROJECAO.maxCurvaAnos) {
  return Array.from({ length: maxAnos + 1 }, (_, N) => {
    const c = { elegivel_por_idade: 0, provavelmente_elegivel: 0, possivelmente_elegivel: 0, nao_elegivel: 0 };
    dados.forEach(r => c[computeFaixa(r, N)]++);
    return { ano: N, ...c, total_elegiveis: c.elegivel_por_idade + c.provavelmente_elegivel + c.possivelmente_elegivel };
  });
}

// "Penhasco demográfico": quantos servidores PASSAM a ser elegíveis em cada ano.
export function computePenhasco(dados, maxAnos = PROJECAO.maxCurvaAnos) {
  return Array.from({ length: maxAnos }, (_, i) => {
    const N = i + 1;
    const novos = dados.filter(r =>
      computeFaixa(r, N - 1) === 'nao_elegivel' && computeFaixa(r, N) !== 'nao_elegivel'
    ).length;
    return { ano: N, novos };
  });
}
