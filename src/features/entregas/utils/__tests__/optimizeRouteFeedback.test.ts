import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decideOptimizeGpsStart,
  GPS_PERMISSION_REQUIRED_MESSAGE,
  GPS_START_REQUIRED_MESSAGE,
} from "../optimizeGpsStart";
import {
  isUsableLastKnown,
  resolveGpsPositionCascade,
  type GpsCascadeLocation,
  type GpsLastKnownPosition,
} from "../optimizeGpsCascade";
import {
  abandonOptimizeIdempotencyKey,
  beginOptimizeIdempotencyKey,
  endOptimizeIdempotencyKey,
  isOptimizeInFlight,
} from "../optimizeIdempotency";

const NOW = 1_700_000_000_000;

function lastKnown(
  overrides?: Partial<GpsLastKnownPosition> & { accuracy?: number }
): GpsLastKnownPosition {
  return {
    timestamp: overrides?.timestamp ?? NOW - 10_000,
    coords: {
      latitude: overrides?.coords?.latitude ?? -23.5,
      longitude: overrides?.coords?.longitude ?? -46.6,
      accuracy: overrides?.accuracy ?? overrides?.coords?.accuracy ?? 30,
    },
  };
}

test("com destino e GPS usa start", () => {
  const decision = decideOptimizeGpsStart({
    destinationMode: true,
    gps: { fromLat: -23.5, fromLon: -46.6 },
    permissionGranted: true,
  });
  assert.equal(decision.action, "use");
  if (decision.action === "use") {
    assert.equal(decision.fromLat, -23.5);
    assert.equal(decision.fromLon, -46.6);
  }
});

test("com destino, permissão e sem GPS pede nova tentativa (não acusa GPS desligado)", () => {
  const decision = decideOptimizeGpsStart({
    destinationMode: true,
    gps: null,
    permissionGranted: true,
  });
  assert.equal(decision.action, "block");
  if (decision.action === "block") {
    assert.equal(decision.message, GPS_START_REQUIRED_MESSAGE);
    assert.equal(decision.message.includes("Ative o GPS"), false);
  }
});

test("com destino e sem permissão pede acesso à localização", () => {
  const decision = decideOptimizeGpsStart({
    destinationMode: true,
    gps: null,
    permissionGranted: false,
  });
  assert.equal(decision.action, "block");
  if (decision.action === "block") {
    assert.equal(decision.message, GPS_PERMISSION_REQUIRED_MESSAGE);
  }
});

test("sem destino e sem GPS segue sem start", () => {
  const decision = decideOptimizeGpsStart({
    destinationMode: false,
    gps: null,
  });
  assert.equal(decision.action, "skip");
});

test("last-known recente e preciso é usável", () => {
  assert.equal(isUsableLastKnown(lastKnown(), NOW), true);
});

test("last-known velho demais é rejeitado", () => {
  assert.equal(isUsableLastKnown(lastKnown({ timestamp: NOW - 61_000 }), NOW), false);
});

test("last-known impreciso é rejeitado", () => {
  assert.equal(isUsableLastKnown(lastKnown({ accuracy: 250 }), NOW), false);
});

test("cascata usa last-known quando válido e não chama getCurrent", async () => {
  let currentCalls = 0;
  const location: GpsCascadeLocation = {
    Accuracy: { Low: 1, Balanced: 2 },
    getLastKnownPositionAsync: async () => lastKnown(),
    getCurrentPositionAsync: async () => {
      currentCalls += 1;
      return { coords: { latitude: 0, longitude: 0 } };
    },
  };
  const pos = await resolveGpsPositionCascade(location, { nowMs: NOW });
  assert.deepEqual(pos, { latitude: -23.5, longitude: -46.6 });
  assert.equal(currentCalls, 0);
});

test("cascata cai para Low se last-known falhar", async () => {
  const location: GpsCascadeLocation = {
    Accuracy: { Low: 1, Balanced: 2 },
    getLastKnownPositionAsync: async () => null,
    getCurrentPositionAsync: async ({ accuracy }) => {
      if (accuracy !== 1) throw new Error("não deveria pedir Balanced");
      return { coords: { latitude: -23.51, longitude: -46.61 } };
    },
  };
  const pos = await resolveGpsPositionCascade(location, { nowMs: NOW });
  assert.deepEqual(pos, { latitude: -23.51, longitude: -46.61 });
});

test("cascata cai para Balanced se Low falhar", async () => {
  const location: GpsCascadeLocation = {
    Accuracy: { Low: 1, Balanced: 2 },
    getLastKnownPositionAsync: async () => null,
    getCurrentPositionAsync: async ({ accuracy }) => {
      if (accuracy === 1) throw new Error("Low timeout");
      return { coords: { latitude: -23.52, longitude: -46.62 } };
    },
  };
  const pos = await resolveGpsPositionCascade(location, { nowMs: NOW });
  assert.deepEqual(pos, { latitude: -23.52, longitude: -46.62 });
});

test("cascata retorna null se todas as etapas falharem", async () => {
  const location: GpsCascadeLocation = {
    Accuracy: { Low: 1, Balanced: 2 },
    getLastKnownPositionAsync: async () => null,
    getCurrentPositionAsync: async () => {
      throw new Error("timeout");
    },
  };
  const pos = await resolveGpsPositionCascade(location, { nowMs: NOW });
  assert.equal(pos, null);
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
