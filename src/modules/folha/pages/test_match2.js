const equipamentos = [
  { nome: "DEPARTAMENTO DE SERVIÇOS E ZELADORIA" },
  { nome: "ZELADORIA URBANA NORTE" },
  { nome: "EMEF BENEDITO ALVES TURIBIO" },
  { nome: "SAMU 1" },
  { nome: "SAMU 2" },
  { nome: "CRECHE MARIA CONSTANCIO" }
];

const unitKeys = [
  "71-1-1-0-0 - DEPARTAMENTO DE SERVIÇOS E ZELADORIA URBANA - NORTE",
  "EMEF BENEDITO ALVES TURIBIO",
  "58-5-0-6-0 - GERÊNCIA DO SAMU",
  "EMEF MARIA CONSTANCIO"
];

const normalize = (s) => s ? s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/face/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim() : '';

const cleanUnitName = (s) => {
  if (!s) return '';
  let cleaned = s.replace(/^[\d\s\-]+/, '');
  return normalize(cleaned);
};

const getSimilarity = (str1, str2) => {
  const w1 = str1.split(' ').filter(x => x.length > 2);
  const w2 = str2.split(' ').filter(x => x.length > 2);
  let matches = 0;
  for (const w of w1) {
    if (w2.includes(w)) matches++;
  }
  if (w1.length === 0 || w2.length === 0) return 0;
  // ratio based on the smaller array so that "SAMU" matches "GERENCIA DO SAMU" well
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
      bestScore = 2; // Exact match override
      break;
    }
    const score = getSimilarity(n, unitKey);
    // require at least > 0.5 ratio, or exactly 1
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestEq = e;
    }
  }
  console.log(`Unit: ${rawUnit} -> Matched: ${bestEq ? bestEq.nome : 'None'} (Score: ${bestScore})`);
}
