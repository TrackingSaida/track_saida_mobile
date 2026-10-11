import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEnderecoRows, buildExportFileName, normalizeCepExport } from "../exportEnderecosRows";

test("normalizeCepExport completa zero à esquerda e remove máscara", () => {
  assert.equal(normalizeCepExport("2050020"), "02050020");
  assert.equal(normalizeCepExport("02050-020"), "02050020");
  assert.equal(normalizeCepExport(null), "");
});

test("buildEnderecoRows remove endereços repetidos", () => {
  const rows = buildEnderecoRows([
    { endereco: "Rua Astecas", numero: "258", cep: "2262040" },
    { endereco: "RUA  ASTECAS ", numero: "258", cep: "02262-040" },
    { endereco: "Rua Astecas", numero: "260", cep: "02262040" },
  ]);
  assert.deepEqual(rows, [
    { "endereço": "Rua Astecas", numero: "258", cep: "02262040" },
    { "endereço": "Rua Astecas", numero: "260", cep: "02262040" },
  ]);
});

test("buildEnderecoRows ignora pacote sem rua e mantém campos vazios", () => {
  const rows = buildEnderecoRows([
    { endereco: null, numero: "10", cep: "01001000" },
    { endereco: "  ", numero: "10", cep: "01001000" },
    { endereco: "Rua Catita", numero: null, cep: undefined },
  ]);
  assert.deepEqual(rows, [{ "endereço": "Rua Catita", numero: "", cep: "" }]);
});

test("buildEnderecoRows tira o número do campo endereço", () => {
  const rows = buildEnderecoRows([
    { endereco: "Alameda Sabiá, 25", numero: "25", cep: "06428110" },
    { endereco: "Rua Luis Tavares, 300, Edi Vista Norte Blc B", numero: "300", cep: "2050020" },
    { endereco: "Rua 25 de Março, 25", numero: "25", cep: "01021000" },
    { endereco: "Rua Sem Numero, Fundos", numero: null, cep: "01001000" },
  ]);
  assert.deepEqual(rows, [
    { "endereço": "Alameda Sabiá", numero: "25", cep: "06428110" },
    { "endereço": "Rua Luis Tavares Edi Vista Norte Blc B", numero: "300", cep: "02050020" },
    { "endereço": "Rua 25 de Março", numero: "25", cep: "01021000" },
    { "endereço": "Rua Sem Numero, Fundos", numero: "", cep: "01001000" },
  ]);
});

test("buildExportFileName usa data local", () => {
  assert.equal(buildExportFileName(new Date(2026, 9, 11)), "enderecos-rota-2026-10-11.xlsx");
});
