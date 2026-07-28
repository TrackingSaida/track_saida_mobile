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
 */
const appJson = require("./app.json");

module.exports = () => {
  const config = { ...appJson.expo };
  const apiKey = (
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    config.android?.config?.googleMaps?.apiKey ||
    ""
  ).trim();

  if (!config.android) config.android = {};
  if (!config.android.config) config.android.config = {};
  if (!config.android.config.googleMaps) config.android.config.googleMaps = {};
  config.android.config.googleMaps.apiKey = apiKey;

  if (!config.extra) config.extra = {};
  config.extra.privacyPolicyUrl = (
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || ""
  ).trim();

  const isEasBuild = process.env.EAS_BUILD === "true";
  if (isEasBuild && !apiKey) {
    console.warn(
      "[app.config] GOOGLE_MAPS_ANDROID_API_KEY ausente neste build EAS. " +
        "O mapa Android fica em branco. Configure a variável no ambiente do perfil (ex.: preview)."
    );
  }

  return config;
};
