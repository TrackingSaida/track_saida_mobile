/** Pós-processamento de texto OCR antes da busca de endereço. */

const OCR_CONFUSIONS: Array<[RegExp, string]> = [
  [/\b0(?=[a-záàâãéêíóôõúç])/gi, "O"],
  [/(?<=[a-záàâãéêíóôõúç])0\b/gi, "O"],
  [/\b1(?=[a-záàâãéêíóôõúç])/gi, "I"],
  [/(?<=[a-záàâãéêíóôõúç])1\b/gi, "I"],
  [/\b5(?=[a-záàâãéêíóôõúç])/gi, "S"],
  [/(?<=[a-záàâãéêíóôõúç])5\b/gi, "S"],
  [/\b8(?=[a-záàâãéêíóôõúç])/gi, "B"],
  [/(?<=[a-záàâãéêíóôõúç])8\b/gi, "B"],
];

export function normalizeOcrText(text: string): string {
  let out = (text || "").trim();
  if (!out) return "";
  for (const [pattern, replacement] of OCR_CONFUSIONS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s+/g, " ");
}
