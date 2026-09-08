/**
 * Gate de divulgação destacada antes de qualquer request runtime de localização
 * no fluxo de BACKGROUND_LOCATION (Play Store — declaração em destaque).
 *
 * O host React (BackgroundLocationDisclosureModal) registra o handler.
 * Não persiste aceite: em instalação limpa ou sem permissões, a UI sempre aparece.
 */

export type BackgroundLocationDisclosureDecision = "continue" | "dismissed";

type DisclosureHandler = () => Promise<BackgroundLocationDisclosureDecision>;

let handler: DisclosureHandler | null = null;

/** Login/restore pode correr antes do primeiro paint do modal autenticado. */
const HANDLER_WAIT_MS = 3000;
const HANDLER_POLL_MS = 50;

export function registerBackgroundLocationDisclosureHandler(
  next: DisclosureHandler | null
): void {
  handler = next;
}

async function waitForHandler(): Promise<DisclosureHandler | null> {
  if (handler) return handler;
  const deadline = Date.now() + HANDLER_WAIT_MS;
  while (!handler && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, HANDLER_POLL_MS));
  }
  return handler;
}

export async function requestBackgroundLocationDisclosure(): Promise<BackgroundLocationDisclosureDecision> {
  const active = await waitForHandler();
  if (!active) {
    // Sem UI montada: nunca solicitar permissões silenciosamente.
    return "dismissed";
  }
  return active();
}
