/**
 * Probe temporário de crash no startup (debug session).
 * Emite console (logcat) + ingest HTTP quando o host de debug estiver alcançável.
 */
type ProbePayload = {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  runId?: string;
};

const ENDPOINT =
  "http://127.0.0.1:7861/ingest/f30282c5-d55f-41c3-8a1a-f808c2b3fd7d";
const SESSION = "1ebbdb";

export function debugCrashProbe(payload: ProbePayload): void {
  const body = {
    sessionId: SESSION,
    runId: payload.runId ?? "pre-fix",
    hypothesisId: payload.hypothesisId,
    location: payload.location,
    message: payload.message,
    data: payload.data ?? {},
    timestamp: Date.now(),
  };
  // #region agent log
  try {
    console.warn(
      `ROTEVO_DEBUG[${payload.hypothesisId}] ${payload.location} ${payload.message}`,
      JSON.stringify(payload.data ?? {})
    );
  } catch {
    /* ignore */
  }
  try {
    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": SESSION,
      },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
  // #endregion
}

export function installGlobalCrashProbes(): void {
  // #region agent log
  debugCrashProbe({
    hypothesisId: "H0",
    location: "debugCrashProbe.ts:install",
    message: "global_probes_install",
  });
  const ErrorUtilsRef = (globalThis as { ErrorUtils?: {
    getGlobalHandler?: () => ((e: unknown, isFatal?: boolean) => void) | undefined;
    setGlobalHandler?: (h: (e: unknown, isFatal?: boolean) => void) => void;
  } }).ErrorUtils;
  if (ErrorUtilsRef?.getGlobalHandler && ErrorUtilsRef?.setGlobalHandler) {
    const prev = ErrorUtilsRef.getGlobalHandler();
    ErrorUtilsRef.setGlobalHandler((error, isFatal) => {
      debugCrashProbe({
        hypothesisId: "H1",
        location: "debugCrashProbe.ts:ErrorUtils",
        message: "js_global_error",
        data: {
          isFatal: !!isFatal,
          name: error instanceof Error ? error.name : typeof error,
          msg: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
        },
      });
      prev?.(error, isFatal);
    });
  }
  try {
    const g = globalThis as { onunhandledrejection?: (e: unknown) => void };
    const prevRejection = g.onunhandledrejection;
    g.onunhandledrejection = (event: unknown) => {
      const reason =
        event && typeof event === "object" && "reason" in event
          ? (event as { reason: unknown }).reason
          : event;
      debugCrashProbe({
        hypothesisId: "H1",
        location: "debugCrashProbe.ts:unhandledrejection",
        message: "unhandled_rejection",
        data: {
          msg:
            reason instanceof Error
              ? reason.message.slice(0, 300)
              : String(reason).slice(0, 300),
        },
      });
      if (typeof prevRejection === "function") prevRejection(event);
    };
  } catch {
    /* ignore */
  }
  // #endregion
}
