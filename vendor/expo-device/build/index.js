'use strict';

let Platform = { OS: 'unknown', Version: null, constants: {} };
try {
  Platform = require('react-native').Platform;
} catch (_) {
  /* node/tests */
}

const constants = Platform.constants || {};
const brand =
  constants.Brand ||
  (Platform.OS === 'android' ? 'Android' : Platform.OS === 'ios' ? 'Apple' : Platform.OS) ||
  null;
const osVersion =
  constants.Release || (Platform.Version != null ? String(Platform.Version) : null);

module.exports = {
  brand,
  manufacturer: constants.Manufacturer || brand,
  modelName: constants.Model || null,
  modelId: null,
  osName: Platform.OS === 'android' ? 'Android' : Platform.OS,
  osVersion,
  platformApiLevel:
    typeof constants.Version === 'number'
      ? constants.Version
      : Platform.OS === 'android' && typeof Platform.Version === 'number'
        ? Platform.Version
        : null,
  totalMemory: null,
  supportedCpuArchitectures: null,
  isDevice: true,
};
