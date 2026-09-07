import * as Location from "expo-location";
import { requestBackgroundLocationDisclosure } from "./backgroundLocationDisclosure";

export const LOCATION_TASK_NAME = "background-location-task";

export async function startBackgroundTracking(): Promise<void> {
  const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
  if (fgStatus !== "granted") {
    throw new Error("Permissão de localização em primeiro plano negada.");
  }

  const { status: existingBg } = await Location.getBackgroundPermissionsAsync();
  if (existingBg !== "granted") {
    // Play Store: declaração em destaque antes do diálogo de BACKGROUND_LOCATION.
    const decision = await requestBackgroundLocationDisclosure();
    if (decision !== "continue") {
      // Usuário recusou a declaração — rota segue sem tracking em segundo plano.
      return;
    }

    const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
    if (bgStatus !== "granted") {
      // Sem BG: não inicia updates; evita quebrar início/restauração da rota.
      return;
    }
  }

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

export async function stopBackgroundTracking(): Promise<void> {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
  if (!hasStarted) {
    return;
  }
  await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}
