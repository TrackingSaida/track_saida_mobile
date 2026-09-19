import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decideOptimizeGpsStart,
  GPS_START_REQUIRED_MESSAGE,
} from "../optimizeGpsStart";
import {
  abandonOptimizeIdempotencyKey,
  beginOptimizeIdempotencyKey,
  endOptimizeIdempotencyKey,
  isOptimizeInFlight,
} from "../optimizeIdempotency";

test("com destino e GPS usa start", () => {
  const decision = decideOptimizeGpsStart({
    destinationMode: true,
    gps: { fromLat: -23.5, fromLon: -46.6 },
  });
  assert.equal(decision.action, "use");
  if (decision.action === "use") {
    assert.equal(decision.fromLat, -23.5);
    assert.equal(decision.fromLon, -46.6);
  }
});

test("com destino e sem GPS bloqueia optimize só com end", () => {
  const decision = decideOptimizeGpsStart({
    destinationMode: true,
    gps: null,
  });
  assert.equal(decision.action, "block");
  if (decision.action === "block") {
    assert.equal(decision.message, GPS_START_REQUIRED_MESSAGE);
  }
});

test("sem destino e sem GPS segue sem start", () => {
  const decision = decideOptimizeGpsStart({
    destinationMode: false,
    gps: null,
  });
  assert.equal(decision.action, "skip");
});

test("endOptimizeIdempotencyKey no finally libera lock mesmo sem optimize", () => {
  abandonOptimizeIdempotencyKey();
  beginOptimizeIdempotencyKey();
  assert.equal(isOptimizeInFlight(), true);
  try {
    /* simula GPS bloqueado: não chama optimize */
  } finally {
    endOptimizeIdempotencyKey();
  }
  assert.equal(isOptimizeInFlight(), false);
});
