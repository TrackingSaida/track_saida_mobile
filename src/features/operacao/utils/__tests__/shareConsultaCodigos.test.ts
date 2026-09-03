import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildShareMessage,
  buildShareTitle,
  extractCodigosUnicos,
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
