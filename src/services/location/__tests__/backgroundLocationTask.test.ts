import assert from "node:assert/strict";
import { test } from "node:test";
import { applyBackgroundLocationUpdate } from "../applyBackgroundLocationUpdate";

test("applyBackgroundLocationUpdate ignora payload vazio e erro da task", () => {
  let calls = 0;
  const setCurrentLocation = () => {
    calls += 1;
  };

  applyBackgroundLocationUpdate(undefined, null, setCurrentLocation);
  applyBackgroundLocationUpdate({ locations: [] }, null, setCurrentLocation);
  applyBackgroundLocationUpdate({ locations: [{ coords: {} }] }, null, setCurrentLocation);
  applyBackgroundLocationUpdate(
    { locations: [{ coords: { latitude: -23.5, longitude: -46.6 } }] },
    new Error("task failed"),
    setCurrentLocation
  );

  assert.equal(calls, 0);
});

test("applyBackgroundLocationUpdate grava coordenadas válidas", () => {
  const updates: Array<{ latitude: number; longitude: number; heading?: number }> = [];

  applyBackgroundLocationUpdate(
    {
      locations: [
        {
          coords: {
            latitude: -23.5505,
            longitude: -46.6333,
            heading: 90,
          },
        },
      ],
    },
    null,
    (location) => {
      if (location) updates.push(location);
    }
  );

  assert.deepEqual(updates, [
    {
      latitude: -23.5505,
      longitude: -46.6333,
      heading: 90,
    },
  ]);
});

test("applyBackgroundLocationUpdate não propaga falha do store", () => {
  assert.doesNotThrow(() => {
    applyBackgroundLocationUpdate(
      {
        locations: [
          {
            coords: {
              latitude: -23.55,
              longitude: -46.63,
            },
          },
        ],
      },
      null,
      () => {
        throw new Error("store unavailable");
      }
    );
  });
});
