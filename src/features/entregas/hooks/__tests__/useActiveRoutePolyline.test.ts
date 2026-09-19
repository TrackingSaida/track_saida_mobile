import assert from "node:assert/strict";
import { test } from "node:test";
import { selectDisplayedPolyline } from "../useActiveRoutePolyline";
import type { RoutePoint } from "../../utils/routeUtils";

const google: RoutePoint[] = [
  { latitude: -23.55, longitude: -46.63 },
  { latitude: -23.56, longitude: -46.64 },
  { latitude: -23.57, longitude: -46.65 },
];
const approach: RoutePoint[] = [
  { latitude: -23.54, longitude: -46.62 },
  { latitude: -23.55, longitude: -46.63 },
];

test("com Google válido não concatena approach na polyline", () => {
  const result = selectDisplayedPolyline({
    useBackendGoogle: true,
    isRouteActive: true,
    approachPolyline: approach,
    restPolyline: google,
  });
  assert.equal(result, google);
  assert.equal(result?.length, 3);
});

test("sem Google junta approach com o resto da rota ativa", () => {
  const result = selectDisplayedPolyline({
    useBackendGoogle: false,
    isRouteActive: true,
    approachPolyline: approach,
    restPolyline: google,
  });
  assert.ok(result);
  assert.equal(result!.length, 4);
  assert.equal(result![0], approach[0]);
  assert.equal(result![result!.length - 1], google[google.length - 1]);
});

test("em planejamento ignora approach mesmo sem Google", () => {
  const result = selectDisplayedPolyline({
    useBackendGoogle: false,
    isRouteActive: false,
    approachPolyline: approach,
    restPolyline: google,
  });
  assert.equal(result, google);
});
