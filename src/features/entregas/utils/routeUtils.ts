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

export function normalizeStreet(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Extrai e normaliza o número principal (somente dígitos quando possível). */
export function normalizeNumero(numero: string, endereco?: string): string {
  const n = (numero ?? "").trim();
  if (n) {
    const digits = n.replace(/\D/g, "");
    return digits || n.toLowerCase();
  }
  const fromAddr = (endereco ?? "").match(/,?\s*(\d{1,6})\s*(?:,|$)/);
  if (fromAddr) return fromAddr[1];
  return "";
}

type AddressKeyParts = {
  endereco?: string | null;
  numero?: string | null;
  cep?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  endereco_formatado?: string | null;
  bairro?: string | null;
  id_saida?: number;
};

function buildAddressKey(parts: AddressKeyParts): string {
  const rua = normalizeStreet(parts.endereco ?? "");
  const num = normalizeNumero(parts.numero ?? "", parts.endereco ?? "");
  if (rua && num) return `loc|${rua}|${num}`;

  const cep = (parts.cep ?? "").toString().replace(/\D/g, "").slice(0, 8);
  if (cep && num) return `cep|${cep}|${num}`;

  if (parts.latitude != null && parts.longitude != null) {
    return `coord|${Math.round(parts.latitude * 10000)}|${Math.round(parts.longitude * 10000)}`;
  }

  const addr = (
    parts.endereco_formatado ||
    [parts.endereco, parts.bairro].filter(Boolean).join(", ") ||
    ""
  ).trim();
  return addr ? `addr|${normalizeStreet(addr)}` : `id|${parts.id_saida ?? 0}`;
}

/** Retorna chave de endereço para agrupamento: rua + número normalizados; fallbacks CEP/coords/endereço. */
export function addressKey(d: EntregaListItem): string {
  return buildAddressKey({
    endereco: d.endereco,
    numero: d.numero,
    cep: d.cep,
    latitude: d.latitude,
    longitude: d.longitude,
    endereco_formatado: d.endereco_formatado,
    bairro: d.bairro,
    id_saida: d.id_saida,
  });
}

export function addressKeyFromValues(vals: {
  rua?: string;
  numero?: string;
  cep?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
}): string {
  return buildAddressKey({
    endereco: vals.rua,
    numero: vals.numero,
    cep: vals.cep,
    bairro: vals.bairro,
  });
}

/** Reordena routeOrder para que pedidos com mesma addressKey fiquem adjacentes. */
export function clusterRouteOrderByAddress(
  routeDeliveries: EntregaListItem[],
  routeOrder: number[]
): number[] {
  if (routeOrder.length === 0) return [];
  const ordered = getOrderedRouteDeliveries(routeDeliveries, routeOrder);
  const byKey = new Map<string, number[]>();
  for (const d of ordered) {
    const k = addressKey(d);
    const list = byKey.get(k) ?? [];
    list.push(d.id_saida);
    byKey.set(k, list);
  }
  const seen = new Set<string>();
  const result: number[] = [];
  for (const d of ordered) {
    const k = addressKey(d);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(...(byKey.get(k) ?? []));
  }
  return result;
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

/** Retorna entregas na ordem atual da rota (routeOrder). Suporta mesmo id_saida em várias entregas (usa uma entrega por id na ordem). */
export function getOrderedRouteDeliveries(
  routeDeliveries: EntregaListItem[],
  routeOrder: number[]
): EntregaListItem[] {
  const byId = new Map<number, EntregaListItem[]>();
  for (const d of routeDeliveries) {
    const list = byId.get(d.id_saida) ?? [];
    list.push(d);
    byId.set(d.id_saida, list);
  }
  const ordered: EntregaListItem[] = [];
  for (const id of routeOrder) {
    const list = byId.get(id);
    if (list && list.length > 0) ordered.push(list.shift()!);
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

export type AddressReviewIssue =
  | "sem_endereco"
  | "rua_incompleta"
  | "sem_numero"
  | "cep_invalido"
  | "sem_coordenadas";

export const ADDRESS_REVIEW_LABELS: Record<AddressReviewIssue, string> = {
  sem_endereco: "Sem endereço",
  rua_incompleta: "Endereço incompleto",
  sem_numero: "Sem número",
  cep_invalido: "CEP inválido",
  sem_coordenadas: "Sem coordenadas no mapa",
};

export function getAddressReviewIssue(
  d: EntregaListItem,
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>
): AddressReviewIssue | null {
  if (!d.possui_endereco) {
    const rua = (d.endereco ?? "").trim();
    if (!rua) return "sem_endereco";
    return "rua_incompleta";
  }
  if (!(d.numero ?? "").trim()) return "sem_numero";
  const cep = (d.cep ?? "").replace(/\D/g, "");
  if (!cep || cep.length !== 8) return "cep_invalido";
  const hasCoords =
    (d.latitude != null && d.longitude != null) ||
    (geocodedCoords?.[d.id_saida]?.latitude != null &&
      geocodedCoords?.[d.id_saida]?.longitude != null);
  if (!hasCoords) return "sem_coordenadas";
  return null;
}

export function getStopPrimaryCodigo(group: GroupedStop): string {
  const codes = group.deliveries
    .map((d) => (d.codigo ?? "").trim())
    .filter(Boolean);
  if (codes.length === 0) return "—";
  if (codes.length === 1) return codes[0];
  return `${codes[0]} +${codes.length - 1}`;
}

export function getStopPedidoLabel(d: EntregaListItem): string {
  return `Pedido ${d.id_saida}`;
}

export function getStopAddressLine(d: EntregaListItem): string {
  const parts = [d.endereco, d.numero, d.bairro].filter(Boolean);
  if (parts.length === 0) return d.endereco_formatado || "—";
  return parts.join(", ");
}

export function countRoutePedidos(groupedStops: GroupedStop[]): number {
  return groupedStops.reduce((sum, g) => sum + g.deliveries.length, 0);
}

export function countRouteVolumes(group: GroupedStop): number {
  return group.deliveries.length;
}

export type RouteHeaderStats = {
  stopCount: number;
  pedidoCount: number;
  localizedStops: number;
  reviewCount: number;
  reviewDeliveries: EntregaListItem[];
};

export function computeRouteHeaderStats(
  groupedStops: GroupedStop[],
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>
): RouteHeaderStats {
  const pedidoCount = countRoutePedidos(groupedStops);
  const stopCount = groupedStops.length;
  let localizedStops = 0;
  const reviewDeliveries: EntregaListItem[] = [];
  const seenIds = new Set<number>();

  for (const group of groupedStops) {
    const hasCoords = group.deliveries.some(
      (d) =>
        (d.latitude != null && d.longitude != null) ||
        (geocodedCoords?.[d.id_saida]?.latitude != null &&
          geocodedCoords?.[d.id_saida]?.longitude != null)
    );
    if (hasCoords) localizedStops++;
    for (const d of group.deliveries) {
      if (seenIds.has(d.id_saida)) continue;
      const issue = getAddressReviewIssue(d, geocodedCoords);
      if (issue) {
        seenIds.add(d.id_saida);
        reviewDeliveries.push(d);
      }
    }
  }

  return {
    stopCount,
    pedidoCount,
    localizedStops,
    reviewCount: reviewDeliveries.length,
    reviewDeliveries,
  };
}

export function flattenGroupsToRouteOrder(groups: GroupedStop[]): number[] {
  return groups.flatMap((g) => g.deliveries.map((d) => d.id_saida));
}

export function moveGroupInOrder(groups: GroupedStop[], from: number, to: number): GroupedStop[] {
  if (from === to || from < 0 || from >= groups.length) return groups;
  const next = [...groups];
  const [item] = next.splice(from, 1);
  const clampedTo = Math.max(0, Math.min(to, next.length));
  next.splice(clampedTo, 0, item);
  return next;
}

export function getActiveGroupIndex(groupedStops: GroupedStop[], activeStopIndex: number): number {
  let idx = 0;
  for (let i = 0; i < groupedStops.length; i++) {
    if (activeStopIndex < idx + groupedStops[i].deliveries.length) return i;
    idx += groupedStops[i].deliveries.length;
  }
  return Math.max(0, groupedStops.length - 1);
}

export function getStopVolumesSummary(group: GroupedStop): string {
  const volumes = countRouteVolumes(group);
  const pedidos = new Set(group.deliveries.map((d) => d.id_saida)).size;
  if (pedidos > 1) return `📦 ${volumes} volume${volumes !== 1 ? "s" : ""} · ${pedidos} pedidos`;
  return `📦 ${volumes} volume${volumes !== 1 ? "s" : ""}`;
}
