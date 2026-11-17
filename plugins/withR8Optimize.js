/**
 * Expo config plugin — R8 optimization for release builds.
 * Troca proguard-android.txt (inclui -dontoptimize) por
 * proguard-android-optimize.txt no app/build.gradle.
 */
const {
  withAppBuildGradle,
  createRunOncePlugin,
} = require("@expo/config-plugins");

const PKG = "withR8Optimize";
const FROM = 'getDefaultProguardFile("proguard-android.txt")';
const TO = 'getDefaultProguardFile("proguard-android-optimize.txt")';

function withR8Optimize(config) {
  return withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    const fromCount = contents.split(FROM).length - 1;
    const toCount = contents.split(TO).length - 1;

    // Prebuild com reuse: o arquivo já está otimizado.
    if (fromCount === 0 && toCount === 1) {
      return config;
    }

    if (fromCount !== 1) {
      throw new Error(
        `${PKG}: expected exactly one occurrence of ${FROM}, found ${fromCount}`
      );
    }

    config.modResults.contents = contents.replace(FROM, TO);
    return config;
  });
}

module.exports = createRunOncePlugin(withR8Optimize, PKG, "1.0.0");
