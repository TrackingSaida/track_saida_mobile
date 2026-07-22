import assert from "node:assert/strict";
import { test } from "node:test";
import { inferCoordPrecision } from "../geocode";
import {
  getApproximateLocationLabel,
  isApproximateLocation,
} from "../routeUtils";
import type { EntregaListItem } from "../../types";

test("inferCoordPrecision usa confiança do geocode antes da origem manual", () => {
  assert.equal(inferCoordPrecision("manual", "alta"), "rooftop");
  assert.equal(inferCoordPrecision("manual", "media"), "street");
  assert.equal(inferCoordPrecision("manual"), "approx");
  assert.equal(inferCoordPrecision("google_places", "media"), "rooftop");
  assert.equal(inferCoordPrecision("suggestion"), "street");
});

test("badge aproximada só para approx; street tem rótulo próprio", () => {
  const approx = { coord_precision: "approx" } as EntregaListItem;
  const street = { coord_precision: "street" } as EntregaListItem;
  const rooftop = { coord_precision: "rooftop" } as EntregaListItem;

  assert.equal(isApproximateLocation(approx), true);
  assert.equal(isApproximateLocation(street), false);
  assert.equal(isApproximateLocation(rooftop), false);

  assert.equal(getApproximateLocationLabel(approx), "Localização aproximada");
  assert.equal(getApproximateLocationLabel(street), "Precisão ao nível da rua");
  assert.equal(getApproximateLocationLabel(rooftop), null);
});
