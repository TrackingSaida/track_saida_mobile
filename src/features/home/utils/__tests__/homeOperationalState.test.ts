import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveHomeCtas,
  deriveHomeOperationalView,
  shouldOfferPrepareRouteWhileActive,
  type HomeOperationalInput,
} from "../homeOperationalState";
import {
  deliveryNeedsAddressForRoute,
  resolvePostScanRouteContext,
} from "../../../entregas/utils/postScanRouteFlowCore";
import type { EntregaListItem } from "../../entregas/types";

const baseInput: HomeOperationalInput = {
  roteirizacaoHabilitada: true,
  resumo: { pendentes: 0, finalizadas_hoje: 0, ausentes: 0, atraso_d1: 0 },
  activeRouteId: null,
  rotaAtivaValid: false,
  routeOrder: [1, 2, 3],
  routeDeliveries: [{ id_saida: 1 }, { id_saida: 2 }, { id_saida: 3 }] as EntregaListItem[],
  activeStopIndex: 0,
  routeDeliveryStatus: { 1: "pendente", 2: "pendente", 3: "pendente" },
  ephemeralCompleted: null,
};

function hasScanInsert(ctas: ReturnType<typeof deriveHomeCtas>): boolean {
  if (ctas.layout === "route") {
    return ctas.secondary.some((c) => c.action === "scan_insert");
  }
  return ctas.scanInsert.action === "scan_insert";
}

test("deriveHomeCtas inclui scan_insert em route_ready, route_active e route_completed", () => {
  const readyView = deriveHomeOperationalView(baseInput);
  assert.equal(readyView.heroState, "route_ready");
  assert.equal(hasScanInsert(deriveHomeCtas(readyView, true)), true);

  const activeView = deriveHomeOperationalView({
    ...baseInput,
    activeRouteId: "r1",
    rotaAtivaValid: true,
  });
  assert.equal(activeView.heroState, "route_active");
  assert.equal(hasScanInsert(deriveHomeCtas(activeView, true)), true);

  const completedView = deriveHomeOperationalView({
    ...baseInput,
    routeOrder: [],
    routeDeliveries: [],
    ephemeralCompleted: { rotaId: "x", paradas: 2, pedidos: 3, finalizadoEm: "" },
  });
  assert.equal(completedView.heroState, "route_completed");
  assert.equal(hasScanInsert(deriveHomeCtas(completedView, true)), true);
});

test("deriveHomeCtas inclui Preparar rota em route_active quando há diferença de pacotes", () => {
  const activeView = deriveHomeOperationalView({
    ...baseInput,
    activeRouteId: "r1",
    rotaAtivaValid: true,
  });
  const ctas = deriveHomeCtas(activeView, true, { offerPrepareRoute: true });
  assert.equal(ctas.layout, "route");
  if (ctas.layout === "route") {
    assert.equal(
      ctas.secondary.some((c) => c.action === "prepare_route"),
      true
    );
  }
});

test("shouldOfferPrepareRouteWhileActive exige sem endereço ou diferença de quantidade", () => {
  assert.equal(
    shouldOfferPrepareRouteWhileActive({
      semEndereco: 2,
      preparadosComEndereco: 3,
      pedidosPendentesNaRotaAtiva: 3,
    }),
    true
  );
  assert.equal(
    shouldOfferPrepareRouteWhileActive({
      semEndereco: 0,
      preparadosComEndereco: 5,
      pedidosPendentesNaRotaAtiva: 3,
    }),
    true
  );
  assert.equal(
    shouldOfferPrepareRouteWhileActive({
      semEndereco: 0,
      preparadosComEndereco: 3,
      pedidosPendentesNaRotaAtiva: 3,
    }),
    false
  );
  // Após entregar na rota: ordem ainda tem 5, mas só 2 pendentes e 2 preparados → não oferecer
  assert.equal(
    shouldOfferPrepareRouteWhileActive({
      semEndereco: 0,
      preparadosComEndereco: 2,
      pedidosPendentesNaRotaAtiva: 2,
    }),
    false
  );
});

test("resolvePostScanRouteContext distingue rota pronta, ativa e sem roteirização", () => {
  assert.equal(
    resolvePostScanRouteContext({
      roteirizacaoHabilitada: false,
      routeOrderLength: 5,
      activeRouteId: null,
    }),
    "none"
  );
  assert.equal(
    resolvePostScanRouteContext({
      roteirizacaoHabilitada: true,
      routeOrderLength: 5,
      activeRouteId: "abc",
    }),
    "route_active_notify"
  );
  assert.equal(
    resolvePostScanRouteContext({
      roteirizacaoHabilitada: true,
      routeOrderLength: 5,
      activeRouteId: null,
    }),
    "route_ready_gate"
  );
});

test("deliveryNeedsAddressForRoute exige endereço e coordenadas", () => {
  assert.equal(
    deliveryNeedsAddressForRoute({ id_saida: 1, possui_endereco: false } as EntregaListItem),
    true
  );
  assert.equal(
    deliveryNeedsAddressForRoute({
      id_saida: 1,
      possui_endereco: true,
      endereco: "Rua A",
      latitude: null,
      longitude: null,
    } as EntregaListItem),
    true
  );
  assert.equal(
    deliveryNeedsAddressForRoute({
      id_saida: 1,
      possui_endereco: true,
      endereco: "Rua A",
      latitude: -23.5,
      longitude: -46.6,
    } as EntregaListItem),
    false
  );
});
