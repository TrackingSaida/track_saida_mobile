import * as Location from "expo-location";
import {
  isBackgroundLocationDisclosureReady,
  requestBackgroundLocationDisclosure,
} from "./backgroundLocationDisclosure";

export const LOCATION_TASK_NAME = "background-location-task";

export const ROUTE_LOCATION_REQUIRED_MESSAGE =
  "Para iniciar uma rota, é necessário permitir o uso de localização durante a execução das entregas.";

export type BackgroundLocationPermissionReason =
  | "disclosure_declined"
  | "foreground_denied"
  | "background_denied"
  | "disclosure_unavailable";

export type BackgroundLocationPermissionResult =
  | { ok: true }
  | { ok: false; reason: BackgroundLocationPermissionReason };

export async function areBackgroundLocationPermissionsGranted(): Promise<boolean> {
  const { status: fg } = await Location.getForegroundPermissionsAsync();
  const { status: bg } = await Location.getBackgroundPermissionsAsync();
  return fg === "granted" && bg === "granted";
}

/**
 * Garante FG+BG para acompanhamento de rota ativa.
 * Ordem Play Store: declaração em destaque → foreground → background.
 * Não inicia location updates.
 */
export async function ensureBackgroundLocationPermission(): Promise<BackgroundLocationPermissionResult> {
  if (await areBackgroundLocationPermissionsGranted()) {
    return { ok: true };
  }

  if (!isBackgroundLocationDisclosureReady()) {
    return { ok: false, reason: "disclosure_unavailable" };
  }

  const decision = await requestBackgroundLocationDisclosure();
  if (decision !== "continue") {
    return { ok: false, reason: "disclosure_declined" };
  }

  const { status: existingFg } = await Location.getForegroundPermissionsAsync();
  if (existingFg !== "granted") {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") {
      return { ok: false, reason: "foreground_denied" };
    }
  }

  const { status: existingBg } = await Location.getBackgroundPermissionsAsync();
  if (existingBg !== "granted") {
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== "granted") {
      return { ok: false, reason: "background_denied" };
    }
  }

  return { ok: true };
}

/**
 * Inicia updates em segundo plano. Requer permissões já concedidas.
 */
export async function startBackgroundLocationUpdates(): Promise<void> {
  if (!(await areBackgroundLocationPermissionsGranted())) {
    throw new Error("Permissões de localização não concedidas para acompanhar a rota.");
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    return;
  }

  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "ROTEVO — Rota ativa",
      notificationBody: "Localização sendo utilizada para acompanhar sua rota.",
    },
  });
}

/**
 * Consentimento + permissões + start updates (ação explícita do usuário).
 */
export async function prepareAndStartBackgroundTracking(): Promise<BackgroundLocationPermissionResult> {
  const perm = await ensureBackgroundLocationPermission();
  if (!perm.ok) return perm;
  await startBackgroundLocationUpdates();
  return { ok: true };
}

export async function stopBackgroundTracking(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!hasStarted) {
    return;
  }
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
