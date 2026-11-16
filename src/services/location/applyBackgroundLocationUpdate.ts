import type * as Location from "expo-location";

type LocationTaskPayload = {
  locations?: Location.LocationObject[];
};

type CurrentLocation = {
  latitude: number;
  longitude: number;
  heading?: number;
};

/**
 * Aplica a atualização de GPS da task em background.
 * Erros do store não devem derrubar o processo.
 */
export function applyBackgroundLocationUpdate(
  data: unknown,
  error: unknown,
  setCurrentLocation: (location: CurrentLocation | null) => void
): void {
  try {
    if (error) {
      return;
    }
    const locationData = data as LocationTaskPayload | undefined;
    const locations = locationData?.locations;
    if (!locations || locations.length === 0) {
      return;
    }

    const first = locations[0];
    if (!first?.coords) {
      return;
    }

    const { latitude, longitude, heading } = first.coords;
    if (latitude == null || longitude == null) {
      return;
    }

    setCurrentLocation({
      latitude,
      longitude,
      heading: typeof heading === "number" && !Number.isNaN(heading) ? heading : undefined,
    });
  } catch {
    // Falha ao gravar a posição não pode virar JavascriptException fatal.
  }
}
