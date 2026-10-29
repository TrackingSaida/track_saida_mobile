import assert from "node:assert/strict";
import { test } from "node:test";

import type { SituacaoBaseColeta } from "../../coletasApi";
import { completarPendentesPeriodo, contarResumoColetas, diasAteHoje } from "../pendentesPeriodoColeta";

function coleta(parcial: Partial<SituacaoBaseColeta> & Pick<SituacaoBaseColeta, "base_id" | "base" | "data_operacao" | "status">): SituacaoBaseColeta {
  return {
    id_execucao: 1,
    modo: "coleta_manual",
    total: 3,
    shopee: 1,
    mercado_livre: 2,
    avulso: 0,
    participantes: [],
    participando: false,
    pode_ajudar: false,
    ...parcial,
  };
}

test("dias do período param em hoje e atravessam o mês", () => {
  assert.deepEqual(diasAteHoje("2026-01-30", "2026-02-02", "2026-10-28"), [
    "2026-01-30",
    "2026-01-31",
    "2026-02-01",
    "2026-02-02",
  ]);
  assert.deepEqual(diasAteHoje("2026-10-16", "2026-10-31", "2026-10-28").at(-1), "2026-10-28");
  assert.deepEqual(diasAteHoje("2026-10-29", "2026-10-31", "2026-10-28"), []);
});

test("completa dias pendentes sem duplicar coleta existente", () => {
  const itens = [
    coleta({ base_id: 10, base: "ALFA", data_operacao: "2026-10-16", status: "coletado" }),
  ];
  const cheio = completarPendentesPeriodo(
    itens,
    [
      { id_base: 10, base: "ALFA" },
      { id_base: 20, base: "BETA" },
    ],
    "2026-10-16",
    "2026-10-18",
    "2026-10-28"
  );
  const chaves = cheio.map((item) => `${item.base_id}|${item.data_operacao}|${item.status}`).sort();
  assert.deepEqual(chaves, [
    "10|2026-10-16|coletado",
    "10|2026-10-17|pendente",
    "10|2026-10-18|pendente",
    "20|2026-10-16|pendente",
    "20|2026-10-17|pendente",
    "20|2026-10-18|pendente",
  ]);
  assert.equal(cheio.filter((item) => item.base_id === 10 && item.data_operacao === "2026-10-16").length, 1);
  assert.equal(cheio.find((item) => item.base_id === 20)?.sintetico, true);
  const resumo = contarResumoColetas(cheio);
  assert.equal(resumo.pendentes, 5);
  assert.equal(resumo.coletadas, 1);
});
