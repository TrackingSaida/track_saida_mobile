import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildShareMessage,
  buildShareMessageGrouped,
  buildShareTitle,
  extractCodigosUnicos,
  groupCodigosPorData,
} from "../shareConsultaCodigos";

test("título Na base", () => {
  assert.equal(
    buildShareTitle({ status: "NA_BASE" }),
    "Pedidos com entrada na base sem saída:"
  );
});

test("título genérico com status e período", () => {
  const title = buildShareTitle({
    status: "Saiu para entrega",
    de: "2026-09-02",
    ate: "2026-09-02",
  });
  assert.match(title, /^Pedidos consultados \(/);
  assert.match(title, /Em rota/);
});

test("extractCodigosUnicos preserva ordem e dedupe", () => {
  const rows = [
    { codigo: "AAA" },
    { codigo: "bbb" },
    { codigo: "AAA" },
    { codigo: " " },
    { codigo: "CCC" },
  ];
  assert.deepEqual(extractCodigosUnicos(rows), ["AAA", "bbb", "CCC"]);
});

test("groupCodigosPorData agrupa por data do pacote", () => {
  const rows = [
    { codigo: "C1", data: "2026-09-02" },
    { codigo: "C2", data: "2026-09-01" },
    { codigo: "C3", data: "2026-09-02" },
  ];
  const groups = groupCodigosPorData(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.date, "2026-09-02");
  assert.deepEqual(groups[0]?.codigos, ["C1", "C3"]);
  assert.equal(groups[1]?.date, "2026-09-01");
  assert.deepEqual(groups[1]?.codigos, ["C2"]);
});

test("buildShareMessage com e mais N", () => {
  const msg = buildShareMessage({
    title: "Pedidos consultados:",
    codigos: ["A", "B"],
    total: 5,
  });
  assert.equal(
    msg,
    ["Pedidos consultados:", "", "A", "B", "… e mais 3"].join("\n")
  );
});

test("buildShareMessage sem mais quando total cabe", () => {
  const msg = buildShareMessage({
    title: "Pedidos consultados:",
    codigos: ["A", "B"],
    total: 2,
  });
  assert.equal(msg, ["Pedidos consultados:", "", "A", "B"].join("\n"));
});

test("buildShareMessageGrouped com datas mesmo em um único dia", () => {
  const msg = buildShareMessageGrouped({
    title: "Pedidos com entrada na base sem saída:",
    groups: [{ date: "2026-09-02", codigos: ["47904086063", "47912223892"] }],
    total: 2,
  });
  assert.equal(
    msg,
    [
      "Pedidos com entrada na base sem saída:",
      "",
      "02/09/2026:",
      "47904086063",
      "47912223892",
    ].join("\n")
  );
});

test("buildShareMessageGrouped com múltiplas datas", () => {
  const msg = buildShareMessageGrouped({
    title: "Pedidos com entrada na base sem saída:",
    groups: [
      { date: "2026-09-02", codigos: ["A"] },
      { date: "2026-09-01", codigos: ["B", "C"] },
    ],
    total: 3,
  });
  assert.match(msg, /02\/09\/2026:\nA/);
  assert.match(msg, /01\/09\/2026:\nB\nC/);
});
