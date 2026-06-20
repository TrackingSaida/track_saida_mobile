import assert from "node:assert/strict";
import { derivePrepFlowView } from "../prepFlowState";

const base = {
  totalPedidos: 5,
  comEndereco: 5,
  semEndereco: 0,
  withCoordsCount: 5,
  routeOrderLength: 0,
  activeRouteId: null,
  separationViewed: true,
};

assert.notEqual(
  derivePrepFlowView({ ...base, apiRouteStatus: "rota_pronta", routeOrderLength: 3 }).primaryAction,
  "generate_route"
);

assert.equal(
  derivePrepFlowView({ ...base, apiRouteStatus: "em_entrega", activeRouteId: "99" }).primaryLabel,
  "Continuar entrega"
);

console.log("prepFlowState tests OK");
