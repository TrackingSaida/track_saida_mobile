import assert from "node:assert/strict";
import { test } from "node:test";
import { CLUSTER_THRESHOLD, clusterMapPoints } from "../mapClusterUtils";

function makePoints(count: number, closeTogether = false) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    latitude: closeTogether ? -23.55 + i * 0.0001 : -23.5 + i * 0.02,
    longitude: closeTogether ? -46.63 + i * 0.0001 : -46.6 + i * 0.02,
  }));
}

test("routeMode com mais de 50 pontos devolve um single por parada", () => {
  const points = makePoints(51, true);
  const items = clusterMapPoints(points, { routeMode: true });
  assert.equal(items.length, 51);
  assert.ok(items.every((item) => item.type === "single"));
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    assert.equal(item.type, "single");
    if (item.type === "single") {
      assert.equal(item.point.id, i + 1);
    }
  }
});

test("fora de routeMode ainda clusteriza pontos próximos acima do threshold", () => {
  const points = makePoints(CLUSTER_THRESHOLD + 5, true);
  const items = clusterMapPoints(points, { routeMode: false });
  assert.ok(items.some((item) => item.type === "cluster"));
  const covered = items.reduce(
    (sum, item) => sum + (item.type === "cluster" ? item.count : 1),
    0
  );
  assert.equal(covered, points.length);
});
