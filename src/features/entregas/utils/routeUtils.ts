import type { EntregaListItem } from "../types";
import { haversineDistanceKm } from "./coordsUtils";
import {
  resolveDeliveryDestination,
  resolveGroupDestination,
  type GeocodedMetaMap,
  type LegacyValidationCache,
} from "./deliveryDestination";

export { haversineDistanceKm } from "./coordsUtils";

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
  cidade?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  endereco_formatado?: string | null;
  bairro?: string | null;
  id_saida?: number;
};

function roundCoord5(n: number): number {
  return Math.round(n * 100000) / 100000;
}

function buildAddressKey(parts: AddressKeyParts): string {
  const rua = normalizeStreet(parts.endereco ?? "");
  const num = normalizeNumero(parts.numero ?? "", parts.endereco ?? "");
  const cidade = normalizeStreet(parts.cidade ?? "");
  const cep = (parts.cep ?? "").toString().replace(/\D/g, "").slice(0, 8);

  if (cep && num) return `cep|${cep}|${num}`;
  if (rua && num && cidade) return `loc|${rua}|${num}|${cidade}`;
  if (rua && num) return `loc|${rua}|${num}|`;

  if (parts.latitude != null && parts.longitude != null) {
    const lat = roundCoord5(parts.latitude);
    const lon = roundCoord5(parts.longitude);
    if (lat !== 0 || lon !== 0) return `coord|${lat}|${lon}`;
  }

  const addr = (
    parts.endereco_formatado ||
    [parts.endereco, parts.bairro].filter(Boolean).join(", ") ||
    ""
  ).trim();
  return addr ? `addr|${normalizeStreet(addr)}` : `id|${parts.id_saida ?? 0}`;
}

function toGroupedStop(stopKey: string, deliveries: EntregaListItem[]): GroupedStop {
  const withCoords = deliveries.find((d) => d.latitude != null && d.longitude != null);
  const representativeDelivery = withCoords ?? deliveries[0];
  return {
    key: stopKey,
    stopKey,
    deliveries,
    deliveryIds: deliveries.map((d) => d.id_saida),
    representativeDelivery,
  };
}

/** Chave de parada alinhada ao backend: CEP+número → rua+número+cidade → coord → id. */
export function getDeliveryStopKey(d: EntregaListItem): string {
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

/** @deprecated use getDeliveryStopKey */
export function addressKey(d: EntregaListItem): string {
  return getDeliveryStopKey(d);
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

/** Agrupa entregas consecutivas na ordem da rota com mesma chave de parada. */
export function groupDeliveriesIntoStops(
  deliveries: EntregaListItem[],
  routeOrder: number[]
): GroupedStop[] {
  const ordered = getOrderedRouteDeliveries(deliveries, routeOrder);
  return groupOrderedByAddress(ordered);
}

/** Agrupa entregas na ordem por mesmo endereço (CEP+número ou fallback). Preserva ordem. */
export function groupOrderedByAddress(ordered: EntregaListItem[]): GroupedStop[] {
  if (ordered.length === 0) return [];
  const groups: GroupedStop[] = [];
  let currentKey = getDeliveryStopKey(ordered[0]);
  let current: EntregaListItem[] = [ordered[0]];
  for (let i = 1; i < ordered.length; i++) {
    const d = ordered[i];
    const k = getDeliveryStopKey(d);
    if (k === currentKey) {
      current.push(d);
    } else {
      groups.push(toGroupedStop(currentKey, current));
      currentKey = k;
      current = [d];
    }
  }
  groups.push(toGroupedStop(currentKey, current));
  return groups;
}

/** Agrupa entregas pelo mesmo stop_key, independente da ordem de rota. */
export function groupDeliveriesByStopKey(deliveries: EntregaListItem[]): GroupedStop[] {
  const map = new Map<string, EntregaListItem[]>();
  for (const d of deliveries) {
    const k = getDeliveryStopKey(d);
    const list = map.get(k) ?? [];
    list.push(d);
    map.set(k, list);
  }
  return Array.from(map.entries()).map(([stopKey, dels]) => toGroupedStop(stopKey, dels));
}

export function resolveDeliveryCoords(
  d: EntregaListItem,
  geocodedCoords: Record<number, { latitude: number; longitude: number }> = {},
  geocodedMeta: GeocodedMetaMap = {},
  legacyCache?: LegacyValidationCache
): { latitude: number; longitude: number } | null {
  const dest = resolveDeliveryDestination(d, geocodedCoords, geocodedMeta, legacyCache);
  if (!dest.hasTrustedCoords || dest.latitude == null || dest.longitude == null) return null;
  return { latitude: dest.latitude, longitude: dest.longitude };
}

/** Proxy de atraso: data operacional (campo data) anterior ao dia de referência. */
export function isDeliveryLate(d: EntregaListItem, todayIso: string): boolean {
  const data = (d.data ?? "").trim().slice(0, 10);
  if (!data || data.length < 10) return false;
  return data < todayIso;
}

export function hasPersistedDeliveryCoords(d: EntregaListItem): boolean {
  return d.latitude != null && d.longitude != null;
}

/** KPIs estáveis: conta somente coordenadas persistidas no pedido (não geocode em andamento). */
export function countPendingMapStats(pending: EntregaListItem[]): {
  total: number;
  noMapa: number;
  semLocalizacao: number;
} {
  const total = pending.length;
  let noMapa = 0;
  for (const d of pending) {
    if (hasPersistedDeliveryCoords(d)) noMapa++;
  }
  return { total, noMapa, semLocalizacao: total - noMapa };
}

export type PendingMapGroupPoint = {
  group: GroupedStop;
  latitude: number;
  longitude: number;
  packageCount: number;
  hasLate: boolean;
  mapIndex: number;
};

/** Grupos de endereço com coordenadas para o mapa de pendentes. */
export function buildPendingMapGroups(
  pending: EntregaListItem[],
  geocodedCoords: Record<number, { latitude: number; longitude: number }>,
  todayIso: string,
  geocodedMeta: GeocodedMetaMap = {},
  legacyCache?: LegacyValidationCache
): PendingMapGroupPoint[] {
  const grouped = groupDeliveriesByStopKey(pending);
  const result: PendingMapGroupPoint[] = [];
  let mapIndex = 0;
  for (const group of grouped) {
    const dest = resolveGroupDestination(group, geocodedCoords, geocodedMeta, legacyCache);
    if (!dest.hasTrustedCoords || dest.latitude == null || dest.longitude == null) continue;
    const coords = { latitude: dest.latitude, longitude: dest.longitude };
    mapIndex++;
    result.push({
      group,
      latitude: coords.latitude,
      longitude: coords.longitude,
      packageCount: group.deliveries.length,
      hasLate: group.deliveries.some((d) => isDeliveryLate(d, todayIso)),
      mapIndex,
    });
  }
  return result;
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

export type GroupedStop = {
  key: string;
  stopKey: string;
  deliveries: EntregaListItem[];
  deliveryIds: number[];
  representativeDelivery: EntregaListItem;
};

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

/** Partes do tempo estimado: valor em destaque + rótulo discreto. */
export function getEstimatedRouteDurationParts(totalMinutes: number): {
  value: string;
  label: string;
} {
  const m = Math.max(0, Math.round(totalMinutes));
  if (m < 60) return { value: `~${m} min`, label: "estimados" };
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (rem === 0) return { value: `~${h}h`, label: "estimados" };
  return { value: `~${h}h e ${rem}min`, label: "estimados" };
}

/** Tempo estimado legível para o motoboy (horas e minutos quando passa de 59 min). */
export function formatEstimatedRouteDuration(totalMinutes: number): string {
  const { value, label } = getEstimatedRouteDurationParts(totalMinutes);
  return `${value} ${label}`;
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
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>,
  geocodedMeta: GeocodedMetaMap = {},
  legacyCache?: LegacyValidationCache
): AddressReviewIssue | null {
  if (!d.possui_endereco) {
    const rua = (d.endereco ?? "").trim();
    if (!rua) return "sem_endereco";
    return "rua_incompleta";
  }
  if (!(d.numero ?? "").trim()) return "sem_numero";
  const cep = (d.cep ?? "").replace(/\D/g, "");
  if (!cep || cep.length !== 8) return "cep_invalido";
  const dest = resolveDeliveryDestination(d, geocodedCoords ?? {}, geocodedMeta, legacyCache);
  if (!dest.hasTrustedCoords) return "sem_coordenadas";
  return null;
}

export function getStopCodigosList(group: GroupedStop): string[] {
  return group.deliveries.map((d) => (d.codigo ?? "").trim()).filter(Boolean);
}

export function getStopPrimaryCodigo(group: GroupedStop): string {
  const codes = getStopCodigosList(group);
  if (codes.length === 0) return "—";
  if (codes.length === 1) return codes[0];
  return codes.join(" · ");
}

export function getStopPedidosList(group: GroupedStop): string {
  const ids = group.deliveries.map((d) => d.id_saida);
  if (ids.length <= 3) return ids.map((id) => `Pedido ${id}`).join(" · ");
  return `Pedido ${ids[0]} · +${ids.length - 1}`;
}

export function getStopPedidoLabel(d: EntregaListItem): string {
  return `Pedido ${d.id_saida}`;
}

function normalizePartForAddressDedup(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function normalizeNumeroForAddressDedup(num: string): string {
  const digits = num.replace(/\D/g, "");
  return digits || normalizePartForAddressDedup(num);
}

function cleanAddressString(s: string): string {
  return s
    .replace(/,+\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,\s*,+/g, ", ")
    .trim()
    .replace(/,\s*$/g, "");
}

function hasObviousAddressDuplicates(s: string): boolean {
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  const seen = new Set<string>();
  for (const p of parts) {
    const key = normalizePartForAddressDedup(p);
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

function isPartAlreadyInCombined(part: string, combined: string, kind: "text" | "num" | "cep"): boolean {
  const lower = combined.toLowerCase();
  if (kind === "num") {
    const digits = part.replace(/\D/g, "");
    return Boolean(digits && lower.includes(digits));
  }
  if (kind === "cep") {
    const digits = part.replace(/\D/g, "");
    return Boolean(digits.length === 8 && lower.includes(digits));
  }
  const norm = normalizePartForAddressDedup(part);
  return Boolean(norm && lower.includes(norm));
}

/** Endereço limpo para exibição (sem duplicar número, bairro, etc.). */
export function formatStopAddress(d: EntregaListItem): string {
  const formatted = cleanAddressString(d.endereco_formatado ?? "");
  const numero = (d.numero ?? "").trim();

  if (formatted && !hasObviousAddressDuplicates(formatted)) {
    if (numero && !isPartAlreadyInCombined(numero, formatted, "num")) {
      const parts = formatted.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length > 0) {
        return cleanAddressString([parts[0], numero, ...parts.slice(1)].join(", "));
      }
      return cleanAddressString(`${formatted}, ${numero}`);
    }
    return formatted;
  }

  const seen = new Set<string>();
  const parts: string[] = [];

  const add = (raw: string, kind: "text" | "num" | "cep" = "text") => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key =
      kind === "num"
        ? `num:${normalizeNumeroForAddressDedup(trimmed)}`
        : kind === "cep"
          ? `cep:${trimmed.replace(/\D/g, "")}`
          : normalizePartForAddressDedup(trimmed);
    if (!key || seen.has(key)) return;
    const combined = parts.join(", ");
    if (isPartAlreadyInCombined(trimmed, combined, kind)) return;
    seen.add(key);
    parts.push(trimmed);
  };

  const endereco = (d.endereco ?? "").trim();
  const bairro = (d.bairro ?? "").trim();
  const cepDigits = (d.cep ?? "").replace(/\D/g, "");

  if (endereco) add(endereco);
  if (numero) add(numero, "num");
  if (bairro) add(bairro);
  if (cepDigits.length === 8) add(cepDigits, "cep");

  if (parts.length > 0) return parts.join(", ");
  return formatted || "—";
}

export function formatStopAddressLines(d: EntregaListItem): { line1: string; line2?: string } {
  const full = formatStopAddress(d);
  if (full === "—") return { line1: "—" };
  const segments = full.split(",").map((p) => p.trim()).filter(Boolean);
  if (segments.length <= 2) return { line1: full };
  const line1 = segments.slice(0, 2).join(", ");
  const line2 = segments.slice(2).join(", ");
  return line2 ? { line1, line2 } : { line1 };
}

export function getStopAddressLine(d: EntregaListItem): string {
  return formatStopAddress(d);
}

export function isApproximateLocation(d: EntregaListItem): boolean {
  const precision = d.coord_precision;
  if (precision === "rooftop" || precision === "street") return false;
  if (precision === "approx") return true;
  const origem = (d.endereco_origem ?? "").toLowerCase();
  if (origem === "google_places" || origem === "mapa") return false;
  if (origem === "suggestion" || origem === "autocomplete") return false;
  return false;
}

export function getApproximateLocationLabel(d: EntregaListItem): string | null {
  if (d.coord_precision === "approx") return "Localização aproximada";
  if (d.coord_precision === "street") return "Precisão ao nível da rua";
  if (isApproximateLocation(d)) return "Localização aproximada";
  return null;
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
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>,
  geocodedMeta: GeocodedMetaMap = {},
  legacyCache?: LegacyValidationCache
): RouteHeaderStats {
  const pedidoCount = countRoutePedidos(groupedStops);
  const stopCount = groupedStops.length;
  let localizedStops = 0;
  const reviewDeliveries: EntregaListItem[] = [];
  const seenIds = new Set<number>();

  for (const group of groupedStops) {
    const dest = resolveGroupDestination(
      group,
      geocodedCoords ?? {},
      geocodedMeta,
      legacyCache
    );
    if (dest.hasTrustedCoords) localizedStops++;
    for (const d of group.deliveries) {
      if (seenIds.has(d.id_saida)) continue;
      const issue = getAddressReviewIssue(d, geocodedCoords, geocodedMeta, legacyCache);
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

/** Soma entregas dos grupos [0..anchorGroupIndex] — índice em routeOrder após a âncora. */
export function getDeliveryIndexAfterGroup(
  groups: GroupedStop[],
  anchorGroupIndex: number
): number {
  if (groups.length === 0) return 0;
  const last = Math.max(0, Math.min(anchorGroupIndex, groups.length - 1));
  let count = 0;
  for (let i = 0; i <= last; i++) {
    count += groups[i].deliveries.length;
  }
  return count;
}

export type RouteLocateMatch = {
  stopIndex: number;
  delivery: EntregaListItem;
  sameStopDeliveries: EntregaListItem[];
  score: number;
};

/** Busca parcial por código ou id_saida; prioriza match exato, depois prefixo, depois contém. */
export function findInRouteByQuery(
  groups: GroupedStop[],
  query: string,
  maxResults = 8
): RouteLocateMatch[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const matches: RouteLocateMatch[] = [];

  for (let stopIndex = 0; stopIndex < groups.length; stopIndex++) {
    for (const delivery of groups[stopIndex].deliveries) {
      const codigo = (delivery.codigo ?? "").trim().toLowerCase();
      const idStr = String(delivery.id_saida);
      let score = 0;
      if (codigo === q || idStr === q) score = 100;
      else if (codigo.startsWith(q) || idStr.startsWith(q)) score = 50;
      else if (codigo.includes(q) || idStr.includes(q)) score = 10;
      if (score > 0) {
        matches.push({
          stopIndex,
          delivery,
          sameStopDeliveries: groups[stopIndex].deliveries,
          score,
        });
      }
    }
  }

  matches.sort((a, b) => b.score - a.score || a.stopIndex - b.stopIndex);
  const seen = new Set<number>();
  const deduped: RouteLocateMatch[] = [];
  for (const m of matches) {
    if (seen.has(m.delivery.id_saida)) continue;
    seen.add(m.delivery.id_saida);
    deduped.push(m);
    if (deduped.length >= maxResults) break;
  }
  return deduped;
}

export function getActiveGroupIndex(groupedStops: GroupedStop[], activeStopIndex: number): number {
  let idx = 0;
  for (let i = 0; i < groupedStops.length; i++) {
    if (activeStopIndex < idx + groupedStops[i].deliveries.length) return i;
    idx += groupedStops[i].deliveries.length;
  }
  return Math.max(0, groupedStops.length - 1);
}

/** Primeiro índice em routeOrder cujo pedido ainda está pendente. */
export function getFirstPendingRouteIndex(
  routeOrder: number[],
  statusMap: Record<number, RouteDeliveryStatus>
): number {
  for (let i = 0; i < routeOrder.length; i++) {
    if ((statusMap[routeOrder[i]] ?? "pendente") === "pendente") return i;
  }
  return routeOrder.length;
}

/** True se ainda há pedido pendente na ordem da rota. */
export function routeHasPendingDeliveries(
  routeOrder: number[],
  statusMap: Record<number, RouteDeliveryStatus>
): boolean {
  return getFirstPendingRouteIndex(routeOrder, statusMap) < routeOrder.length;
}

/** Grupo 0-based da parada operacional atual (primeira parada com pendentes). */
export function getEffectiveCurrentGroupIndex(
  groupedStops: GroupedStop[],
  statusMap: Record<number, RouteDeliveryStatus>,
  activeGroupIndex: number
): number {
  if (groupedStops.length === 0) return -1;
  if (
    activeGroupIndex >= 0 &&
    activeGroupIndex < groupedStops.length &&
    getGroupStatus(groupedStops[activeGroupIndex].deliveries, statusMap) === "pendente"
  ) {
    return activeGroupIndex;
  }
  const next = getNextPendingGroupIndex(groupedStops, statusMap, activeGroupIndex);
  return next >= 0 ? next : Math.max(0, groupedStops.length - 1);
}

export function getEffectiveCurrentGroupNumber(
  groupedStops: GroupedStop[],
  statusMap: Record<number, RouteDeliveryStatus>,
  activeGroupIndex: number
): number {
  const idx = getEffectiveCurrentGroupIndex(groupedStops, statusMap, activeGroupIndex);
  return idx >= 0 ? idx + 1 : 1;
}

export function getStopVolumesSummary(group: GroupedStop): string {
  const volumes = countRouteVolumes(group);
  const pedidos = new Set(group.deliveries.map((d) => d.id_saida)).size;
  if (pedidos > 1) return `📦 ${volumes} volume${volumes !== 1 ? "s" : ""} · ${pedidos} pedidos`;
  return `📦 ${volumes} volume${volumes !== 1 ? "s" : ""}`;
}

export type RouteDeliveryStatus = "pendente" | "entregue" | "ausente" | "cancelado";

/** Cores operacionais dos marcadores de parada na rota. */
export const ROUTE_STOP_MARKER_COLORS = {
  next: "#1565C0",
  current: "#198754",
  completed: "#9CA3AF",
  pending: "#64B5F6",
} as const;

export function getGroupStatus(
  deliveries: EntregaListItem[],
  statusMap: Record<number, RouteDeliveryStatus>
): RouteDeliveryStatus {
  const statuses = deliveries.map((d) => statusMap[d.id_saida] ?? "pendente");
  if (statuses.some((s) => s === "pendente")) return "pendente";
  if (statuses.every((s) => s === "entregue")) return "entregue";
  if (statuses.some((s) => s === "ausente")) return "ausente";
  if (statuses.every((s) => s === "cancelado")) return "cancelado";
  return "entregue";
}

export function isGroupCompleted(
  group: GroupedStop,
  statusMap: Record<number, RouteDeliveryStatus>
): boolean {
  return getGroupStatus(group.deliveries, statusMap) !== "pendente";
}

export function getPendingDeliveriesInGroup(
  group: GroupedStop,
  statusMap: Record<number, RouteDeliveryStatus>
): EntregaListItem[] {
  return group.deliveries.filter((d) => (statusMap[d.id_saida] ?? "pendente") === "pendente");
}

export function getFirstPendingInGroup(
  group: GroupedStop,
  statusMap: Record<number, RouteDeliveryStatus>
): EntregaListItem | undefined {
  return getPendingDeliveriesInGroup(group, statusMap)[0];
}

export function getStopAddressLineFromGroup(group: GroupedStop): string {
  return getStopAddressLine(group.representativeDelivery);
}

/** Índice 0-based da próxima parada com pedidos pendentes. */
export function getNextPendingGroupIndex(
  groupedStops: GroupedStop[],
  statusMap: Record<number, RouteDeliveryStatus>,
  activeGroupIndex: number
): number {
  if (groupedStops.length === 0) return -1;
  const start = activeGroupIndex >= 0 ? activeGroupIndex : 0;
  for (let i = start; i < groupedStops.length; i++) {
    if (getGroupStatus(groupedStops[i].deliveries, statusMap) === "pendente") return i;
  }
  for (let i = 0; i < start; i++) {
    if (getGroupStatus(groupedStops[i].deliveries, statusMap) === "pendente") return i;
  }
  return -1;
}

export function getStopMarkerOperationalState(
  groupIndex: number,
  groupedStops: GroupedStop[],
  statusMap: Record<number, RouteDeliveryStatus>,
  activeGroupIndex: number,
  isRouteActive: boolean
): { isCurrent: boolean; isNext: boolean; isCompleted: boolean } {
  const group = groupedStops[groupIndex];
  const isCompleted = group ? isGroupCompleted(group, statusMap) : false;
  const isCurrent = isRouteActive && activeGroupIndex >= 0 && groupIndex === activeGroupIndex && !isCompleted;
  const nextIdx = getNextPendingGroupIndex(groupedStops, statusMap, activeGroupIndex);
  const isNext = !isCompleted && nextIdx === groupIndex && !isCurrent;
  return { isCurrent, isNext, isCompleted };
}

export type StopDisplayCoord = {
  paradaIndex: number;
  latitude: number;
  longitude: number;
};

function coordDistanceDeg(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const dlat = Math.abs(a.latitude - b.latitude);
  const dlon = Math.abs(a.longitude - b.longitude);
  return Math.max(dlat, dlon);
}

/**
 * Desloca levemente marcadores de paradas distintas que compartilham coords ou ficam muito próximas,
 * evitando sobreposição visual sem alterar a sequência da rota.
 */
export function spreadOverlappingStopCoords(
  points: StopDisplayCoord[],
  thresholdDeg = 0.00012,
  offsetDeg = 0.00008
): StopDisplayCoord[] {
  if (points.length <= 1) return points;

  const result = points.map((p) => ({ ...p }));
  const used = new Set<number>();

  for (let i = 0; i < result.length; i++) {
    if (used.has(i)) continue;
    const clusterIdx = [i];
    used.add(i);
    for (let j = i + 1; j < result.length; j++) {
      if (used.has(j)) continue;
      if (coordDistanceDeg(result[i], result[j]) < thresholdDeg) {
        clusterIdx.push(j);
        used.add(j);
      }
    }
    if (clusterIdx.length <= 1) continue;

    clusterIdx.sort((a, b) => result[a].paradaIndex - result[b].paradaIndex);
    const centroidLat =
      clusterIdx.reduce((s, idx) => s + result[idx].latitude, 0) / clusterIdx.length;
    const centroidLon =
      clusterIdx.reduce((s, idx) => s + result[idx].longitude, 0) / clusterIdx.length;
    const n = clusterIdx.length;
    const startAngle = -Math.PI / 2;

    clusterIdx.forEach((idx, k) => {
      const angle = startAngle + (2 * Math.PI * k) / n;
      result[idx] = {
        ...result[idx],
        latitude: centroidLat + Math.sin(angle) * offsetDeg,
        longitude: centroidLon + Math.cos(angle) * offsetDeg,
      };
    });
  }

  return result;
}

export type RoutePoint = { latitude: number; longitude: number };

export function buildPendingRoutePoints(params: {
  groupedStops: GroupedStop[];
  activeGroupIndex: number;
  routeDeliveryStatus: Record<number, RouteDeliveryStatus>;
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>;
  geocodedMeta?: GeocodedMetaMap;
  legacyCache?: LegacyValidationCache;
  currentLocation?: { latitude: number; longitude: number } | null;
}): RoutePoint[] {
  const {
    groupedStops,
    activeGroupIndex,
    routeDeliveryStatus,
    geocodedCoords = {},
    geocodedMeta = {},
    legacyCache,
    currentLocation,
  } = params;

  const points: RoutePoint[] = [];

  if (currentLocation) {
    points.push({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    });
  }

  const startIdx = activeGroupIndex >= 0 ? activeGroupIndex : 0;

  for (let i = startIdx; i < groupedStops.length; i++) {
    const group = groupedStops[i];
    if (getGroupStatus(group.deliveries, routeDeliveryStatus) !== "pendente") continue;

    const dest = resolveGroupDestination(group, geocodedCoords, geocodedMeta, legacyCache);
    if (!dest.hasTrustedCoords || dest.latitude == null || dest.longitude == null) continue;
    points.push({ latitude: dest.latitude, longitude: dest.longitude });
  }

  return points;
}

/** Pontos da rota completa no planejamento (uma coordenada por parada agrupada). */
export function buildPlanningRoutePoints(params: {
  groupedStops: GroupedStop[];
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>;
  geocodedMeta?: GeocodedMetaMap;
  legacyCache?: LegacyValidationCache;
}): RoutePoint[] {
  const { groupedStops, geocodedCoords = {}, geocodedMeta = {}, legacyCache } = params;
  const points: RoutePoint[] = [];

  for (const group of groupedStops) {
    const dest = resolveGroupDestination(group, geocodedCoords, geocodedMeta, legacyCache);
    if (!dest.hasTrustedCoords || dest.latitude == null || dest.longitude == null) continue;
    points.push({ latitude: dest.latitude, longitude: dest.longitude });
  }

  return points;
}
