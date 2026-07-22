import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMotoboyNome, normalizeMotoboyList } from "../motoboyListFormat";

test("formatMotoboyNome capitaliza iniciais", () => {
  assert.equal(formatMotoboyNome("adryel caue"), "Adryel Caue");
  assert.equal(formatMotoboyNome("JOSE DA SILVA"), "Jose da Silva");
});

test("normalizeMotoboyList ordena alfabeticamente", () => {
  const out = normalizeMotoboyList([
    { id_motoboy: 2, nome: "bruno" },
    { id_motoboy: 1, nome: "adryel caue" },
    { id_motoboy: 3, nome: "CARLOS" },
  ]);
  assert.deepEqual(
    out.map((m) => m.nome),
    ["Adryel Caue", "Bruno", "Carlos"]
  );
});
