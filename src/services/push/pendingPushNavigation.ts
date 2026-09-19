/** Fila de 1 tap de push até a navegação/sessão estarem prontas. */

let pending: Record<string, unknown> | null = null;

export function enqueuePendingPush(data: Record<string, unknown>): void {
  pending = data;
}

export function consumePendingPush(): Record<string, unknown> | null {
  const data = pending;
  pending = null;
  return data;
}
