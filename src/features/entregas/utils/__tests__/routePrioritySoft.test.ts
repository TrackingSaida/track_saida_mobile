import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SOFT_PRIORITY_PENALTY_KM,
  effectiveCostKm,
  optimizeStopsSoftPriority,
  type RoutePriority,
} from "../routePriority";
import type { EntregaListItem } from "../../types";

const BASE_LAT = -23.55;
const BASE_LON = -46.63;

function delivery(
  id: number,
  dlat: number,
  servico: string
): EntregaListItem {
  return {
    id_saida: id,
    codigo: `C${id}`,
    servico,
    status: "pendente",
    latitude: BASE_LAT + dlat,
    longitude: BASE_LON,
  } as EntregaListItem;
}

test("effectiveCostKm: nearby sem penalidade", () => {
  assert.equal(effectiveCostKm(0.2, SOFT_PRIORITY_PENALTY_KM), 0.2);
});

test("effectiveCostKm: entre nearby e threshold soma penalidade", () => {
  assert.equal(effectiveCostKm(0.5, SOFT_PRIORITY_PENALTY_KM), 0.5 + SOFT_PRIORITY_PENALTY_KM);
});

test("effectiveCostKm: acima do threshold sem penalidade", () => {
  assert.equal(effectiveCostKm(2, SOFT_PRIORITY_PENALTY_KM), 2);
});

test("ambos nearby: escolhe o mais perto mesmo com prioridade Flex", () => {
  const shopee = delivery(1, 0.0018, "Shopee"); // ~200m
  const flex = delivery(2, 0.0027, "Mercado Livre"); // ~300m
  const deliveries = [shopee, flex];
  const order = [1, 2];
  const priority: RoutePriority = { type: "service", value: "Flex" };
  const ordered = optimizeStopsSoftPriority(
    deliveries,
    order,
    priority,
    BASE_LAT,
    BASE_LON
  );
  assert.equal(ordered[0], 1);
});

test("Shopee nearby e Flex longe: Shopee primeiro", () => {
  const shopee = delivery(1, 0.0018, "Shopee");
  const flex = delivery(2, 0.0054, "Flex");
  const ordered = optimizeStopsSoftPriority(
    [shopee, flex],
    [1, 2],
    { type: "service", value: "Flex" },
    BASE_LAT,
    BASE_LON
  );
  assert.equal(ordered[0], 1);
});
