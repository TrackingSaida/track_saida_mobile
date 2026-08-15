/**
 * Idempotency-Key por gesto de otimização.
 * UUID único no início; retries reutilizam; novo UUID só após finalizar/abandonar.
 */
let inFlightKey: string | null = null;
let inFlightCount = 0;

function randomUuid(): string {
  // RN / Expo: crypto.randomUUID pode existir; fallback simples
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c?.randomUUID) return c.randomUUID();
  return `opt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Inicia gesto: retorna key a reutilizar em retries enquanto in-flight. */
export function beginOptimizeIdempotencyKey(): string {
  if (inFlightKey && inFlightCount > 0) return inFlightKey;
  inFlightKey = randomUuid();
  inFlightCount = 1;
  return inFlightKey;
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
