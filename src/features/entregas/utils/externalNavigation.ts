import { Alert, Linking, Platform } from "react-native";
import { copyToClipboard } from "../../../utils/clipboard";
import type { EntregaListItem } from "../types";
import { formatStopAddress, type GroupedStop } from "./routeUtils";

export type NavigationApp = "google" | "waze" | "apple" | "copy";

export type NavigationTarget =
  | { mode: "coords"; latitude: number; longitude: number; precision: "saved" }
  | { mode: "coords"; latitude: number; longitude: number; precision: "geocoded" }
  | { mode: "address"; address: string };

export type GeocodedCoordsMap = Record<number, { latitude: number; longitude: number }>;

const APPROXIMATE_ADDRESS_ALERT =
  "Esta parada não possui coordenadas precisas. O mapa pode abrir um ponto aproximado.";

export function isValidNavigationCoords(
  latitude?: number | null,
  longitude?: number | null
): boolean {
  if (latitude == null || longitude == null) return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude === 0 && longitude === 0) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  return true;
}

export function resolveNavigationTarget(
  stop: EntregaListItem,
  geocodedCoords: GeocodedCoordsMap = {}
): NavigationTarget {
  if (isValidNavigationCoords(stop.latitude, stop.longitude)) {
    return {
      mode: "coords",
      latitude: stop.latitude!,
      longitude: stop.longitude!,
      precision: "saved",
    };
  }

  const geo = geocodedCoords[stop.id_saida];
  if (geo && isValidNavigationCoords(geo.latitude, geo.longitude)) {
    return {
      mode: "coords",
      latitude: geo.latitude,
      longitude: geo.longitude,
      precision: "geocoded",
    };
  }

  const address = formatStopAddress(stop);
  return { mode: "address", address: address === "—" ? "" : address };
}

export function resolveGroupNavigationTarget(
  group: GroupedStop,
  geocodedCoords: GeocodedCoordsMap = {}
): NavigationTarget {
  return resolveNavigationTarget(group.representativeDelivery, geocodedCoords);
}

export function getDestinationLabel(target: NavigationTarget): string {
  if (target.mode === "coords" && target.precision === "saved") {
    return "Destino: coordenadas salvas";
  }
  return "Destino: endereço aproximado";
}

export function getGoogleMapsNativeUrl(lat: number, lon: number): string {
  return `google.navigation:q=${lat},${lon}&mode=d`;
}

export function getGoogleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
}

export function getGoogleMapsAddressUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
}

export function getWazeNativeUrl(lat: number, lon: number): string {
  return `waze://?ll=${lat},${lon}&navigate=yes`;
}

export function getWazeUrl(lat: number, lon: number): string {
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
}

export function getWazeAddressUrl(address: string): string {
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

export function getAppleMapsCoordsUrl(lat: number, lon: number): string {
  return `http://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
}

export function getAppleMapsAddressUrl(address: string): string {
  return `http://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=d`;
}

/** @deprecated Use getAppleMapsCoordsUrl — nunca passa endereço quando há coords */
export function getAppleMapsUrl(lat: number, lon: number): string {
  return getAppleMapsCoordsUrl(lat, lon);
}

function buildNavigationUrls(
  app: NavigationApp,
  target: NavigationTarget
): { primary: string; fallback?: string } | null {
  if (app === "copy") return null;

  if (target.mode === "coords") {
    const { latitude: lat, longitude: lon } = target;
    switch (app) {
      case "google":
        return Platform.OS === "android"
          ? { primary: getGoogleMapsNativeUrl(lat, lon), fallback: getGoogleMapsUrl(lat, lon) }
          : { primary: getGoogleMapsUrl(lat, lon) };
      case "waze":
        return { primary: getWazeNativeUrl(lat, lon), fallback: getWazeUrl(lat, lon) };
      case "apple":
        return { primary: getAppleMapsCoordsUrl(lat, lon) };
    }
  }

  const address = target.address.trim();
  if (!address) return null;

  switch (app) {
    case "google":
      return { primary: getGoogleMapsAddressUrl(address) };
    case "waze":
      return { primary: getWazeAddressUrl(address) };
    case "apple":
      return { primary: getAppleMapsAddressUrl(address) };
  }
}

export async function openNavigationUrl(primary: string, fallback?: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(primary);
    if (canOpen) {
      await Linking.openURL(primary);
      return true;
    }
    if (fallback) {
      await Linking.openURL(fallback);
      return true;
    }
    await Linking.openURL(primary);
    return true;
  } catch {
    if (fallback) {
      try {
        await Linking.openURL(fallback);
        return true;
      } catch {
        Alert.alert("Atenção", "Não foi possível abrir o aplicativo de navegação.");
        return false;
      }
    }
    Alert.alert("Atenção", "Não foi possível abrir o aplicativo de navegação.");
    return false;
  }
}

function confirmApproximateNavigation(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert("Atenção", APPROXIMATE_ADDRESS_ALERT, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Continuar", onPress: () => resolve(true) },
    ]);
  });
}

export interface OpenNavigationOptions {
  geocodedCoords?: GeocodedCoordsMap;
  /** Pula confirmação para modo address (ex.: usuário já viu o aviso no sheet) */
  skipApproximateConfirm?: boolean;
}

export async function openNavigationToStop(
  stop: EntregaListItem,
  app: NavigationApp,
  options: OpenNavigationOptions = {}
): Promise<boolean> {
  const target = resolveNavigationTarget(stop, options.geocodedCoords ?? {});

  if (app === "copy") {
    const text =
      target.mode === "address" && target.address
        ? target.address
        : formatStopAddress(stop);
    if (!text || text === "—") {
      Alert.alert("Atenção", "Endereço indisponível para copiar.");
      return false;
    }
    const ok = await copyToClipboard(text);
    if (ok) Alert.alert("Copiado", "Endereço copiado para a área de transferência.");
    return ok;
  }

  if (target.mode === "address") {
    if (!target.address) {
      Alert.alert("Atenção", "Endereço indisponível para navegação.");
      return false;
    }
    if (!options.skipApproximateConfirm) {
      const confirmed = await confirmApproximateNavigation();
      if (!confirmed) return false;
    }
  } else if (target.precision === "geocoded" && !options.skipApproximateConfirm) {
    const confirmed = await confirmApproximateNavigation();
    if (!confirmed) return false;
  }

  const urls = buildNavigationUrls(app, target);
  if (!urls) {
    Alert.alert("Atenção", "Não foi possível montar o link de navegação.");
    return false;
  }

  return openNavigationUrl(urls.primary, urls.fallback);
}

/** @deprecated Use openNavigationToStop */
export async function openExternalNavigation(
  app: NavigationApp,
  coords: { latitude: number; longitude: number },
  _address?: string
): Promise<boolean> {
  const stop = {
    id_saida: 0,
    latitude: coords.latitude,
    longitude: coords.longitude,
  } as EntregaListItem;
  return openNavigationToStop(stop, app, { skipApproximateConfirm: true });
}

export function getNavigationOptions(): Array<{ id: NavigationApp; label: string }> {
  const options: Array<{ id: NavigationApp; label: string }> = [
    { id: "google", label: "Google Maps" },
    { id: "waze", label: "Waze" },
  ];
  if (Platform.OS === "ios") {
    options.push({ id: "apple", label: "Apple Maps" });
  }
  options.push({ id: "copy", label: "Copiar endereço" });
  return options;
}
