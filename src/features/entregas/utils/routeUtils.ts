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

/** Retorna chave de endereço para agrupamento: CEP + número quando disponível; senão coords; senão endereço formatado. */
export function addressKey(d: EntregaListItem): string {
  const cep = (d.cep ?? "").toString().replace(/\D/g, "").slice(0, 8);
  const num = (d.numero ?? "").toString().trim();
  if (cep && num) return `${cep}|${num}`;
  if (d.latitude != null && d.longitude != null) {
    return `coord|${Math.round(d.latitude * 100000)}|${Math.round(d.longitude * 100000)}`;
  }
  const addr = (d.endereco_formatado || [d.endereco, d.bairro].filter(Boolean).join(", ") || "").trim();
  return addr ? `addr|${addr}` : `id|${d.id_saida}`;
}

/** Chave CEP + número + destinatário (para fluxo "finalizar todos"). */
export function addressAndRecipientKey(d: EntregaListItem): string {
  const base = addressKey(d);
  const cliente = (d.cliente ?? "").trim();
  return `${base}|${cliente}`;
}

/** Agrupa entregas na ordem da rota por mesmo endereço (CEP+número ou fallback). Preserva ordem. */
export function groupOrderedByAddress(
  ordered: EntregaListItem[]
): Array<{ key: string; deliveries: EntregaListItem[] }> {
  if (ordered.length === 0) return [];
  const groups: Array<{ key: string; deliveries: EntregaListItem[] }> = [];
  let currentKey = addressKey(ordered[0]);
  let current: EntregaListItem[] = [ordered[0]];
  for (let i = 1; i < ordered.length; i++) {
    const d = ordered[i];
    const k = addressKey(d);
    if (k === currentKey) {
      current.push(d);
    } else {
      groups.push({ key: currentKey, deliveries: current });
      currentKey = k;
      current = [d];
    }
  }
  groups.push({ key: currentKey, deliveries: current });
  return groups;
}

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

export type GroupedStop = { key: string; deliveries: EntregaListItem[] };

/** Estatísticas da rota a partir de paradas agrupadas: um ponto por grupo (primeira entrega com coords). */
export function computeRouteStatsFromGroups(
  groupedStops: GroupedStop[]
): { distanceKm: number; estimatedMinutes: number } {
  const onePerGroup: EntregaListItem[] = groupedStops.map((g) => {
    const withCoords = g.deliveries.find((d) => d.latitude != null && d.longitude != null);
    return withCoords ?? g.deliveries[0];
  });
  return computeRouteStats(onePerGroup);
}
