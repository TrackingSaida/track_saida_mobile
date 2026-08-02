import assert from "node:assert/strict";
import { test } from "node:test";
import { derivePrepFlowView } from "../prepFlowState";

const baseInput = {
  totalPedidos: 14,
  comEndereco: 14,
  semEndereco: 0,
  withCoordsCount: 14,
  routeOrderLength: 0,
  activeRouteId: null,
  separationViewed: false,
};

test("sem endereços pendentes não exibe scan_more", () => {
  const view = derivePrepFlowView(baseInput);
  assert.equal(view.primaryAction, "generate_route");
  assert.equal(
    view.secondaryActions.some((s) => s.action === "scan_more"),
    false
  );
  assert.equal(view.addressCompleteMessage, "Todos os endereços foram informados");
  assert.equal(view.statusHint, null);
  assert.equal(view.canGeneratePartialRoute, false);
});

test("com endereços pendentes exibe scan_more e rota parcial quando há coords suficientes", () => {
  const view = derivePrepFlowView({
    ...baseInput,
    comEndereco: 12,
    semEndereco: 2,
    withCoordsCount: 12,
  });
  assert.equal(view.primaryAction, "add_address");
  assert.equal(view.primaryLabel, "Adicionar endereço pendente");
  assert.equal(view.statusChip, "missing_addresses");
  assert.equal(view.statusChipLabel, "2 pacotes sem endereço");
  assert.equal(view.canGeneratePartialRoute, true);
  assert.match(view.statusHint ?? "", /ficarão de fora se gerar rota parcial/);
  const scanMore = view.secondaryActions.find((s) => s.action === "scan_more");
  assert.ok(scanMore);
  assert.equal(scanMore.label, "Adicionar endereço por QR Code");
  assert.equal(
    scanMore.subtitle,
    "Leia o QR Code do pacote para preencher o endereço"
  );
  const partial = view.secondaryActions.find((s) => s.action === "generate_partial_route");
  assert.ok(partial);
  assert.equal(partial.label, "Gerar rota parcial");
  assert.equal(partial.subtitle, "12 pacotes prontos");
});

test("com endereços pendentes e menos de 2 coords não oferece rota parcial", () => {
  const view = derivePrepFlowView({
    ...baseInput,
    comEndereco: 1,
    semEndereco: 1,
    withCoordsCount: 1,
  });
  assert.equal(view.canGeneratePartialRoute, false);
  assert.equal(view.statusHint, null);
  assert.equal(
    view.secondaryActions.some((s) => s.action === "generate_partial_route"),
    false
  );
});

test("endereços completos exibe editar ordenação", () => {
  const view = derivePrepFlowView(baseInput);
  assert.equal(
    view.secondaryActions.some((s) => s.action === "edit_ordering"),
    true
  );
});

test("zero pedidos mantém primary de leitura inicial", () => {
  const view = derivePrepFlowView({
    ...baseInput,
    totalPedidos: 0,
    comEndereco: 0,
    semEndereco: 0,
    withCoordsCount: 0,
  });
  assert.equal(view.primaryAction, "scan");
  assert.equal(view.primaryLabel, "Escanear pacote");
});

test("rota ativa com pacotes extras oferece Refazer rota", () => {
  const view = derivePrepFlowView({
    ...baseInput,
    comEndereco: 5,
    withCoordsCount: 5,
    routeOrderLength: 3,
    routePendingCount: 3,
    activeRouteId: "r1",
  });
  assert.equal(view.primaryAction, "start_route");
  assert.equal(view.canRebuildActiveRoute, true);
  assert.equal(
    view.secondaryActions.some((s) => s.action === "rebuild_route"),
    true
  );
  assert.match(view.statusHint ?? "", /refazer a rota/i);
});

test("rota ativa alinhada sem pendências de endereço não oferece Refazer", () => {
  const view = derivePrepFlowView({
    ...baseInput,
    routeOrderLength: 14,
    routePendingCount: 14,
    activeRouteId: "r1",
  });
  assert.equal(view.canRebuildActiveRoute, false);
  assert.equal(
    view.secondaryActions.some((s) => s.action === "rebuild_route"),
    false
  );
});

test("rota ativa após entregas não oferece Refazer só porque a ordem total é maior", () => {
  const view = derivePrepFlowView({
    ...baseInput,
    totalPedidos: 2,
    comEndereco: 2,
    withCoordsCount: 2,
    routeOrderLength: 5,
    routePendingCount: 2,
    activeRouteId: "r1",
  });
  assert.equal(view.canRebuildActiveRoute, false);
  assert.equal(
    view.secondaryActions.some((s) => s.action === "rebuild_route"),
    false
  );
});
