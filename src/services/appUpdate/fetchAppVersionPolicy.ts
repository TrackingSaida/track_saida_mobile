import axios from "axios";
import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
import { API_BASE_URL } from "../../config/api";
import type { AppVersionPolicy } from "./versionPolicy";

export const PLAY_STORE_PACKAGE = "br.com.trackingsaidas.mobile";
export const PLAY_STORE_WEB_URL = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;

export function installedAppVersion(): string {
  const nativeVersion = Constants.nativeAppVersion;
  if (typeof nativeVersion === "string" && nativeVersion.trim()) return nativeVersion.trim();
  const configured = Constants.expoConfig?.version;
  if (typeof configured === "string" && configured.trim()) return configured.trim();
  return "";
}

/** Expo Go não é o binário da Play Store. */
export function shouldEnforceAppUpdate(): boolean {
  return Constants.executionEnvironment !== "storeClient";
}

export async function fetchAppVersionPolicy(): Promise<AppVersionPolicy | null> {
  try {
    const { data } = await axios.get(`${API_BASE_URL}/mobile/app-version`, {
      timeout: 8000,
      headers: { Accept: "application/json", "Cache-Control": "no-cache" },
    });
    if (!data || typeof data !== "object") return null;
    const minVersion = typeof data.min_version === "string" ? data.min_version.trim() : "";
    if (!minVersion) return null;
    const byRoleRaw = data.min_version_by_role;
    const minVersionByRole: Record<string, string> = {};
    if (byRoleRaw && typeof byRoleRaw === "object") {
      for (const [key, value] of Object.entries(byRoleRaw as Record<string, unknown>)) {
        if (typeof value === "string" && value.trim()) minVersionByRole[key] = value.trim();
      }
    }
    const storeUrl = typeof data.store_url === "string" ? data.store_url.trim() : "";
    const message = typeof data.message === "string" ? data.message.trim() : "";
    return {
      minVersion,
      minVersionByRole,
      storeUrl: storeUrl || PLAY_STORE_WEB_URL,
      message:
        message ||
        "Há uma nova versão do ROTEVO. Atualize para continuar usando o aplicativo.",
    };
  } catch {
    return null;
  }
}

export async function openPlayStore(storeUrl?: string): Promise<void> {
  const web = (storeUrl || "").trim() || PLAY_STORE_WEB_URL;
  if (Platform.OS === "android") {
    try {
      await Linking.openURL(`market://details?id=${PLAY_STORE_PACKAGE}`);
      return;
    } catch {
      /* abre o link https */
    }
  }
  await Linking.openURL(web);
}
