/**
 * Testes para a lógica de comparação de TXT de prévias.
 *
 * A função compararArquivos é inlined aqui (sem import do módulo ES)
 * para compatibilidade com o setup Jest atual (sem babel).
 * A lógica é idêntica à em src/modules/previas/utils/analise.js.
 */

// ─── função inline (espelho da exportada em analise.js) ───────────────────
const CODIGO_FALTA  = '171';
const CODIGO_ATRASO = '335';

function compararArquivos(validosA, validosB) {
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

  const apenasA = [...matsA].filter(m => !matsB.has(m)).sort().map(m => ({
    matricula: m,
    faltasA: mapaA[m].faltas, atrasosA: mapaA[m].atrasos,
    faltasB: 0, atrasosB: 0,
    diffFaltas: -mapaA[m].faltas, diffAtrasos: -mapaA[m].atrasos,
    status: 'apenas_a',
  }));

  const apenasB = [...matsB].filter(m => !matsA.has(m)).sort().map(m => ({
    matricula: m,
    faltasA: 0, atrasosA: 0,
    faltasB: mapaB[m].faltas, atrasosB: mapaB[m].atrasos,
    diffFaltas: mapaB[m].faltas, diffAtrasos: mapaB[m].atrasos,
    status: 'apenas_b',
  }));

  const comuns = [...matsA].filter(m => matsB.has(m)).map(m => {
    const a = mapaA[m], b = mapaB[m];
    const diffFaltas = b.faltas - a.faltas, diffAtrasos = b.atrasos - a.atrasos;
    return { matricula: m, faltasA: a.faltas, atrasosA: a.atrasos, faltasB: b.faltas, atrasosB: b.atrasos, diffFaltas, diffAtrasos, status: diffFaltas === 0 && diffAtrasos === 0 ? 'igual' : 'alterado' };
  });

  const alterados = comuns.filter(r => r.status === 'alterado')
    .sort((a, b) => (Math.abs(b.diffFaltas) + Math.abs(b.diffAtrasos)) - (Math.abs(a.diffFaltas) + Math.abs(a.diffAtrasos)));
  const iguais = comuns.filter(r => r.status === 'igual')
    .sort((a, b) => a.matricula.localeCompare(b.matricula));

  return { apenasA, apenasB, alterados, iguais, totalA: matsA.size, totalB: matsB.size };
}

// ─── helpers ──────────────────────────────────────────────────────────────
const falta  = (m) => ({ matricula: m, data_ocorrencia: '2026-01-15', codigo_ocorrencia: CODIGO_FALTA,  percentual_desconto: 100 });
const atraso = (m) => ({ matricula: m, data_ocorrencia: '2026-01-15', codigo_ocorrencia: CODIGO_ATRASO, percentual_desconto: 20  });

// ─── testes ───────────────────────────────────────────────────────────────
describe('compararArquivos', () => {

  test('dois arrays vazios → sem diferenças', () => {
    const r = compararArquivos([], []);
    expect(r.apenasA).toHaveLength(0);
    expect(r.apenasB).toHaveLength(0);
    expect(r.alterados).toHaveLength(0);
    expect(r.iguais).toHaveLength(0);
    expect(r.totalA).toBe(0);
    expect(r.totalB).toBe(0);
  });

  test('todos os servidores apenas em A', () => {
    const r = compararArquivos([falta('100001'), falta('100002')], []);
    expect(r.apenasA).toHaveLength(2);
    expect(r.apenasB).toHaveLength(0);
    expect(r.totalA).toBe(2);
    expect(r.totalB).toBe(0);
  });

  test('todos os servidores apenas em B', () => {
    const r = compararArquivos([], [falta('200001')]);
    expect(r.apenasB).toHaveLength(1);
    expect(r.apenasB[0].faltasB).toBe(1);
    expect(r.apenasB[0].status).toBe('apenas_b');
  });

  test('mesmo arquivo comparado consigo mesmo → apenas iguais', () => {
    const reg = [falta('111111'), atraso('111111')];
    const r = compararArquivos(reg, reg);
    expect(r.iguais).toHaveLength(1);
    expect(r.alterados).toHaveLength(0);
    expect(r.iguais[0].diffFaltas).toBe(0);
    expect(r.iguais[0].diffAtrasos).toBe(0);
    expect(r.iguais[0].status).toBe('igual');
  });

  test('faltas aumentadas em B → alterado com diffFaltas positivo', () => {
    const r = compararArquivos([falta('111111')], [falta('111111'), falta('111111'), falta('111111')]);
    expect(r.alterados).toHaveLength(1);
    expect(r.alterados[0].faltasA).toBe(1);
    expect(r.alterados[0].faltasB).toBe(3);
    expect(r.alterados[0].diffFaltas).toBe(2);
    expect(r.alterados[0].status).toBe('alterado');
  });

  test('atrasos removidos em B → apenas A com diff negativo', () => {
    const r = compararArquivos([atraso('222222'), atraso('222222')], []);
    expect(r.apenasA).toHaveLength(1);
    expect(r.apenasA[0].atrasosA).toBe(2);
    expect(r.apenasA[0].diffAtrasos).toBe(-2);
  });

  test('cenário completo: sumiu, surgiu, alterado, igual', () => {
    const a = [falta('111111'), atraso('222222'), atraso('222222'), falta('333333')];
    const b = [falta('111111'), atraso('222222'),                   falta('444444')];
    const r = compararArquivos(a, b);
    expect(r.iguais).toHaveLength(1);
    expect(r.alterados).toHaveLength(1);
    expect(r.apenasA).toHaveLength(1);
    expect(r.apenasB).toHaveLength(1);
    expect(r.apenasA[0].matricula).toBe('333333');
    expect(r.apenasB[0].matricula).toBe('444444');
    expect(r.alterados[0].matricula).toBe('222222');
    expect(r.alterados[0].diffAtrasos).toBe(-1);
    expect(r.totalA).toBe(3);
    expect(r.totalB).toBe(3);
  });

  test('duplicatas no mesmo arquivo são acumuladas (não duplicam servidores)', () => {
    const a = [falta('555555'), falta('555555'), falta('555555')];
    const b = [falta('555555')];
    const r = compararArquivos(a, b);
    expect(r.alterados).toHaveLength(1);
    expect(r.alterados[0].faltasA).toBe(3);
    expect(r.alterados[0].faltasB).toBe(1);
    expect(r.alterados[0].diffFaltas).toBe(-2);
    expect(r.totalA).toBe(1); // 1 matrícula única, não 3 registros
  });

  test('outros códigos de ocorrência (ex: 004) não entram na contagem', () => {
    const a = [falta('666666'), { matricula: '666666', codigo_ocorrencia: '004', percentual_desconto: 0 }];
    const r = compararArquivos(a, [falta('666666')]);
    expect(r.iguais).toHaveLength(1);
    expect(r.iguais[0].faltasA).toBe(1);
  });

  test('apenasA ordenado alfabeticamente por matrícula', () => {
    const r = compararArquivos([falta('ZZZ'), falta('AAA'), falta('MMM')], []);
    const mats = r.apenasA.map(x => x.matricula);
    expect(mats).toEqual([...mats].sort());
  });

  test('alterados ordenados por magnitude (maior diff primeiro)', () => {
    // BBB: Δ=-2 (magnitude 2) > AAA: Δ=+1 (magnitude 1)
    const a = [falta('AAA'), falta('BBB'), falta('BBB'), falta('BBB')];
    const b = [falta('AAA'), falta('AAA'), falta('BBB')];
    const r = compararArquivos(a, b);
    expect(r.alterados).toHaveLength(2);
    expect(r.alterados[0].matricula).toBe('BBB');
    expect(r.alterados[1].matricula).toBe('AAA');
  });

  test('campos de retorno corretos para apenasA e apenasB', () => {
    const r = compararArquivos([falta('X1'), atraso('X1')], [atraso('Y1'), atraso('Y1')]);
    expect(r.apenasA[0]).toMatchObject({ matricula: 'X1', faltasA: 1, atrasosA: 1, faltasB: 0, atrasosB: 0, status: 'apenas_a' });
    expect(r.apenasB[0]).toMatchObject({ matricula: 'Y1', faltasA: 0, atrasosA: 0, faltasB: 0, atrasosB: 2, status: 'apenas_b' });
  });
});
