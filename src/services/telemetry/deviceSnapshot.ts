import Constants from "expo-constants";
import { Platform } from "react-native";

export type DeviceTelemetryFields = {
  app_version: string | null;
  platform: string;
  device_brand: string | null;
  device_manufacturer: string | null;
  device_model: string | null;
  os_name: string | null;
  os_version: string | null;
  android_api_level: number | null;
  device_total_memory_mb: number | null;
  cpu_arch: string | null;
  is_device: boolean | null;
};

let cached: DeviceTelemetryFields | null = null;

export function getAppVersionForTelemetry(): string | null {
  const configured = Constants.expoConfig?.version;
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  const native = Constants.nativeAppVersion;
  if (typeof native === "string" && native.trim()) return native.trim();
  return null;
}

type ExpoDeviceModule = {
  brand?: string | null;
  manufacturer?: string | null;
  modelName?: string | null;
  modelId?: string | null;
  osName?: string | null;
  osVersion?: string | null;
  platformApiLevel?: number | null;
  totalMemory?: number | null;
  supportedCpuArchitectures?: string[] | null;
  isDevice?: boolean | null;
};

type AndroidPlatformConstants = {
  Brand?: string;
  Manufacturer?: string;
  Model?: string;
  Release?: string;
  Version?: number;
  uiMode?: string;
};

async function loadExpoDevice(): Promise<ExpoDeviceModule | null> {
  try {
    return (await import("expo-device")) as ExpoDeviceModule;
  } catch {
    return null;
  }
}

function fromPlatformConstants(): Partial<DeviceTelemetryFields> {
  const constants = (Platform.constants || {}) as AndroidPlatformConstants;
  if (Platform.OS !== "android") {
    return {
      os_name: Platform.OS,
      os_version: Platform.Version != null ? String(Platform.Version) : null,
    };
  }
  return {
    device_brand: constants.Brand || null,
    device_manufacturer: constants.Manufacturer || null,
    device_model: constants.Model || null,
    os_name: "Android",
    os_version: constants.Release || (Platform.Version != null ? String(Platform.Version) : null),
    android_api_level:
      typeof constants.Version === "number"
        ? constants.Version
        : typeof Platform.Version === "number"
          ? Platform.Version
          : null,
  };
}

export async function getDeviceTelemetrySnapshot(): Promise<DeviceTelemetryFields> {
  if (cached) return cached;
  const Device = await loadExpoDevice();
  const platformFallback = fromPlatformConstants();
  const totalMemory = Device?.totalMemory;
  const archList = Device?.supportedCpuArchitectures;

  cached = {
    app_version: getAppVersionForTelemetry(),
    platform: Platform.OS,
    device_brand: Device?.brand ?? platformFallback.device_brand ?? null,
    device_manufacturer:
      Device?.manufacturer ?? platformFallback.device_manufacturer ?? null,
    device_model:
      Device?.modelName ||
      Device?.modelId ||
      platformFallback.device_model ||
      null,
    os_name: Device?.osName ?? platformFallback.os_name ?? Platform.OS,
    os_version:
      Device?.osVersion ??
      platformFallback.os_version ??
      (Platform.Version != null ? String(Platform.Version) : null),
    android_api_level:
      Platform.OS === "android" && typeof Device?.platformApiLevel === "number"
        ? Device.platformApiLevel
        : platformFallback.android_api_level ?? null,
    device_total_memory_mb:
      typeof totalMemory === "number" && totalMemory > 0
        ? Math.round(totalMemory / (1024 * 1024))
        : null,
    cpu_arch: Array.isArray(archList) && archList.length ? archList.slice(0, 3).join(",") : null,
    is_device: typeof Device?.isDevice === "boolean" ? Device.isDevice : null,
  };
  return cached;
}
