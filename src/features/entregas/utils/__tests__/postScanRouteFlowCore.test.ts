import assert from "node:assert/strict";
import { test } from "node:test";
import { resolvePostScanRouteContext } from "../postScanRouteFlowCore";

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
