import assert from "node:assert/strict";
import { test } from "node:test";
import { isForegroundServiceBackgroundError } from "../foregroundServiceError";

test("isForegroundServiceBackgroundError reconhece a rejeição do Android", () => {
  assert.equal(
    isForegroundServiceBackgroundError(
      new Error(
        "Call to function 'ExpoLocation.startLocationUpdatesAsync' has been rejected.\n→ Caused by: Couldn't start the foreground service. Foreground service cannot be started when the application is in the background"
      )
    ),
    true
  );
  assert.equal(isForegroundServiceBackgroundError(new Error("network timeout")), false);
});
