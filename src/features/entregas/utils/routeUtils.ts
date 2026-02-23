import type { EntregaListItem } from "../types";

export type ServicoTipo = "Shopee" | "Flex" | "Avulso";

export function servicoTipo(serv?: string | null): ServicoTipo {
  const s = (serv || "").trim().toLowerCase();
  if (s.includes("shopee")) return "Shopee";
  if (s.includes("mercado") || s.includes("ml") || s.includes("flex")) return "Flex";
  return "Avulso";
}

/** Cores dos marcadores no mapa (RouteBuilder): AVULSO → Azul, FLEX → Amarelo, SHOPEE → Laranja */
export const ROUTE_MARKER_COLORS: Record<ServicoTipo, string> = {
  Avulso: "#2563eb",
  Flex: "#eab308",
  Shopee: "#ea580c",
};

/** Retorna entregas na ordem atual da rota (routeOrder). */
export function getOrderedRouteDeliveries(
  routeDeliveries: EntregaListItem[],
  routeOrder: number[]
): EntregaListItem[] {
  const byId = new Map(routeDeliveries.map((d) => [d.id_saida, d]));
  const ordered: EntregaListItem[] = [];
  for (const id of routeOrder) {
    const d = byId.get(id);
    if (d) ordered.push(d);
  }
  return ordered;
}

/** Raio da Terra em km para Haversine */
const EARTH_RADIUS_KM = 6371;

/** Distância entre dois pontos em km (fórmula de Haversine). */
function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/** Estatísticas da rota: distância total (km) e tempo estimado (minutos). Regras: 2 min/parada + deslocamento a 30 km/h. */
export function computeRouteStats(
  orderedDeliveries: EntregaListItem[]
): { distanceKm: number; estimatedMinutes: number } {
  const withCoords = orderedDeliveries.filter(
    (d) => d.latitude != null && d.longitude != null
  ) as (EntregaListItem & { latitude: number; longitude: number })[];
  let distanceKm = 0;
  for (let i = 0; i < withCoords.length - 1; i++) {
    distanceKm += haversineDistanceKm(
      withCoords[i].latitude,
      withCoords[i].longitude,
      withCoords[i + 1].latitude,
      withCoords[i + 1].longitude
    );
  }
  const minutesPerStop = 2;
  const speedKmh = 30;
  const travelMinutes = withCoords.length > 0 ? (distanceKm / speedKmh) * 60 : 0;
  const stopMinutes = withCoords.length * minutesPerStop;
  const estimatedMinutes = Math.round(travelMinutes + stopMinutes);
  return { distanceKm: Math.round(distanceKm * 100) / 100, estimatedMinutes };
}
