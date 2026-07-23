import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFreeTextAddress, parseVoiceAddress, pickBestOcrAddress } from "../ocrAddress";
import { stripCepNoiseFromText } from "../viaCep";

/** Espelha a regra de addressSuggestions.needsAddressEnrichment (puro, sem RN). */
function needsEnrichment(vals: {
  rua?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}): boolean {
  if (!(vals.rua ?? "").trim()) return false;
  if (!(vals.cidade ?? "").trim()) return true;
  if (!(vals.estado ?? "").trim()) return true;
  let score = 0;
  if ((vals.rua ?? "").trim()) score += 3;
  if ((vals.numero ?? "").trim()) score += 2;
  if ((vals.cidade ?? "").trim()) score += 2;
  if ((vals.estado ?? "").trim()) score += 1;
  if ((vals.cep ?? "").replace(/\D/g, "").length === 8) score += 2;
  if ((vals.bairro ?? "").trim()) score += 1;
  return score < 8;
}

test("OCR com rua+número+bairro+CEP ainda precisa enriquecer (faltava cidade)", () => {
  assert.equal(
    needsEnrichment({
      rua: "Rua Leont Lobas Ilarion",
      numero: "40",
      bairro: "Parque Jandaia",
      cep: "06333080",
      cidade: "",
      estado: "",
    }),
    true
  );
});

test("endereço completo não exige enriquecimento por score baixo", () => {
  assert.equal(
    needsEnrichment({
      rua: "Rua Leont Lobas Ilarion",
      numero: "40",
      bairro: "Parque Jandaia",
      cidade: "Carapicuíba",
      estado: "SP",
      cep: "06333080",
    }),
    false
  );
});

test("stripCepNoiseFromText limpa rótulo CEP", () => {
  assert.equal(stripCepNoiseFromText("Parque Jandaia CEP: 06333-080"), "Parque Jandaia");
});

test("voz rua+número+bairro (hábito do motoboy) com cidade padrão", () => {
  const parsed = parseVoiceAddress("Rua das Flores 40 Parque Jandaia", {
    cidade: "Carapicuíba",
    estado: "SP",
  });
  assert.equal(parsed.cidade, "Carapicuíba");
  assert.equal(parsed.estado, "SP");
  assert.ok((parsed.rua ?? "").toLowerCase().includes("flores"));
  assert.equal(parsed.numero, "40");
  assert.match((parsed.bairro ?? "").toLowerCase(), /jandaia|parque/);
});

test("voz rua+número+bairro reconhece prefixo Parque sem cidade padrão", () => {
  const parsed = parseVoiceAddress("Rua Leont Lobas Ilarion 40 Parque Jandaia");
  assert.equal(parsed.numero, "40");
  assert.match((parsed.bairro ?? "").toLowerCase(), /parque jandaia/);
  assert.notEqual((parsed.cidade ?? "").toLowerCase(), "parque jandaia");
});

test("voz com palavra bairro explícita", () => {
  const parsed = parseVoiceAddress("Rua das Flores 40 bairro Parque Jandaia", {
    cidade: "Carapicuíba",
    estado: "SP",
  });
  assert.equal(parsed.numero, "40");
  assert.match((parsed.bairro ?? "").toLowerCase(), /parque jandaia/);
  assert.equal(parsed.cidade, "Carapicuíba");
});

test("query de busca usa ordem rua+bairro+número (mais precisa)", () => {
  // Espelha buildSearchQuery — bairro junto do logradouro, número depois.
  const rua = "Rua das Flores";
  const bairro = "Parque Jandaia";
  const numero = "40";
  const cidade = "Carapicuíba";
  const estado = "SP";
  const streetWithNeighborhood = [rua, bairro].filter(Boolean).join(", ");
  const q = [streetWithNeighborhood, numero, cidade, estado, "Brasil"]
    .filter(Boolean)
    .join(", ");
  assert.equal(
    q,
    "Rua das Flores, Parque Jandaia, 40, Carapicuíba, SP, Brasil"
  );
  // Garante que número NÃO vem antes do bairro (ordem antiga, menos precisa).
  assert.ok(q.indexOf("Parque Jandaia") < q.indexOf(", 40,"));
});

test("OCR com CEP espaçado preserva número da casa (não usa 06330 como número)", () => {
  const parsed = parseFreeTextAddress(
    "Rua Maria L uiza de Campos., 43, Parque Jandaia 06330 100, Carapicuíba, SP",
    { cidade: "Carapicuíba", estado: "SP" }
  );
  assert.equal(parsed.numero, "43");
  assert.equal((parsed.cep ?? "").replace(/\D/g, ""), "06330100");
  assert.match((parsed.bairro ?? "").toLowerCase(), /parque jandaia/);
  assert.ok((parsed.rua ?? "").toLowerCase().includes("maria"));
});

test("pickBestOcrAddress aplica cidade padrão e limpa CEP no bairro", () => {
  const parsed = pickBestOcrAddress(
    [
      "Rua Leont Lobas Ilarion, 40",
      "Parque Jandaia CEP: 06333-080",
      "06333080",
    ],
    { cidade: "Carapicuíba", estado: "SP" }
  );
  assert.equal(parsed.cidade, "Carapicuíba");
  assert.equal(parsed.estado, "SP");
  if (parsed.bairro) {
    assert.doesNotMatch(parsed.bairro, /cep/i);
    assert.doesNotMatch(parsed.bairro, /\d{5}/);
  }
});
