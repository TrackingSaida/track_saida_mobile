/**
 * Expo config plugin — Play Store large-screen / orientation compat.
 * - Remove screenOrientation do MainActivity (reforço além de orientation: default).
 * - Remove screenOrientation da activity ML Kit GmsBarcodeScanningDelegateActivity
 *   (aviso Play Console em dependência transitiva).
 */
const {
  withAndroidManifest,
  createRunOncePlugin,
} = require("@expo/config-plugins");

const PKG = "withPlayLargeScreenCompat";

function stripScreenOrientation(activity) {
  if (!activity || !activity.$) return;
  if ("android:screenOrientation" in activity.$) {
    delete activity.$["android:screenOrientation"];
  }
}

function withPlayLargeScreenCompat(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;
    const app = manifest.manifest?.application?.[0];
    if (!app) return config;

    const activities = app.activity ?? [];
    for (const activity of activities) {
      const name = activity.$?.["android:name"] ?? "";
      if (
        name === ".MainActivity" ||
        name.endsWith(".MainActivity") ||
        name.includes("GmsBarcodeScanningDelegateActivity")
      ) {
        stripScreenOrientation(activity);
      }
    }

    // Activity pode vir só no merge de libs — declarar override sem orientation.
    const existing = activities.find((a) =>
      String(a.$?.["android:name"] ?? "").includes("GmsBarcodeScanningDelegateActivity")
    );
    if (!existing) {
      app.activity = app.activity ?? [];
      app.activity.push({
        $: {
          "android:name":
            "com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity",
          "tools:node": "merge",
        },
      });
      // tools namespace
      if (!manifest.manifest.$) manifest.manifest.$ = {};
      if (!manifest.manifest.$["xmlns:tools"]) {
        manifest.manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
      }
      // Remover orientation se a lib declarar PORTRAIT
      const injected = app.activity[app.activity.length - 1];
      injected.$["tools:remove"] = "android:screenOrientation";
    } else {
      stripScreenOrientation(existing);
      existing.$["tools:remove"] = "android:screenOrientation";
    }

    // MainActivity: strip orientation attribute
    for (const activity of app.activity ?? []) {
      const name = activity.$?.["android:name"] ?? "";
      if (name === ".MainActivity" || name.endsWith(".MainActivity")) {
        stripScreenOrientation(activity);
      }
    }

    return config;
  });
}

module.exports = createRunOncePlugin(withPlayLargeScreenCompat, PKG, "1.0.0");
