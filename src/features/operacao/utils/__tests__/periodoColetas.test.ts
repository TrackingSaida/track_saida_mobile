import assert from "node:assert/strict";
import { test } from "node:test";
import { intervaloPresetColeta } from "../periodoColetas";

test("quinzena atual copia o fim do bloco, não o dia de hoje", () => {
  const primeira = intervaloPresetColeta("quinzena", new Date(2026, 6, 10));
  assert.equal(primeira.inicio, "2026-07-01");
  assert.equal(primeira.fim, "2026-07-15");

  const segunda = intervaloPresetColeta("quinzena", new Date(2026, 6, 20));
  assert.equal(segunda.inicio, "2026-07-16");
  assert.equal(segunda.fim, "2026-07-31");
});

test("quinzena anterior na primeira metade volta ao bloco 16–fim do mês passado", () => {
  const q = intervaloPresetColeta("quinzena_anterior", new Date(2026, 6, 10));
  assert.equal(q.inicio, "2026-06-16");
  assert.equal(q.fim, "2026-06-30");
});

test("últimos 15 dias incluem o dia de referência", () => {
  const q = intervaloPresetColeta("ultimos15", new Date(2026, 6, 10));
  assert.equal(q.inicio, "2026-06-26");
  assert.equal(q.fim, "2026-07-10");
});

test("semana começa na segunda", () => {
  const q = intervaloPresetColeta("semana", new Date(2026, 9, 24));
  assert.equal(q.inicio, "2026-10-19");
  assert.equal(q.fim, "2026-10-25");
});
