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
});

test("com endereços pendentes exibe scan_more com copy de endereço por QR", () => {
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
  assert.equal(
    view.statusHint,
    "Todos os pacotes precisam de endereço antes de iniciar a rota."
  );
  const scanMore = view.secondaryActions.find((s) => s.action === "scan_more");
  assert.ok(scanMore);
  assert.equal(scanMore.label, "Adicionar endereço por QR Code");
  assert.equal(
    scanMore.subtitle,
    "Leia o QR Code do pacote para preencher o endereço"
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
