const equipamentos = [
  { nome: "1352 FACE OBRAS GABINETE" },
  { nome: "1206 FACE DMIG OBRAS" }
];

const unitKeys = [
  "71-0-0-0-0 - SECRETARIA DE SERVIÇOS E OBRAS - SSO"
];

const CUSTOM_ALIASES = {
  'secretaria de servicos e obras sso': 'obras gabinete'
};

const normalize = (s) => s ? s.toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/face/g, '')
  .replace(/[^a-z0-9]/g, ' ')
  .replace(/\bsed\b/g, 'sede')
  .replace(/\s+/g, ' ')
  .trim() : '';

const cleanUnitName = (s) => {
  if (!s) return '';
  let cleaned = s.replace(/^[\d\s\-]+/, '');
  const n = normalize(cleaned);
  return CUSTOM_ALIASES[n] || n;
};

const getSimilarity = (str1, str2) => {
  const w1 = str1.split(' ').filter(x => x.length > 2);
  const w2 = str2.split(' ').filter(x => x.length > 2);
  let matches = 0;
  for (const w of w1) {
    if (w2.includes(w)) matches++;
  }
  if (w1.length === 0 || w2.length === 0) return 0;
  return matches / Math.min(w1.length, w2.length);
};

for (const rawUnit of unitKeys) {
  const unitKey = cleanUnitName(rawUnit);
  let bestEq = null;
  let bestScore = 0;
  for (const e of equipamentos) {
    const n = normalize(e.nome);
    if (n.includes(unitKey) || unitKey.includes(n)) {
      bestEq = e;
      bestScore = 2;
      break;
    }
    const score = getSimilarity(n, unitKey);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestEq = e;
    }
  }
  console.log(`Unit: ${rawUnit} -> Matched: ${bestEq ? bestEq.nome : 'None'} (Score: ${bestScore})`);
}
