import * as SecureStore from "expo-secure-store";
import type { PrepOrdemModo, ServicoTipo } from "../features/entregas/utils/servico";
import type { RoutePriority } from "../features/entregas/utils/routePriority";
import { ROUTE_PRIORITY_NONE } from "../features/entregas/utils/routePriority";
import type { JwtClaims } from "../utils/jwt";
import type { ThemeMode } from "../store/themeStore";

const THEME_KEY = "app_theme";
const BIOMETRIC_ENABLED_KEY = "biometric_enabled";
const MOTOBOT_PREFS_PREFIX = "motoboy_prefs_";
const MOTOBOT_PREFS_LEGACY_PREFIX = "motoboy_prefs:";

export const SETTINGS_DEFAULTS = {
  theme: "light" as ThemeMode,
  biometricEnabled: false,
  somenteHojePendentes: true,
  roteirizacaoHabilitada: false,
  prepOrdemModo: "servico" as PrepOrdemModo,
  prepServicoInicio: "Shopee" as ServicoTipo,
  cidadePadrao: "",
  estadoPadrao: "SP",
  routePriority: ROUTE_PRIORITY_NONE as RoutePriority,
};

export type StoredMotoboyPrefs = {
  somenteHojePendentes?: boolean;
  roteirizacaoHabilitada?: boolean;
  prepOrdemModo?: PrepOrdemModo;
  prepServicoInicio?: ServicoTipo;
  cidadePadrao?: string;
  estadoPadrao?: string;
  routePriority?: RoutePriority;
};

function sanitizePrefsSuffix(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function buildMotoboyPrefsKey(claims: JwtClaims | null | undefined): string | null {
  if (!claims) return null;
  const motoboyId = claims.motoboy_id != null ? String(claims.motoboy_id) : "";
  const username = (claims.username as string | undefined) || "";
  const sub = typeof claims.sub === "string" ? claims.sub : "";
  const suffix = sanitizePrefsSuffix(motoboyId || username || sub);
  if (!suffix) return null;
  return `${MOTOBOT_PREFS_PREFIX}${suffix}`;
}

function legacyMotoboyPrefsKey(userKey: string): string | null {
  if (!userKey.startsWith(MOTOBOT_PREFS_PREFIX)) return null;
  const suffix = userKey.slice(MOTOBOT_PREFS_PREFIX.length);
  if (!suffix) return null;
  return `${MOTOBOT_PREFS_LEGACY_PREFIX}${suffix}`;
}

export async function getTheme(): Promise<ThemeMode> {
  const stored = await SecureStore.getItemAsync(THEME_KEY);
  return stored === "dark" ? "dark" : SETTINGS_DEFAULTS.theme;
}

export async function setTheme(theme: ThemeMode): Promise<void> {
  await SecureStore.setItemAsync(THEME_KEY, theme);
}

export async function getBiometricEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY)) === "true";
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
  } else {
    await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  }
}

export async function getMotoboyPrefs(userKey: string | null): Promise<StoredMotoboyPrefs | null> {
  if (!userKey) return null;
  let raw = await SecureStore.getItemAsync(userKey);
  if (!raw) {
    const legacyKey = legacyMotoboyPrefsKey(userKey);
    if (legacyKey) {
      raw = await SecureStore.getItemAsync(legacyKey);
      if (raw) {
        await SecureStore.setItemAsync(userKey, raw);
        await SecureStore.deleteItemAsync(legacyKey).catch(() => undefined);
      }
    }
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredMotoboyPrefs;
  } catch {
    return null;
  }
}

export async function setMotoboyPrefs(
  userKey: string | null,
  prefs: StoredMotoboyPrefs
): Promise<void> {
  if (!userKey) {
    throw new Error("Não foi possível identificar o usuário para salvar as configurações.");
  }
  await SecureStore.setItemAsync(userKey, JSON.stringify(prefs));
}
