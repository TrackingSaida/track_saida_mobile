import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildPeriodo,
  formatYmd,
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

test("buildPeriodo hoje é dia único", () => {
  const p = buildPeriodo("hoje");
  assert.equal(p.dataInicio, p.dataFim);
  assert.equal(p.preset, "hoje");
});

test("formatYmd estável", () => {
  assert.equal(formatYmd(new Date(2026, 0, 5)), "2026-01-05");
});
