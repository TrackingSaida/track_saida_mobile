/** Detecta rejeição do Android ao iniciar FGS com o app ainda em background. */
export function isForegroundServiceBackgroundError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? "");
  const lower = msg.toLowerCase();
  return (
    lower.includes("couldn't start the foreground service") ||
    lower.includes("foreground service cannot be started") ||
    lower.includes("application is in the background")
  );
}
