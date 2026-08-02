/**
 * URL pública da Política de Privacidade (HTTPS).
 * Definir via EXPO_PUBLIC_PRIVACY_POLICY_URL no EAS / .env local.
 * Sem a variável, o app não quebra — a tela de Privacidade orienta o usuário.
 */
export const PRIVACY_POLICY_URL = (
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || ""
).trim();

export function hasPrivacyPolicyUrl(): boolean {
  return /^https:\/\//i.test(PRIVACY_POLICY_URL);
}
