import * as Location from "expo-location";
import { requestBackgroundLocationDisclosure } from "./backgroundLocationDisclosure";

export const LOCATION_TASK_NAME = "background-location-task";

async function ensureLocationUpdatesStarted(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (hasStarted) {
    return;
  }

  // FGS type location (expo-location) — não usa dataSync/mediaProcessing do Android 15.
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 10,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "Rota ativa",
      notificationBody: "App em uso durante a rota.",
    },
  });
}

/**
 * Inicia tracking de rota ativa com ordem exigida pela Play Store:
 * declaração em destaque → foreground → background → startLocationUpdatesAsync.
 *
 * Não solicita nenhuma permissão runtime antes da declaração.
 * Se o usuário recusar a declaração ou qualquer permissão, a rota segue sem tracking.
 */
export async function startBackgroundTracking(): Promise<void> {
  const { status: existingFg } = await Location.getForegroundPermissionsAsync();
  const { status: existingBg } = await Location.getBackgroundPermissionsAsync();

  // Cenário 5: permissões já concedidas — não reexibir declaração.
  if (existingFg === "granted" && existingBg === "granted") {
    await ensureLocationUpdatesStarted();
    return;
  }

  // Play Store: declaração em destaque ANTES de qualquer request* de localização.
  const decision = await requestBackgroundLocationDisclosure();
  if (decision !== "continue") {
    return;
  }

  if (existingFg !== "granted") {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== "granted") {
      return;
    }
  }

  if (existingBg !== "granted") {
    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== "granted") {
      return;
    }
  }

  await ensureLocationUpdatesStarted();
}

export async function stopBackgroundTracking(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!hasStarted) {
    return;
  }
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
