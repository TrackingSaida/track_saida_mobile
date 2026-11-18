/**
 * Expo config plugin — marca android.hardware.wifi como opcional.
 * ACCESS_WIFI_STATE (NetInfo) faz a Play inferir wifi obrigatório;
 * required=false amplia disponibilidade sem remover a permissão.
 */
const {
  withAndroidManifest,
  createRunOncePlugin,
} = require("@expo/config-plugins");

const PKG = "withOptionalWifiFeature";
const FEATURE_NAME = "android.hardware.wifi";

function withOptionalWifiFeature(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    if (!manifest) return config;

    const features = manifest["uses-feature"] ?? [];
    const existing = features.find(
      (f) => f?.$?.["android:name"] === FEATURE_NAME
    );

    if (existing) {
      existing.$ = existing.$ ?? {};
      existing.$["android:required"] = "false";
    } else {
      features.push({
        $: {
          "android:name": FEATURE_NAME,
          "android:required": "false",
        },
      });
      manifest["uses-feature"] = features;
    }

    return config;
  });
}

module.exports = createRunOncePlugin(withOptionalWifiFeature, PKG, "1.0.0");
