/**
 * Idempotency-Key por gesto de otimização.
 * UUID único no início; retries reutilizam; novo UUID só após finalizar/abandonar.
 */
let inFlightKey: string | null = null;
let inFlightCount = 0;
let recovery: { key: string; fingerprint: string } | null = null;

function randomUuid(): string {
  // RN / Expo: crypto.randomUUID pode existir; fallback simples
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `opt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Inicia gesto: retorna key a reutilizar em retries enquanto in-flight. */
export function beginOptimizeIdempotencyKey(fingerprint?: string): string {
  if (fingerprint && recovery?.fingerprint === fingerprint) {
    inFlightKey = recovery.key;
    inFlightCount = Math.max(inFlightCount, 1);
    return inFlightKey;
  }
  if (
    fingerprint &&
    recovery &&
    recovery.fingerprint !== fingerprint &&
    inFlightCount > 0
  ) {
    recovery = null;
    inFlightKey = randomUuid();
    return inFlightKey;
  }
  if (inFlightKey && inFlightCount > 0) return inFlightKey;
  if (!fingerprint && recovery) {
    inFlightKey = recovery.key;
    inFlightCount = 1;
    return inFlightKey;
  }
  inFlightKey = randomUuid();
  inFlightCount = 1;
  return inFlightKey;
}

/** Guarda a chave quando a resposta da otimização se perde, para o retry idempotente. */
export function keepOptimizeRecovery(fingerprint: string): void {
  if (!inFlightKey || !fingerprint) return;
  recovery = { key: inFlightKey, fingerprint };
}

export function clearOptimizeRecovery(): void {
  recovery = null;
}

export function isOptimizeInFlight(): boolean {
  return inFlightCount > 0;
}

/** Encerra gesto (sucesso, falha definitiva ou abandono). */
export function endOptimizeIdempotencyKey(): void {
  inFlightCount = Math.max(0, inFlightCount - 1);
  if (inFlightCount === 0) inFlightKey = null;
}

/** Força abandono (ex.: usuário cancela e quer nova tentativa deliberada). */
export function abandonOptimizeIdempotencyKey(): void {
  inFlightCount = 0;
  inFlightKey = null;
}

export function getCurrentOptimizeIdempotencyKey(): string | null {
  return inFlightKey;
}
