/**
 * Retorna a competência do arquivo de prévia (= competência da folha − 1 mês).
 * A folha de Jun/2026 desconta a frequência de Mai/2026, cujo arquivo é IMP052026.
 *
 * @param {string} mes  — "06" (competência da folha, zero-padded)
 * @param {string} ano  — "2026"
 * @returns {{ mes: string, ano: string, prefixo: string }}
 *   mes e ano do arquivo esperado; prefixo = "IMP052026"
 */
export function competenciaArquivoPrevia(mes, ano) {
  let m = parseInt(mes, 10);
  let a = parseInt(ano, 10);
  m -= 1;
  if (m === 0) { m = 12; a -= 1; }
  const mesStr = String(m).padStart(2, '0');
  const anoStr = String(a);
  return { mes: mesStr, ano: anoStr, prefixo: `IMP${mesStr}${anoStr}` };
}
