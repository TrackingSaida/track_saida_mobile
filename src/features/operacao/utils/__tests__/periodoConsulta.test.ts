import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPeriodo,
  formatYmd,
  periodoQuinzenaAnterior,
  periodoQuinzenaAtual,
} from "../periodoConsulta";

test("quinzena atual na 1ª metade do mês", () => {
  const ref = new Date(2026, 6, 10); // 10/jul
  const q = periodoQuinzenaAtual(ref);
  assert.equal(q.inicio, "2026-07-01");
  assert.equal(q.fim, "2026-07-10");
});

test("quinzena atual na 2ª metade do mês", () => {
  const ref = new Date(2026, 6, 20);
  const q = periodoQuinzenaAtual(ref);
  assert.equal(q.inicio, "2026-07-16");
  assert.equal(q.fim, "2026-07-20");
});

test("quinzena anterior na 1ª metade do mês", () => {
  const q = periodoQuinzenaAnterior(new Date(2026, 6, 10)); // 10/jul → 16–30 jun
  assert.equal(q.inicio, "2026-06-16");
  assert.equal(q.fim, "2026-06-30");
});

test("quinzena anterior na 2ª metade do mês", () => {
  const q = periodoQuinzenaAnterior(new Date(2026, 6, 20)); // 20/jul → 01–15 jul
  assert.equal(q.inicio, "2026-07-01");
  assert.equal(q.fim, "2026-07-15");
});

test("quinzena anterior na virada de ano", () => {
  const q = periodoQuinzenaAnterior(new Date(2026, 0, 10)); // 10/jan → 16–31 dez
  assert.equal(q.inicio, "2025-12-16");
  assert.equal(q.fim, "2025-12-31");
});

test("buildPeriodo hoje é dia único", () => {
  const p = buildPeriodo("hoje");
  assert.equal(p.dataInicio, p.dataFim);
  assert.equal(p.preset, "hoje");
});

test("formatYmd estável", () => {
  assert.equal(formatYmd(new Date(2026, 0, 5)), "2026-01-05");
});
