/**
 * Configuração dinâmica do Expo.
 * Permite usar GOOGLE_MAPS_ANDROID_API_KEY como variável de ambiente no EAS Build
 * (evita commitar a chave no app.json).
 */
const appJson = require("./app.json");

module.exports = () => {
  const config = { ...appJson.expo };
  const apiKey =
    process.env.GOOGLE_MAPS_ANDROID_API_KEY ||
    config.android?.config?.googleMaps?.apiKey ||
    "";
  if (!config.android) config.android = {};
  if (!config.android.config) config.android.config = {};
  if (!config.android.config.googleMaps) config.android.config.googleMaps = {};
  config.android.config.googleMaps.apiKey = apiKey;
  return config;
};
