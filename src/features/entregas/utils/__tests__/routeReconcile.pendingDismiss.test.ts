import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcileActiveRouteState } from "../routeReconcile";

test("reconcile com awaiting dismiss preserva pins (não limpa)", async () => {
  let cleared = false;
  let marked = false;

  const result = await reconcileActiveRouteState({
    getActiveRouteId: () => "rota-1",
    getRouteOrder: () => [10, 20],
    getRouteDeliveries: () => [],
    getRouteDeliveryStatus: () => ({ 10: "ausente", 20: "ausente" }),
    clearActiveRouteState: () => {
      cleared = true;
    },
    markRouteCompletedPendingDismiss: () => {
      marked = true;
    },
    isRouteCompletedAwaitingDismiss: () => true,
    getCompletedRotaIdForResumo: () => "rota-1",
    restoreActiveRoute: async () => undefined,
  });

  assert.equal(result.stillActive, false);
  assert.equal(result.rotaIdForResumo, "rota-1");
  assert.equal(cleared, false);
  assert.equal(marked, false);
});
