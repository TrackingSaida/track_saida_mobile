/**
 * Configuração dinâmica do Expo.
 *
 * Google Maps (Android):
 * - Preferir GOOGLE_MAPS_ANDROID_API_KEY no EAS (preview/production/development)
 * - Fallback: android.config.googleMaps.apiKey do app.json (se existir)
 * - Local: export GOOGLE_MAPS_ANDROID_API_KEY="sua_chave"
 *
 * Política de Privacidade (opcional):
 * - EXPO_PUBLIC_PRIVACY_POLICY_URL=https://...
 *
 * O parâmetro `config` já traz os valores do app.json — não duplicar via require.
 */
module.exports = ({ config }) => {
  const next = {
    ...config,
    android: { ...(config.android || {}) },
    extra: { ...(config.extra || {}) },
  };

  const apiKey = (
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    next.android?.config?.googleMaps?.apiKey ||
    ""
  ).trim();

  next.android.config = {
    ...(next.android.config || {}),
    googleMaps: {
      ...((next.android.config && next.android.config.googleMaps) || {}),
      apiKey,
    },
  };

  next.extra.privacyPolicyUrl = (
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || ""
  ).trim();

  const isEasBuild = process.env.EAS_BUILD === "true";
  if (isEasBuild && !apiKey) {
    console.warn(
      "[app.config] GOOGLE_MAPS_ANDROID_API_KEY ausente neste build EAS. " +
        "O mapa Android fica em branco. Configure a variável no ambiente do perfil (ex.: preview)."
    );
  }

  return next;
};
