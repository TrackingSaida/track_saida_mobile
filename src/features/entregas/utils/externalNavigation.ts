import { Alert, Linking, Platform } from "react-native";
import { copyToClipboard } from "../../../utils/clipboard";
import type { EntregaListItem } from "../types";
import {
  resolveDeliveryDestination,
  resolveGroupDestination,
  REVIEW_MESSAGE_INSUFFICIENT,
  type DeliveryResolvedDestination,
  type GeocodedCoordsMap,
  type GeocodedMetaMap,
  type LegacyValidationCache,
} from "./deliveryDestination";
import type { GroupedStop } from "./routeUtils";

export type NavigationApp = "google" | "waze" | "apple" | "copy";

export type NavigationTarget =
  | { mode: "coords"; latitude: number; longitude: number; precision: "trusted" }
  | {
      mode: "address";
      address: string;
      /** true: endereço escolhido deliberadamente (coords confiáveis de respaldo); não exige confirmação. */
      trusted: boolean;
      fallbackCoords?: { latitude: number; longitude: number };
    }
  | { mode: "none"; reason: string };

export type { GeocodedCoordsMap };

const APPROXIMATE_ADDRESS_ALERT =
  "Esta parada não possui coordenadas confirmadas. O mapa abrirá pelo endereço completo.";

/** Origens em que o pin foi escolhido pelo usuário ou veio do Google (coords valem mais que o texto). */
const PINNED_COORD_ORIGINS = new Set(["mapa", "google_places"]);

export function destinationToNavigationTarget(
  dest: DeliveryResolvedDestination
): NavigationTarget {
  if (dest.hasTrustedCoords && dest.latitude != null && dest.longitude != null) {
    const pinnedByUser = PINNED_COORD_ORIGINS.has(dest.coordsOrigem ?? "");
    if (!pinnedByUser && dest.addressHasNumber && dest.addressText.trim()) {
      // Coords geocodificadas (Nominatim/legado) raramente caem no número exato;
      // navegar pelo endereço textual evita o navegador mostrar outro número.
      return {
        mode: "address",
        address: dest.addressText.trim(),
        trusted: true,
        fallbackCoords: { latitude: dest.latitude, longitude: dest.longitude },
      };
    }
    return {
      mode: "coords",
      latitude: dest.latitude,
      longitude: dest.longitude,
      precision: "trusted",
    };
  }
  if (dest.source === "address_text" && dest.addressText.trim()) {
    return { mode: "address", address: dest.addressText.trim(), trusted: false };
  }
  return {
    mode: "none",
    reason: dest.reviewMessage ?? REVIEW_MESSAGE_INSUFFICIENT,
  };
}

export function resolveNavigationTarget(
  stop: EntregaListItem,
  geocodedCoords: GeocodedCoordsMap = {},
  geocodedMeta: GeocodedMetaMap = {},
  legacyCache?: LegacyValidationCache
): NavigationTarget {
  const dest = resolveDeliveryDestination(stop, geocodedCoords, geocodedMeta, legacyCache);
  return destinationToNavigationTarget(dest);
}

export function resolveGroupNavigationTarget(
  group: GroupedStop,
  geocodedCoords: GeocodedCoordsMap = {},
  geocodedMeta: GeocodedMetaMap = {},
  legacyCache?: LegacyValidationCache
): NavigationTarget {
  const dest = resolveGroupDestination(group, geocodedCoords, geocodedMeta, legacyCache);
  return destinationToNavigationTarget(dest);
}

export function getDestinationLabel(target: NavigationTarget): string {
  if (target.mode === "coords") return "Destino: coordenadas confirmadas";
  if (target.mode === "address") {
    return target.trusted
      ? "Destino: endereço com número"
      : "Destino: endereço completo (sem coord confirmada)";
  }
  return "Endereço insuficiente para navegação";
}

export function canNavigate(target: NavigationTarget): boolean {
  return target.mode === "coords" || target.mode === "address";
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

function buildNavigationUrls(
  app: NavigationApp,
  target: NavigationTarget
): { primary: string; fallback?: string } | null {
  if (app === "copy") return null;
  if (target.mode === "none") return null;

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

  const fb = target.fallbackCoords;
  switch (app) {
    case "google":
      return {
        primary: getGoogleMapsAddressUrl(address),
        fallback: fb ? getGoogleMapsUrl(fb.latitude, fb.longitude) : undefined,
      };
    case "waze":
      return {
        primary: getWazeAddressUrl(address),
        fallback: fb ? getWazeUrl(fb.latitude, fb.longitude) : undefined,
      };
    case "apple":
      return {
        primary: getAppleMapsAddressUrl(address),
        fallback: fb ? getAppleMapsCoordsUrl(fb.latitude, fb.longitude) : undefined,
      };
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
  geocodedMeta?: GeocodedMetaMap;
  legacyCache?: LegacyValidationCache;
  skipApproximateConfirm?: boolean;
}

export async function openNavigationToStop(
  stop: EntregaListItem,
  app: NavigationApp,
  options: OpenNavigationOptions = {}
): Promise<boolean> {
  const target = resolveNavigationTarget(
    stop,
    options.geocodedCoords ?? {},
    options.geocodedMeta ?? {},
    options.legacyCache
  );

  if (app === "copy") {
    const dest = resolveDeliveryDestination(
      stop,
      options.geocodedCoords ?? {},
      options.geocodedMeta ?? {},
      options.legacyCache
    );
    const text = dest.addressText;
    if (!text || text === "—") {
      Alert.alert("Atenção", "Endereço indisponível para copiar.");
      return false;
    }
    const ok = await copyToClipboard(text);
    if (ok) Alert.alert("Copiado", "Endereço copiado para a área de transferência.");
    return ok;
  }

  if (target.mode === "none") {
    Alert.alert("Atenção", target.reason);
    return false;
  }

  if (target.mode === "address" && !target.trusted && !options.skipApproximateConfirm) {
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

export async function openExternalNavigation(
  app: NavigationApp,
  coords: { latitude: number; longitude: number },
  _address?: string
): Promise<boolean> {
  const stop = {
    id_saida: 0,
    latitude: coords.latitude,
    longitude: coords.longitude,
    coord_precision: "rooftop",
    endereco_origem: "mapa",
  } as EntregaListItem;
  return openNavigationToStop(stop, app, { skipApproximateConfirm: true });
}

/** Navega ou copia a partir de um endereço textual (ex.: base/seller da coleta). */
export async function openNavigationByAddress(
  app: NavigationApp,
  address: string
): Promise<boolean> {
  const text = String(address || "").trim();
  if (!text) {
    Alert.alert("Atenção", "Endereço indisponível.");
    return false;
  }
  if (app === "copy") {
    const ok = await copyToClipboard(text);
    if (ok) Alert.alert("Copiado", "Endereço copiado para a área de transferência.");
    return ok;
  }
  const target: NavigationTarget = { mode: "address", address: text, trusted: true };
  const urls = buildNavigationUrls(app, target);
  if (!urls) {
    Alert.alert("Atenção", "Não foi possível montar o link de navegação.");
    return false;
  }
  return openNavigationUrl(urls.primary, urls.fallback);
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
