import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveAddressVisualStatus } from "../deriveAddressVisualStatus";

const baseParams = {
  freeText: "Rua Elias Jardim Júlio 309",
  vals: { rua: "Elias", bairro: "Jardim Júlio", numero: "309" },
  selectedCoords: null,
  hasSelectedSuggestion: false,
  searching: false,
  resolvingPlace: false,
  suggestionCount: 0,
  searchEmpty: false,
  hasDidYouMean: false,
};

test("não exibe not_located quando há sugestões pendentes", () => {
  const status = deriveAddressVisualStatus({
    ...baseParams,
    suggestionCount: 1,
  });
  assert.equal(status.kind, "select_suggestion");
});

test("exibe not_located somente quando busca confirmou vazio", () => {
  const status = deriveAddressVisualStatus({
    ...baseParams,
    searchEmpty: true,
  });
  assert.equal(status.kind, "not_located");
});

test("exibe located quando sugestão selecionada", () => {
  const status = deriveAddressVisualStatus({
    ...baseParams,
    hasSelectedSuggestion: true,
    vals: { ...baseParams.vals, cidade: "Barueri", estado: "SP" },
  });
  assert.equal(status.kind, "located");
});

test("não exibe hint enquanto busca", () => {
  const status = deriveAddressVisualStatus({
    ...baseParams,
    searching: true,
    searchEmpty: true,
  });
  assert.equal(status.kind, "none");
});

test("didYouMean impede not_located", () => {
  const status = deriveAddressVisualStatus({
    ...baseParams,
    hasDidYouMean: true,
    searchEmpty: true,
  });
  assert.equal(status.kind, "select_suggestion");
});
