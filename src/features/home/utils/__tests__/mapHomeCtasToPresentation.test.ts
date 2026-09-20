import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deriveHomeCtas,
  deriveHomeOperationalView,
  type HomeOperationalInput,
} from "../homeOperationalState";
import { mapHomeCtasToPresentation } from "../mapHomeCtasToPresentation";
import type { EntregaListItem } from "../../../entregas/types";

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

test("mapHomeCtasToPresentation: route_completed vira estado, não próxima ação", () => {
  const view = deriveHomeOperationalView({
    ...baseInput,
    routeOrder: [],
    routeDeliveries: [],
    ephemeralCompleted: { rotaId: "x", paradas: 2, pedidos: 3, completedAt: "" },
  });
  const ctas = deriveHomeCtas(view, true);
  const ui = mapHomeCtasToPresentation(view, ctas);
  assert.equal(ui.nextAction, undefined);
  assert.equal(ui.completedAction?.action, "view_summary");
});

test("mapHomeCtasToPresentation: pending + roteirização usa tertiary prepare_route", () => {
  const view = deriveHomeOperationalView({
    ...baseInput,
    routeOrder: [],
    routeDeliveries: [],
    resumo: { pendentes: 3, finalizadas_hoje: 0, ausentes: 0, atraso_d1: 0 },
  });
  const ctas = deriveHomeCtas(view, true);
  const ui = mapHomeCtasToPresentation(view, ctas);
  assert.equal(ui.viewPending?.action, "view_pending");
  assert.equal(ui.nextAction?.action, "prepare_route");
});

test("mapHomeCtasToPresentation: idle usa scan_insert no card como atalho", () => {
  const view = deriveHomeOperationalView({
    ...baseInput,
    routeOrder: [],
    routeDeliveries: [],
  });
  const ctas = deriveHomeCtas(view, true);
  const ui = mapHomeCtasToPresentation(view, ctas);
  assert.equal(view.heroState, "idle");
  assert.equal(ui.nextAction, undefined);
  assert.equal(ui.viewPending, undefined);
  assert.equal(ui.cardAction?.action, "scan_insert");
  assert.equal(ui.cardAction?.label, "Inserir pacotes");
  assert.equal(ui.coletaAction, undefined);
  assert.equal(ui.view.description, "Escaneie os pacotes para iniciar suas entregas.");
});

test("mapHomeCtasToPresentation: idle com coleta adiciona atalho de registrar coleta", () => {
  const view = deriveHomeOperationalView({
    ...baseInput,
    routeOrder: [],
    routeDeliveries: [],
  });
  const ctas = deriveHomeCtas(view, true);
  const ui = mapHomeCtasToPresentation(view, ctas, { showColeta: true });
  assert.equal(ui.cardAction?.action, "scan_insert");
  assert.equal(ui.cardAction?.label, "Inserir pacotes");
  assert.equal(ui.coletaAction?.action, "scan_coleta");
  assert.equal(ui.view.description, "Leia a carga ou registre uma coleta para começar.");
});

test("mapHomeCtasToPresentation: pending não mostra coleta no card", () => {
  const view = deriveHomeOperationalView({
    ...baseInput,
    routeOrder: [],
    routeDeliveries: [],
    resumo: { pendentes: 3, finalizadas_hoje: 0, ausentes: 0, atraso_d1: 0 },
  });
  const ctas = deriveHomeCtas(view, true);
  const ui = mapHomeCtasToPresentation(view, ctas, { showColeta: true });
  assert.equal(ui.viewPending?.action, "view_pending");
  assert.equal(ui.coletaAction, undefined);
  assert.equal(ui.cardAction, undefined);
});

test("mapHomeCtasToPresentation: route_ready usa primary start_route", () => {
  const view = deriveHomeOperationalView(baseInput);
  const ctas = deriveHomeCtas(view, true);
  const ui = mapHomeCtasToPresentation(view, ctas);
  assert.equal(view.heroState, "route_ready");
  assert.equal(ui.nextAction?.action, "start_route");
  assert.equal(ui.completedAction, undefined);
});
