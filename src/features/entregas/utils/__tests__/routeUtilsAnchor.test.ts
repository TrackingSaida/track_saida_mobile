import assert from "node:assert/strict";
import { test } from "node:test";
import type { EntregaListItem } from "../../types";
import {
  findInRouteByQuery,
  getDeliveryIndexAfterGroup,
  groupOrderedByAddress,
  type GroupedStop,
} from "../routeUtils";

function makeDelivery(id: number, codigo: string): EntregaListItem {
  return {
    id_saida: id,
    codigo,
    cliente: "Cliente",
    servico: "Shopee",
    possui_endereco: true,
    exibicao: "Pendente",
  } as EntregaListItem;
}

function makeGroups(items: EntregaListItem[][]): GroupedStop[] {
  return items.map((deliveries, i) => ({
    key: `g${i}`,
    stopKey: `s${i}`,
    deliveries,
    deliveryIds: deliveries.map((d) => d.id_saida),
    representativeDelivery: deliveries[0],
  }));
}

test("getDeliveryIndexAfterGroup soma entregas até a âncora inclusive", () => {
  const groups = makeGroups([
    [makeDelivery(1, "A"), makeDelivery(2, "B")],
    [makeDelivery(3, "C")],
    [makeDelivery(4, "D"), makeDelivery(5, "E")],
  ]);
  assert.equal(getDeliveryIndexAfterGroup(groups, 0), 2);
  assert.equal(getDeliveryIndexAfterGroup(groups, 1), 3);
  assert.equal(getDeliveryIndexAfterGroup(groups, 2), 5);
});

test("findInRouteByQuery prioriza match exato sobre contém", () => {
  const groups = makeGroups([
    [makeDelivery(100, "ABC-111")],
    [makeDelivery(200, "XYZ-222")],
    [makeDelivery(300, "OUTRO")],
  ]);
  const exact = findInRouteByQuery(groups, "ABC-111");
  assert.equal(exact[0].delivery.id_saida, 100);
  assert.equal(exact[0].score, 100);

  const partial = findInRouteByQuery(groups, "11");
  assert.ok(partial.length >= 1);
  assert.equal(partial[0].delivery.id_saida, 100);
});

test("findInRouteByQuery encontra id_saida parcial", () => {
  const ordered = [makeDelivery(98765, "X1"), makeDelivery(98766, "X2")];
  const groups = groupOrderedByAddress(ordered);
  const matches = findInRouteByQuery(groups, "9876");
  assert.ok(matches.length >= 1);
  assert.ok(matches.some((m) => String(m.delivery.id_saida).includes("9876")));
});
