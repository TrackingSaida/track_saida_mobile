/**
 * Converte números falados em português para algarismos.
 * Ex.: "seiscentos e vinte e um" → "621", "mil oitocentos e doze" → "1812"
 */

const UNITS: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
};

const TENS: Record<string, number> = {
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
};

const HUNDREDS: Record<string, number> = {
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quinhentos: 500,
  seiscentos: 600,
  setecentos: 700,
  oitocentos: 800,
  novecentos: 900,
};

function normalizeToken(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Parseia sequência de tokens numéricos por extenso (sem "mil" composto avançado). */
function parseSpokenChunk(tokens: string[]): number {
  let total = 0;
  let current = 0;
  for (const raw of tokens) {
    const t = normalizeToken(raw);
    if (!t || t === "e") continue;
    if (t === "mil") {
      current = (current || 1) * 1000;
      total += current;
      current = 0;
      continue;
    }
    if (UNITS[t] != null) {
      current += UNITS[t];
      continue;
    }
    if (TENS[t] != null) {
      current += TENS[t];
      continue;
    }
    if (HUNDREDS[t] != null) {
      current += HUNDREDS[t];
      continue;
    }
  }
  return total + current;
}

const SPOKEN_NUMBER_PATTERN =
  /\b((?:(?:zero|um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|duzentas|trezentos|trezentas|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos|mil)(?:\s+e\s+(?:zero|um|uma|dois|duas|tres|três|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|cem|cento|duzentos|duzentas|trezentos|trezentas|quatrocentos|quinhentos|seiscentos|setecentos|oitocentos|novecentos))?)+)\b/gi;

/**
 * Substitui trechos numéricos por extenso no texto por algarismos.
 */
export function replaceSpokenNumbers(text: string): string {
  return text.replace(SPOKEN_NUMBER_PATTERN, (match) => {
    const tokens = match.split(/\s+e\s+|\s+/).filter(Boolean);
    const value = parseSpokenChunk(tokens);
    return value > 0 ? String(value) : match;
  });
}
