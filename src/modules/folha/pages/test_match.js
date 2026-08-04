const equipamentos = [
  { nome: "DEPARTAMENTO DE SERVIÇOS E ZELADORIA" },
  { nome: "ZELADORIA URBANA NORTE" },
  { nome: "EMEF BENEDITO ALVES TURIBIO" }
];

const unitKeys = [
  "71-1-1-0-0 - DEPARTAMENTO DE SERVIÇOS E ZELADORIA URBANA - NORTE",
  "EMEF BENEDITO ALVES TURIBIO"
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
  return matches;
};

for (const rawUnit of unitKeys) {
  const unitKey = cleanUnitName(rawUnit);
  let bestEq = null;
  let bestScore = 0;
  for (const e of equipamentos) {
    const n = normalize(e.nome);
    if (n.includes(unitKey) || unitKey.includes(n)) {
      bestEq = e;
      break;
    }
    const score = getSimilarity(n, unitKey);
    if (score > bestScore && score >= 2) {
      bestScore = score;
      bestEq = e;
    }
  }
  console.log(`Unit: ${rawUnit} -> Matched: ${bestEq ? bestEq.nome : 'None'}`);
}
