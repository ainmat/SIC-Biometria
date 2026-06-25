import {
  computeFaixa,
  computeProjections,
  computePenhasco,
  anosAteElegivel,
  anosParaAposentadoria,
  isProfessor,
  classifyRegime,
  RGPS, RPPS, COMPULSORIA, PROFESSOR, PROJECAO,
} from '@/modules/servidores/config/servidoresConfig.js';

// Helpers para montar registros mínimos
const H = (idade, anos, cargo = 'Analista', regTrab = '') =>
  ({ Idade: idade, Tempo_Contrato_Anos: anos, Sexo: 'Masculino', Des_Cargo: cargo, Des_RegTrab: regTrab });
const M = (idade, anos, cargo = 'Analista', regTrab = '') =>
  ({ Idade: idade, Tempo_Contrato_Anos: anos, Sexo: 'Feminino', Des_Cargo: cargo, Des_RegTrab: regTrab });

// ── 1. Limites RGPS básicos ─────────────────────────────────────────────────

describe('RGPS — homem', () => {
  test('elegível provável: idade e tempo ok', () => {
    expect(computeFaixa(H(RGPS.idadeMin.H, RGPS.contribMinAnos.H))).toBe('provavelmente_elegivel');
  });

  test('elegível provável: acima do limiar', () => {
    expect(computeFaixa(H(70, 25))).toBe('provavelmente_elegivel');
  });

  test('não elegível: abaixo da idade', () => {
    expect(computeFaixa(H(RGPS.idadeMin.H - 1, RGPS.contribMinAnos.H))).toBe('nao_elegivel');
  });

  test('possível: idade ok, tempo de casa insuficiente', () => {
    expect(computeFaixa(H(RGPS.idadeMin.H, RGPS.contribMinAnos.H - 1))).toBe('possivelmente_elegivel');
  });
});

describe('RGPS — mulher', () => {
  test('elegível provável: idade e tempo ok', () => {
    expect(computeFaixa(M(RGPS.idadeMin.M, RGPS.contribMinAnos.M))).toBe('provavelmente_elegivel');
  });

  test('não elegível: abaixo da idade (mas acima do limiar masculino sem efeito)', () => {
    expect(computeFaixa(M(RGPS.idadeMin.M - 1, RGPS.contribMinAnos.M))).toBe('nao_elegivel');
  });

  test('possível: idade ok, tempo de casa insuficiente', () => {
    expect(computeFaixa(M(RGPS.idadeMin.M, RGPS.contribMinAnos.M - 1))).toBe('possivelmente_elegivel');
  });
});

// ── 2. Compulsória ──────────────────────────────────────────────────────────

describe('compulsória', () => {
  test('exatamente 75 → elegivel_por_idade', () => {
    expect(computeFaixa(H(COMPULSORIA.idade, 0))).toBe('elegivel_por_idade');
    expect(computeFaixa(M(COMPULSORIA.idade, 0))).toBe('elegivel_por_idade');
  });

  test('acima de 75 → elegivel_por_idade', () => {
    expect(computeFaixa(H(80, 0))).toBe('elegivel_por_idade');
  });

  test('74 anos sem tempo suficiente → não compulsória mas possível se idade RGPS ok', () => {
    // 74 anos, sem tempo: idade RGPS ok (H:65), mas tempo insuficiente → possivelmente
    expect(computeFaixa(H(74, 0))).toBe('possivelmente_elegivel');
  });
});

// ── 3. Professor ─────────────────────────────────────────────────────────────

describe('isProfessor', () => {
  test('cargo com "professor" é detectado', () => {
    expect(isProfessor({ Des_Cargo: 'Professor de Matemática' })).toBe(true);
  });

  test('cargo com "pedagogo" é detectado', () => {
    expect(isProfessor({ Des_Cargo: 'Pedagogo II' })).toBe(true);
  });

  test('cargo sem padrão não é professor', () => {
    expect(isProfessor({ Des_Cargo: 'Analista de TI' })).toBe(false);
  });

  test('professor masculino — limiar reduzido em reducaoIdadeAnos', () => {
    const idadeReduzida = RGPS.idadeMin.H - PROFESSOR.reducaoIdadeAnos;
    const contribReduzida = RGPS.contribMinAnos.H - PROFESSOR.reducaoContribAnos;
    expect(computeFaixa(H(idadeReduzida, contribReduzida, 'Professor'))).toBe('provavelmente_elegivel');
    // Um ano abaixo deve ser não elegível
    expect(computeFaixa(H(idadeReduzida - 1, contribReduzida, 'Professor'))).toBe('nao_elegivel');
  });

  test('professora feminina — limiar reduzido', () => {
    const idadeRed = RGPS.idadeMin.M - PROFESSOR.reducaoIdadeAnos;
    const contribRed = RGPS.contribMinAnos.M - PROFESSOR.reducaoContribAnos;
    expect(computeFaixa(M(idadeRed, contribRed, 'Professora'))).toBe('provavelmente_elegivel');
  });
});

// ── 4. classifyRegime ────────────────────────────────────────────────────────

describe('classifyRegime', () => {
  test('padrão é RGPS (RPPS_PATTERNS vazio)', () => {
    expect(classifyRegime(H(50, 10))).toBe('RGPS');
    expect(classifyRegime(M(50, 10, 'Analista', 'RPPS municipal'))).toBe('RGPS');
  });
});

// ── 5. Projeção por horizonte (computeFaixa com N > 0) ──────────────────────

describe('computeFaixa com horizonte N', () => {
  test('servidor 2 anos antes da idade mínima → nao_elegivel agora, provável em N=2', () => {
    const r = H(RGPS.idadeMin.H - 2, RGPS.contribMinAnos.H + 5);
    expect(computeFaixa(r, 0)).toBe('nao_elegivel');
    expect(computeFaixa(r, 1)).toBe('nao_elegivel');
    expect(computeFaixa(r, 2)).toBe('provavelmente_elegivel');
  });

  test('servidor 3 anos antes da idade e 1 ano de tempo faltando → possível em N=3', () => {
    // Tempo atual: contribMin - 4; em N=3 terá contribMin - 1 → ainda faltando → possível
    const r = H(RGPS.idadeMin.H - 3, RGPS.contribMinAnos.H - 4);
    expect(computeFaixa(r, 3)).toBe('possivelmente_elegivel');
    // Em N=7 terá contribMin + 3 → provável
    expect(computeFaixa(r, 7)).toBe('provavelmente_elegivel');
  });
});

// ── 6. anosAteElegivel ───────────────────────────────────────────────────────

describe('anosAteElegivel', () => {
  test('já elegível → 0', () => {
    expect(anosAteElegivel(H(RGPS.idadeMin.H, RGPS.contribMinAnos.H))).toBe(0);
  });

  test('2 anos faltando → 2', () => {
    expect(anosAteElegivel(H(RGPS.idadeMin.H - 2, RGPS.contribMinAnos.H + 5))).toBe(2);
  });

  test('servidor muito jovem → Infinity (fora do horizonte)', () => {
    expect(anosAteElegivel(H(30, 5), PROJECAO.maxCurvaAnos)).toBe(Infinity);
  });

  test('compulsória: servidor com 74 anos → elegível em 1 ano', () => {
    expect(anosAteElegivel(H(74, 0))).toBe(0); // já possivelmente elegível (idade RGPS ok)
  });

  test('exatamente no compulsório em N=1', () => {
    const r = H(COMPULSORIA.idade - 1, 0);
    // Sem contribuição: possivelmente (idade ok, sem tempo). Elegível agora.
    expect(anosAteElegivel(r)).toBe(0);
  });
});

// ── 7. backward-compat ──────────────────────────────────────────────────────

describe('anosParaAposentadoria (alias backward-compat)', () => {
  test('retorna o mesmo valor que anosAteElegivel', () => {
    const r = H(63, 18);
    expect(anosParaAposentadoria(r)).toBe(anosAteElegivel(r));
  });

  test('já elegível → 0', () => {
    expect(anosParaAposentadoria(H(70, 25))).toBe(0);
  });
});

// ── 8. computeProjections ────────────────────────────────────────────────────

describe('computeProjections', () => {
  const dados = [
    H(RGPS.idadeMin.H, RGPS.contribMinAnos.H),     // já elegível provável
    H(RGPS.idadeMin.H - 2, RGPS.contribMinAnos.H), // elegível em 2a
    M(RGPS.idadeMin.M, RGPS.contribMinAnos.M),     // já elegível provável
    H(30, 5),                                       // jovem, fora do horizonte
  ];

  const proj = computeProjections(dados, 5);

  test('retorna maxAnos+1 entradas', () => {
    expect(proj).toHaveLength(6); // 0..5
  });

  test('cada entrada tem campo ano, faixas e total_elegiveis', () => {
    const p = proj[0];
    expect(p).toHaveProperty('ano', 0);
    expect(p).toHaveProperty('provavelmente_elegivel');
    expect(p).toHaveProperty('possivelmente_elegivel');
    expect(p).toHaveProperty('elegivel_por_idade');
    expect(p).toHaveProperty('nao_elegivel');
    expect(p).toHaveProperty('total_elegiveis');
  });

  test('total_elegiveis cresce ou mantém ao longo do tempo', () => {
    for (let i = 1; i < proj.length; i++) {
      expect(proj[i].total_elegiveis).toBeGreaterThanOrEqual(proj[i - 1].total_elegiveis);
    }
  });

  test('ano 0: 2 elegíveis prováveis, 1 não elegível jovem', () => {
    expect(proj[0].provavelmente_elegivel).toBe(2);
    expect(proj[0].nao_elegivel).toBe(2); // jovem + o que falta 2a
  });

  test('ano 2: o servidor que faltavam 2a passa a ser elegível', () => {
    expect(proj[2].provavelmente_elegivel).toBe(3);
  });
});

// ── 9. computePenhasco ───────────────────────────────────────────────────────

describe('computePenhasco', () => {
  const dados = [
    H(RGPS.idadeMin.H - 2, RGPS.contribMinAnos.H + 5), // entra em ano 2
    H(RGPS.idadeMin.H - 3, RGPS.contribMinAnos.H + 5), // entra em ano 3
    M(RGPS.idadeMin.M,     RGPS.contribMinAnos.M),      // já elegível (não aparece no penhasco)
  ];

  const penhasco = computePenhasco(dados, 5);

  test('retorna maxAnos entradas (anos 1 a maxAnos)', () => {
    expect(penhasco).toHaveLength(5);
    expect(penhasco[0].ano).toBe(1);
    expect(penhasco[4].ano).toBe(5);
  });

  test('novos elegíveis no ano 2 = 1', () => {
    const ano2 = penhasco.find(p => p.ano === 2);
    expect(ano2.novos).toBe(1);
  });

  test('novos elegíveis no ano 3 = 1', () => {
    const ano3 = penhasco.find(p => p.ano === 3);
    expect(ano3.novos).toBe(1);
  });

  test('já elegível não aparece no penhasco (novos = 0 no ano 1)', () => {
    expect(penhasco[0].novos).toBe(0);
  });
});
