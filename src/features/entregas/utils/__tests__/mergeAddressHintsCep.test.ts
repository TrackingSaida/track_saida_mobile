import assert from "node:assert/strict";
import { test } from "node:test";
import { extractCepDigitsFromText } from "../viaCep";

test("extractCepDigitsFromText aceita CEP com espaço do OCR", () => {
  assert.equal(extractCepDigitsFromText("Osasco SP 06330 100"), "06330100");
  assert.equal(extractCepDigitsFromText("CEP: 01310-100"), "01310100");
  assert.equal(extractCepDigitsFromText("sem cep aqui"), "");
});

/**
 * Espelha a regra de merge de CEP (sugestão || hints) usada em mergeAddressHints.
 * Mantido puro para não puxar expo-location via addressSuggestions.ts.
 */
function mergeCepPreferSuggestion(suggestionCep: string, hintCep: string): string {
  const valueCep = suggestionCep.replace(/\D/g, "").slice(0, 8);
  const fromHint = hintCep.replace(/\D/g, "").slice(0, 8);
  return valueCep.length === 8 ? valueCep : fromHint;
}

test("CEP da sugestão prevalece; senão usa OCR/hints", () => {
  assert.equal(mergeCepPreferSuggestion("", "06333080"), "06333080");
  assert.equal(mergeCepPreferSuggestion("01310100", "06333080"), "01310100");
  assert.equal(mergeCepPreferSuggestion("123", "06333080"), "06333080");
});
