export const GPS_LAST_KNOWN_MAX_AGE_MS = 60_000;
export const GPS_LAST_KNOWN_MAX_ACCURACY_M = 200;
export const GPS_LOW_TIMEOUT_MS = 12_000;
export const GPS_BALANCED_TIMEOUT_MS = 15_000;

export type GpsCoords = { latitude: number; longitude: number };

export type GpsLastKnownPosition = {
  coords: { latitude: number; longitude: number; accuracy?: number | null };
  timestamp: number;
};

export type GpsCascadeLocation = {
  getLastKnownPositionAsync: (options?: {
    maxAge?: number;
    requiredAccuracy?: number;
  }) => Promise<GpsLastKnownPosition | null>;
  getCurrentPositionAsync: (options: { accuracy: number }) => Promise<{
    coords: { latitude: number; longitude: number };
  }>;
  Accuracy: { Low: number; Balanced: number };
};

export function withGpsTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} expirou após ${Math.round(ms / 1000)}s`)),
      ms
    );
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export function isUsableLastKnown(
  pos: GpsLastKnownPosition | null | undefined,
  nowMs: number,
  opts?: { maxAgeMs?: number; maxAccuracyM?: number }
): pos is GpsLastKnownPosition {
  if (!pos) return false;
  const maxAge = opts?.maxAgeMs ?? GPS_LAST_KNOWN_MAX_AGE_MS;
  const maxAcc = opts?.maxAccuracyM ?? GPS_LAST_KNOWN_MAX_ACCURACY_M;
  const age = nowMs - pos.timestamp;
  if (!Number.isFinite(age) || age < 0 || age > maxAge) return false;
  const acc = pos.coords.accuracy;
  if (acc != null && Number.isFinite(acc) && acc > maxAcc) return false;
  return Number.isFinite(pos.coords.latitude) && Number.isFinite(pos.coords.longitude);
}

export async function resolveGpsPositionCascade(
  location: GpsCascadeLocation,
  deps?: {
    nowMs?: number;
    withTimeoutFn?: <T>(promise: Promise<T>, ms: number, label: string) => Promise<T>;
  }
): Promise<GpsCoords | null> {
  const nowMs = deps?.nowMs ?? Date.now();
  const timeoutFn = deps?.withTimeoutFn ?? withGpsTimeout;

  try {
    const last = await location.getLastKnownPositionAsync({
      maxAge: GPS_LAST_KNOWN_MAX_AGE_MS,
      requiredAccuracy: GPS_LAST_KNOWN_MAX_ACCURACY_M,
    });
    if (last && isUsableLastKnown(last, nowMs)) {
      return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    }
  } catch {
    /* tenta fix atual */
  }

  try {
    const pos = await timeoutFn(
      location.getCurrentPositionAsync({ accuracy: location.Accuracy.Low }),
      GPS_LOW_TIMEOUT_MS,
      "Localização GPS (baixa precisão)"
    );
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    /* tenta precisão equilibrada */
  }

  try {
    const pos = await timeoutFn(
      location.getCurrentPositionAsync({ accuracy: location.Accuracy.Balanced }),
      GPS_BALANCED_TIMEOUT_MS,
      "Localização GPS"
    );
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return null;
  }
}

/** Aquece o chip GPS em background (last-known + Low). Não bloqueia a UI. */
export function warmupOptimizeGps(location?: GpsCascadeLocation): void {
  void (async () => {
    try {
      const loc = location ?? ((await import("expo-location")) as unknown as GpsCascadeLocation);
      const last = await loc.getLastKnownPositionAsync({
        maxAge: GPS_LAST_KNOWN_MAX_AGE_MS,
        requiredAccuracy: GPS_LAST_KNOWN_MAX_ACCURACY_M,
      });
      if (last && isUsableLastKnown(last, Date.now())) return;
      await withGpsTimeout(
        loc.getCurrentPositionAsync({ accuracy: loc.Accuracy.Low }),
        GPS_LOW_TIMEOUT_MS,
        "GPS warmup"
      ).catch(() => null);
    } catch {
      /* best-effort */
    }
  })();
}
