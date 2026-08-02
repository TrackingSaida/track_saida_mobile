import type { EntregaListItem } from "../types";
import { servicoTipo, type ServicoTipo } from "./servico";
import { groupOrderedByAddress, haversineDistanceKm, getOrderedRouteDeliveries } from "./routeUtils";

export type RoutePriority =
  | { type: "none" }
  | { type: "service"; value: ServicoTipo }
  | { type: "delivery"; idSaida: number };

/** Espelha backend: threshold 1500m, penalty 200m, nearby 400m. */
export const SOFT_PRIORITY_THRESHOLD_KM = 1.5;
export const SOFT_PRIORITY_PENALTY_KM = 0.2;
export const SOFT_PRIORITY_NEARBY_KM = 0.4;

export const ROUTE_PRIORITY_NONE: RoutePriority = { type: "none" };

export function routePriorityLabel(priority: RoutePriority, codigo?: string): string {
  if (priority.type === "none") return "Nenhum";
  if (priority.type === "service") {
    if (priority.value === "Flex") return "Mercado Livre / Flex";
    return priority.value;
  }
  return codigo ? `Pacote ${codigo}` : `Pacote #${priority.idSaida}`;
}

export function toApiPriorityPayload(
  priority: RoutePriority
): { type: "service"; value: string } | { type: "delivery"; id_saida: number } | undefined {
  if (priority.type === "none") return undefined;
  if (priority.type === "service") return { type: "service", value: priority.value };
  return { type: "delivery", id_saida: priority.idSaida };
}

export function stopMatchesPriority(
  deliveries: EntregaListItem[],
  priority: RoutePriority
): boolean {
  if (priority.type === "none") return true;
  if (priority.type === "delivery") {
    return deliveries.some((d) => d.id_saida === priority.idSaida);
  }
  return deliveries.some((d) => servicoTipo(d.servico) === priority.value);
}

export function stopPenaltyKm(deliveries: EntregaListItem[], priority: RoutePriority): number {
  if (priority.type === "none") return 0;
  return stopMatchesPriority(deliveries, priority) ? 0 : SOFT_PRIORITY_PENALTY_KM;
}

type StopPoint = {
  representativeId: number;
  deliveryIds: number[];
  lat: number;
  lon: number;
};

function buildStopPoints(
  routeDeliveries: EntregaListItem[],
  routeOrder: number[]
): StopPoint[] {
  const ordered = getOrderedRouteDeliveries(routeDeliveries, routeOrder);
  const groups = groupOrderedByAddress(ordered);
  const points: StopPoint[] = [];

  for (const group of groups) {
    const withCoords = group.deliveries.find((d) => d.latitude != null && d.longitude != null);
    if (!withCoords || withCoords.latitude == null || withCoords.longitude == null) continue;
    points.push({
      representativeId: withCoords.id_saida,
      deliveryIds: group.deliveries.map((d) => d.id_saida),
      lat: withCoords.latitude,
      lon: withCoords.longitude,
    });
  }
  return points;
}

export function effectiveCostKm(
  distKm: number,
  penaltyKm: number,
  thresholdKm: number = SOFT_PRIORITY_THRESHOLD_KM,
  nearbyKm: number = SOFT_PRIORITY_NEARBY_KM
): number {
  if (distKm <= nearbyKm) return distKm;
  if (distKm >= thresholdKm) return distKm;
  return distKm + penaltyKm;
}

export type SoftPriorityEndPoint = { latitude: number; longitude: number };

/** Nearest neighbor em paradas com prioridade suave (espelha backend). */
export function optimizeStopsSoftPriority(
  routeDeliveries: EntregaListItem[],
  routeOrder: number[],
  priority: RoutePriority,
  fromLat?: number,
  fromLon?: number,
  end?: SoftPriorityEndPoint | null
): number[] {
  const groups = groupOrderedByAddress(getOrderedRouteDeliveries(routeDeliveries, routeOrder));
  const stopMeta = groups.map((g) => {
    const withCoords = g.deliveries.find((d) => d.latitude != null && d.longitude != null);
    return {
      deliveries: g.deliveries,
      lat: withCoords?.latitude ?? null,
      lon: withCoords?.longitude ?? null,
    };
  });

  const withCoords = stopMeta.filter((s) => s.lat != null && s.lon != null);
  const withoutCoords = stopMeta.filter((s) => s.lat == null || s.lon == null);

  if (withCoords.length === 0) return routeOrder;

  let forcedLast: (typeof withCoords)[number] | null = null;
  let remaining = [...withCoords];
  if (end && remaining.length >= 2) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const d = haversineDistanceKm(s.lat!, s.lon!, end.latitude, end.longitude);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    forcedLast = remaining[bestIdx];
    remaining = remaining.filter((_, i) => i !== bestIdx);
  }

  let curLat = fromLat;
  let curLon = fromLon;
  if (curLat == null || curLon == null) {
    if (remaining.length === 0 && forcedLast) {
      curLat = forcedLast.lat!;
      curLon = forcedLast.lon!;
    } else {
      curLat = remaining[0].lat!;
      curLon = remaining[0].lon!;
    }
  }

  const orderedStops: typeof withCoords = [];

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestCost = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const distKm = haversineDistanceKm(curLat!, curLon!, s.lat!, s.lon!);
      const penalty = stopPenaltyKm(s.deliveries, priority);
      const cost = effectiveCostKm(distKm, penalty);
      if (cost < bestCost) {
        bestCost = cost;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    orderedStops.push(next);
    curLat = next.lat!;
    curLon = next.lon!;
  }

  if (forcedLast) orderedStops.push(forcedLast);

  const orderedIds: number[] = [];
  for (const stop of orderedStops) {
    for (const d of stop.deliveries) {
      orderedIds.push(d.id_saida);
    }
  }
  for (const stop of withoutCoords) {
    for (const d of stop.deliveries) {
      orderedIds.push(d.id_saida);
    }
  }

  const inRoute = new Set(routeOrder);
  const missing = routeOrder.filter((id) => !orderedIds.includes(id));
  return [...orderedIds, ...missing.filter((id) => inRoute.has(id))];
}

export function estimateRouteDistanceKm(
  routeDeliveries: EntregaListItem[],
  orderedIds: number[]
): number {
  const points = buildStopPoints(routeDeliveries, orderedIds);
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineDistanceKm(
      points[i].lat,
      points[i].lon,
      points[i + 1].lat,
      points[i + 1].lon
    );
  }
  return Math.round(total * 100) / 100;
}
