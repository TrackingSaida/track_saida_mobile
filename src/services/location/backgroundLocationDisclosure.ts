/**
 * Gate de divulgação destacada antes de pedir ACCESS_BACKGROUND_LOCATION.
 * O host React (BackgroundLocationDisclosureModal) registra o handler.
 */

export type BackgroundLocationDisclosureDecision = "continue" | "dismissed";

type DisclosureHandler = () => Promise<BackgroundLocationDisclosureDecision>;

let handler: DisclosureHandler | null = null;

export function registerBackgroundLocationDisclosureHandler(
  next: DisclosureHandler | null
): void {
  handler = next;
}

export async function requestBackgroundLocationDisclosure(): Promise<BackgroundLocationDisclosureDecision> {
  if (!handler) {
    // Sem UI montada: não solicitar BG silenciosamente.
    return "dismissed";
  }
  return handler();
}
