import assert from "node:assert/strict";
import { test } from "node:test";
import { applyRouteSyncFromResponse } from "../routeActiveSync";

test("rota_finalizada marca pending dismiss e não limpa pins", async () => {
  let marked: string | null = null;
  let cleared = false;

  const result = await applyRouteSyncFromResponse(
    {
      in_active_route: false,
      rota_finalizada: true,
      rota_id: "rota-123",
    },
    {
      getActiveRouteId: () => "rota-123",
      getRouteOrder: () => [1, 2],
      getRouteDeliveryStatus: () => ({ 1: "ausente", 2: "ausente" }),
      restoreActiveRoute: async () => undefined,
      clearActiveRouteState: () => {
        cleared = true;
      },
      markRouteCompletedPendingDismiss: (rotaId) => {
        marked = rotaId;
      },
      isRouteCompletedAwaitingDismiss: () => false,
      setActiveStopIndex: () => undefined,
      stopBackgroundTracking: async () => undefined,
    }
  );

  assert.deepEqual(result, {
    routeJustCompleted: true,
    rotaIdForResumo: "rota-123",
  });
  assert.equal(marked, "rota-123");
  assert.equal(cleared, false);
});

test("awaiting dismiss não limpa de novo sem sync de finalização", async () => {
  let cleared = false;
  let marked = false;

  const result = await applyRouteSyncFromResponse(undefined, {
    getActiveRouteId: () => "rota-123",
    getRouteOrder: () => [1, 2],
    getRouteDeliveryStatus: () => ({ 1: "ausente", 2: "entregue" }),
    restoreActiveRoute: async () => undefined,
    clearActiveRouteState: () => {
      cleared = true;
    },
    markRouteCompletedPendingDismiss: () => {
      marked = true;
    },
    isRouteCompletedAwaitingDismiss: () => true,
    setActiveStopIndex: () => undefined,
    stopBackgroundTracking: async () => undefined,
  });

  assert.equal(result.routeJustCompleted, true);
  assert.equal(result.rotaIdForResumo, "rota-123");
  assert.equal(cleared, false);
  assert.equal(marked, false);
});
