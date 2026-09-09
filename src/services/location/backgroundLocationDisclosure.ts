/**
 * Gate de divulgação destacada antes de qualquer request runtime de localização
 * no fluxo de BACKGROUND_LOCATION (Play Store — declaração em destaque).
 *
 * O host React (BackgroundLocationDisclosureModal) registra o handler na árvore autenticada.
 * Não persiste aceite: em instalação limpa ou sem permissões, a UI sempre aparece.
 *
 * Determinístico: sem polling/timeout. Se o host não estiver registrado, falha seguro
 * (nunca solicita permissão silenciosamente).
 */

export type BackgroundLocationDisclosureDecision = "continue" | "dismissed";

type DisclosureHandler = () => Promise<BackgroundLocationDisclosureDecision>;

let handler: DisclosureHandler | null = null;

export function isBackgroundLocationDisclosureReady(): boolean {
  return handler != null;
}

export function registerBackgroundLocationDisclosureHandler(
  next: DisclosureHandler | null
): void {
  handler = next;
}

export async function requestBackgroundLocationDisclosure(): Promise<BackgroundLocationDisclosureDecision> {
  if (!handler) {
    return "dismissed";
  }
  return handler();
}
