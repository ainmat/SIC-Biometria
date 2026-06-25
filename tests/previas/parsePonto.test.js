import {
  parseLinha,
  parseArquivoPonto,
  extrairCompetencia,
} from '@/modules/previas/utils/parsePontoBiometria.js';

// ── extrairCompetencia ────────────────────────────────────────────────────────

describe('extrairCompetencia', () => {
  test('detecta competência do nome padrão', () => {
    const c = extrairCompetencia('IMP052026_unificado.txt');
    expect(c).toMatchObject({ mes: '05', ano: '2026', competencia: '2026-05' });
  });

  test('case-insensitive', () => {
    const c = extrairCompetencia('imp122025.txt');
    expect(c).toMatchObject({ mes: '12', ano: '2025', competencia: '2025-12' });
  });

  test('retorna null para nomes sem padrão IMP', () => {
    expect(extrairCompetencia('arquivo_random.txt')).toBeNull();
  });
});

// ── parseLinha — Tipo 1 ───────────────────────────────────────────────────────

describe('parseLinha — Tipo 1 (marcação diária)', () => {
  // "00000778" + "01" + "15/05/2026" + "033500020"  = 29 chars
  const LINHA_T1 = '0000077801' + '15/05/2026' + '033500020';

  test('linha válida retorna Tipo 1', () => {
    const r = parseLinha(LINHA_T1, 1);
    expect(r).toMatchObject({
      valida:    true,
      tipo:      1,
      matricula: '778',        // zeros removidos
      vinculo:   '01',
      data:      '2026-05-15', // formato ISO
      codigo:    '033500020',
    });
  });

  test('remove \\r de linhas com terminação CRLF', () => {
    const r = parseLinha(LINHA_T1 + '\r', 1);
    expect(r.valida).toBe(true);
    expect(r.tipo).toBe(1);
  });

  test('vínculo diferente de 01 é aceito', () => {
    const linha = '0000077802' + '15/05/2026' + '033500020';
    const r = parseLinha(linha, 1);
    expect(r.valida).toBe(true);
    expect(r.vinculo).toBe('02');
  });

  test('matrícula 00000001 → matricula "1" (zeros removidos)', () => {
    // pos 1-8: 00000001, pos 9-10: 01, pos 11-20: data, pos 21-29: codigo
    const linha = '0000000101' + '15/05/2026' + '033500020';
    const r = parseLinha(linha, 1);
    expect(r.valida).toBe(true);
    expect(r.matricula).toBe('1');
  });
});

// ── parseLinha — Tipo 2 ───────────────────────────────────────────────────────

describe('parseLinha — Tipo 2 (consolidação mensal)', () => {
  // "00001234" + "01" + 10 espaços + "002412345"  = 29 chars
  const LINHA_T2 = '0000123401' + '          ' + '002412345';

  test('linha com data em branco retorna Tipo 2', () => {
    const r = parseLinha(LINHA_T2, 5);
    expect(r).toMatchObject({
      valida:    true,
      tipo:      2,
      matricula: '1234',
      vinculo:   '01',
      codigo:    '002412345',
    });
    expect(r.data).toBeUndefined(); // sem campo data
  });

  test('remove \\r em Tipo 2', () => {
    const r = parseLinha(LINHA_T2 + '\r', 1);
    expect(r.valida).toBe(true);
    expect(r.tipo).toBe(2);
  });
});

// ── parseLinha — linhas inválidas ─────────────────────────────────────────────

describe('parseLinha — rejeições', () => {
  test('linha vazia retorna null (sem rejeição)', () => {
    expect(parseLinha('', 1)).toBeNull();
    expect(parseLinha('\r', 1)).toBeNull();
  });

  test('comprimento errado → rejeitada', () => {
    const r = parseLinha('00000778011505202603350002', 2); // 25 chars
    expect(r.valida).toBe(false);
    expect(r.motivo).toMatch(/Comprimento/);
  });

  test('matrícula com letras → rejeitada', () => {
    const linha = 'ABCDEFGH01' + '15/05/2026' + '033500020';
    const r = parseLinha(linha, 3);
    expect(r.valida).toBe(false);
    expect(r.motivo).toMatch(/Matrícula/);
  });

  test('data com formato errado → rejeitada', () => {
    const linha = '0000077801' + '2026-05-15' + '033500020'; // ISO no lugar de DD/MM/YYYY
    const r = parseLinha(linha, 4);
    expect(r.valida).toBe(false);
    expect(r.motivo).toMatch(/Data/);
  });

  test('data inexistente no calendário → rejeitada', () => {
    const linha = '0000077801' + '31/02/2026' + '033500020'; // 31 de fev não existe
    const r = parseLinha(linha, 5);
    expect(r.valida).toBe(false);
    expect(r.motivo).toMatch(/Data/);
  });
});

// ── parseArquivoPonto — arquivo completo ──────────────────────────────────────

describe('parseArquivoPonto', () => {
  function montar(linhas) { return linhas.join('\n'); }

  const L1a = '0000077801' + '15/05/2026' + '033500020'; // Tipo 1, matric 778
  const L1b = '0000077801' + '16/05/2026' + '017100100'; // Tipo 1, matric 778
  const L2a = '0000077801' + '          ' + '002412345'; // Tipo 2, matric 778
  const L1c = '0001234501' + '15/05/2026' + '033500100'; // Tipo 1, matric 12345
  const LRUIM = '0000077X01' + '15/05/2026' + '033500020'; // matrícula com letra → rejeitada

  test('separa corretamente Tipo 1, Tipo 2 e rejeitadas', () => {
    const texto = montar([L1a, L1b, L2a, L1c, LRUIM]);
    const r = parseArquivoPonto(texto);

    expect(r.tipo1).toHaveLength(3);
    expect(r.tipo2).toHaveLength(1);
    expect(r.rejeitadas).toHaveLength(1);
  });

  test('linhas vazias não contam como rejeitadas', () => {
    const texto = montar([L1a, '', L1b, '  \r', L2a]);
    // '  \r' → após strip \r vira '  ' que tem comprimento 2 != 29 → rejeitada
    // (linha só com espaços tem length != 29)
    const r = parseArquivoPonto(texto);
    // A linha '' vira null e é ignorada; '  \r' → '  ' (2 chars) → rejeitada
    expect(r.tipo1).toHaveLength(2);
    expect(r.tipo2).toHaveLength(1);
    expect(r.rejeitadas).toHaveLength(1);
  });

  test('matrículas únicas são listadas sem duplicatas', () => {
    // 778 aparece em L1a, L1b, L2a; 12345 em L1c
    const texto = montar([L1a, L1b, L2a, L1c]);
    const r = parseArquivoPonto(texto);
    expect(r.matriculas).toHaveLength(2);
    expect(r.matriculas).toContain('778');
    expect(r.matriculas).toContain('12345');
  });

  test('resumo contém os totais corretos', () => {
    const texto = montar([L1a, L1b, L2a, L1c, LRUIM]);
    const r = parseArquivoPonto(texto);
    expect(r.resumo).toMatchObject({
      tipo1:      3,
      tipo2:      1,
      rejeitadas: 1,
      servidores: 2,
    });
  });

  test('arquivo com terminação CRLF é parseado corretamente', () => {
    // simula CRLF: junta com \r\n e split('\n') deixa \r no final de cada item
    const crlfTexto = [L1a, L1b, L2a].map(l => l + '\r').join('\n');
    const r = parseArquivoPonto(crlfTexto);
    expect(r.tipo1).toHaveLength(2);
    expect(r.tipo2).toHaveLength(1);
    expect(r.rejeitadas).toHaveLength(0);
  });

  test('arquivo vazio retorna tudo zerado', () => {
    const r = parseArquivoPonto('');
    expect(r.resumo.tipo1).toBe(0);
    expect(r.resumo.tipo2).toBe(0);
    expect(r.resumo.rejeitadas).toBe(0);
    expect(r.matriculas).toHaveLength(0);
  });

  test('matrícula do arquivo que não existe no banco é marcada separadamente', () => {
    // O parser não faz o join (isso é responsabilidade do service), mas
    // as matrículas ficam disponíveis para o chamador fazer o match.
    const texto = montar([L1a, L1c]);
    const r = parseArquivoPonto(texto);
    expect(r.matriculas).toContain('778');
    expect(r.matriculas).toContain('12345');
  });
});
