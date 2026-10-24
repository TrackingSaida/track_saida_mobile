import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePostScanRouteContext, shouldPromptAddressDuringScan } from "../postScanRouteFlowCore";

test("sem roteirização não dispara fluxo de rota pós-scan", () => {
  assert.equal(
    resolvePostScanRouteContext({
      roteirizacaoHabilitada: false,
      routeOrderLength: 5,
      activeRouteId: "r1",
    }),
    "none"
  );
});

test("rota ativa notifica; rota pronta pergunta", () => {
  assert.equal(
    resolvePostScanRouteContext({
      roteirizacaoHabilitada: true,
      routeOrderLength: 3,
      activeRouteId: "r1",
    }),
    "route_active_notify"
  );
  assert.equal(
    resolvePostScanRouteContext({
      roteirizacaoHabilitada: true,
      routeOrderLength: 3,
      activeRouteId: null,
    }),
    "route_ready_gate"
  );
});

test("endereço durante a leitura só abre sem rota e sem destino utilizável", () => {
  const base = {
    roteirizacaoHabilitada: true,
    prepararDuranteBipagem: true,
    routeContext: "none" as const,
    needsAddress: true,
  };
  assert.equal(shouldPromptAddressDuringScan(base), true);
  assert.equal(shouldPromptAddressDuringScan({ ...base, prepararDuranteBipagem: false }), false);
  assert.equal(shouldPromptAddressDuringScan({ ...base, needsAddress: false }), false);
  assert.equal(
    shouldPromptAddressDuringScan({ ...base, routeContext: "route_active_notify" }),
    false
  );
  assert.equal(
    shouldPromptAddressDuringScan({ ...base, routeContext: "route_ready_gate" }),
    false
  );
});
