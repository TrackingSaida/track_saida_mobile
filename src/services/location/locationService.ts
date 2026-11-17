import { AppState } from "react-native";
import * as Location from "expo-location";
import {
  isBackgroundLocationDisclosureReady,
  requestBackgroundLocationDisclosure,
} from "./backgroundLocationDisclosure";
import { isForegroundServiceBackgroundError } from "./foregroundServiceError";

export { isForegroundServiceBackgroundError } from "./foregroundServiceError";

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

/** Resultado do start: ok, ou adiado quando o Android ainda vê o app em background. */
export type StartBackgroundLocationResult =
  | { ok: true }
  | { ok: false; deferred: true };

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

export type RouteTrackingProfile = "route" | "photo";

const ROUTE_TRACKING_OPTIONS = {
  route: {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
  },
  photo: {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000,
    distanceInterval: 25,
  },
} as const;

const FOREGROUND_SERVICE = {
  notificationTitle: "ROTEVO — Rota ativa",
  notificationBody: "Localização sendo utilizada para acompanhar sua rota.",
} as const;

let activeTrackingProfile: RouteTrackingProfile = "route";

/**
 * Inicia updates em segundo plano. Requer permissões já concedidas.
 * Se o app ainda não está em primeiro plano (Android FGS), devolve deferred sem lançar.
 */
export async function startBackgroundLocationUpdates(): Promise<StartBackgroundLocationResult> {
  if (!(await areBackgroundLocationPermissionsGranted())) {
    throw new Error("Permissões de localização não concedidas para acompanhar a rota.");
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    return { ok: true };
  }

  if (AppState.currentState !== "active") {
    return { ok: false, deferred: true };
  }

  try {
    const opts = ROUTE_TRACKING_OPTIONS.route;
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: opts.accuracy,
      timeInterval: opts.timeInterval,
      distanceInterval: opts.distanceInterval,
      showsBackgroundLocationIndicator: true,
      foregroundService: { ...FOREGROUND_SERVICE },
    });
    activeTrackingProfile = "route";
    return { ok: true };
  } catch (error) {
    if (isForegroundServiceBackgroundError(error)) {
      return { ok: false, deferred: true };
    }
    throw error;
  }
}

/**
 * Durante a câmera do comprovante, alivia GPS; ao fechar, restaura o perfil da rota.
 * No-op se a task não estiver rodando. Erros de stop/start são engolidos.
 */
export async function setRouteTrackingProfile(profile: RouteTrackingProfile): Promise<void> {
  if (activeTrackingProfile === profile) return;
  try {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (!hasStarted) {
      activeTrackingProfile = profile;
      return;
    }
    if (AppState.currentState !== "active") {
      return;
    }
    const opts = ROUTE_TRACKING_OPTIONS[profile];
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: opts.accuracy,
      timeInterval: opts.timeInterval,
      distanceInterval: opts.distanceInterval,
      showsBackgroundLocationIndicator: true,
      foregroundService: { ...FOREGROUND_SERVICE },
    });
    activeTrackingProfile = profile;
  } catch (e) {
    console.warn("[location] setRouteTrackingProfile falhou", profile, e);
  }
}

/**
 * Consentimento + permissões + start updates (ação explícita do usuário).
 * Se o start for adiado (app em background), ainda devolve ok:true nas permissões
 * e o caller deve marcar needsResume / tentar de novo no foreground.
 */
export async function prepareAndStartBackgroundTracking(): Promise<
  BackgroundLocationPermissionResult & { trackingDeferred?: boolean }
> {
  const perm = await ensureBackgroundLocationPermission();
  if (!perm.ok) return perm;
  const started = await startBackgroundLocationUpdates();
  if (!started.ok) {
    return { ok: true, trackingDeferred: true };
  }
  return { ok: true };
}

export async function stopBackgroundTracking(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!hasStarted) {
    activeTrackingProfile = "route";
    return;
  }
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  activeTrackingProfile = "route";
}
