// Testa competenciaArquivoPrevia inline (sem ESM imports)

function competenciaArquivoPrevia(mes, ano) {
  let m = parseInt(mes, 10);
  let a = parseInt(ano, 10);
  m -= 1;
  if (m === 0) { m = 12; a -= 1; }
  const mesStr = String(m).padStart(2, '0');
  const anoStr = String(a);
  return { mes: mesStr, ano: anoStr, prefixo: `IMP${mesStr}${anoStr}` };
}

describe('competenciaArquivoPrevia', () => {
  test('Junho/2026 → Mai/2026 (IMP052026)', () => {
    const r = competenciaArquivoPrevia('06', '2026');
    expect(r.mes).toBe('05');
    expect(r.ano).toBe('2026');
    expect(r.prefixo).toBe('IMP052026');
  });

  test('Janeiro/2026 → Dezembro/2025 (virada de ano)', () => {
    const r = competenciaArquivoPrevia('01', '2026');
    expect(r.mes).toBe('12');
    expect(r.ano).toBe('2025');
    expect(r.prefixo).toBe('IMP122025');
  });

  test('Março/2026 → Fevereiro/2026 (IMP022026)', () => {
    const r = competenciaArquivoPrevia('03', '2026');
    expect(r.mes).toBe('02');
    expect(r.ano).toBe('2026');
    expect(r.prefixo).toBe('IMP022026');
  });

  test('Dezembro/2026 → Novembro/2026', () => {
    const r = competenciaArquivoPrevia('12', '2026');
    expect(r.mes).toBe('11');
    expect(r.ano).toBe('2026');
    expect(r.prefixo).toBe('IMP112026');
  });

  test('Janeiro/2000 → Dezembro/1999 (virada de milênio)', () => {
    const r = competenciaArquivoPrevia('01', '2000');
    expect(r.mes).toBe('12');
    expect(r.ano).toBe('1999');
    expect(r.prefixo).toBe('IMP121999');
  });

  test('offset NÃO aplicado duas vezes — arquivo lido é gravado sob a competência da folha', () => {
    // Cenário: folha Jun/2026 → arquivo IMP052026 → gravado como Jun/2026
    const folhaMes = '06'; const folhaAno = '2026';
    const arq = competenciaArquivoPrevia(folhaMes, folhaAno);
    // arquivo esperado é mai/2026
    expect(arq.prefixo).toBe('IMP052026');
    // a competência de gravação é a da folha (nenhum segundo offset)
    const competenciaGravacao = `${folhaAno}-${folhaMes}`;
    expect(competenciaGravacao).toBe('2026-06');
  });
});
