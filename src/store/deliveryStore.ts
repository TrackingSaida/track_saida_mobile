import { create } from "zustand";
import type {
  EntregaListItem,
  FinalizarLoteBody,
  FinalizarLoteResponse,
  MarcacaoEntregaResponse,
} from "../features/entregas/types";
import {
  getEntregas,
  getEntrega,
  getTodayISO,
  putEndereco,
  iniciarRota,
  marcarEntregue,
  marcarAusente,
  finalizarLote,
  postNovaTentativa,
  postRotasIniciar,
  postRotasOtimizar,
  getRotasAtiva,
  postRotasAvancar,
  postRotasFinalizar,
  putRotasOrdem,
  type EnderecoBody,
  type EntregueBody,
  type RotasAtivaResponse,
} from "../features/entregas/api";
import { geocodeAddressFromValues, isValidGeocodeCoords } from "../features/entregas/utils/geocode";
import {
  clusterRouteOrderByAddress,
  flattenGroupsToRouteOrder,
  getActiveGroupIndex,
  getFirstPendingRouteIndex,
  getOrderedRouteDeliveries,
  groupOrderedByAddress,
  moveGroupInOrder,
} from "../features/entregas/utils/routeUtils";
import { formatApiError } from "../utils/formatApiError";
import { startBackgroundTracking, stopBackgroundTracking } from "../services/location/locationService";
import { useMotoboyPrefsStore } from "./motoboyPrefsStore";
import {
  toApiPriorityPayload,
  optimizeStopsSoftPriority,
  estimateRouteDistanceKm,
  type RoutePriority,
} from "../features/entregas/utils/routePriority";

export type MapMode = "list" | "map";

export type CurrentLocation = {
  latitude: number;
  longitude: number;
  heading?: number;
};

export type RouteOptimizationMode =
  | "osrm_trip"
  | "nearest_fallback"
  | "priority_soft"
  | "local_fallback"
  | null;

export type OptimizeRouteResult = {
  ok: boolean;
  mode: RouteOptimizationMode;
  semCoordenadas: number[];
  message: "success" | "partial" | "local_fallback" | "noop";
};

export type OptimizeRouteOptions = {
  fromLat?: number;
  fromLon?: number;
  fromDeliveryIndex?: number;
  persistActive?: boolean;
};

interface DeliveryState {
  pendingDeliveries: EntregaListItem[];
  deliveriesWithAddress: EntregaListItem[];
  deliveriesWithoutAddress: EntregaListItem[];
  selectedDelivery: EntregaListItem | null;
  routeStarted: boolean;
  mapMode: MapMode;
  /** Ordem sugerida por proximidade (id_saida). Quando definido, lista/mapa usam esta ordem. */
  suggestedOrder: number[] | null;
  loading: boolean;
  error: string | null;

  /** Entregas da rota em construção (tela RouteBuilder). */
  routeDeliveries: EntregaListItem[];
  /** Ordem dos id_saida na rota. */
  routeOrder: number[];
  /** Status por id_saida na rota: pendente | entregue | ausente (para mapa/lista). */
  routeDeliveryStatus: Record<number, "pendente" | "entregue" | "ausente">;

  /** ID da rota ativa persistida no backend (null quando não há rota ativa). */
  activeRouteId: string | null;
  /** Índice 0-based da próxima parada na rota ativa. */
  activeStopIndex: number;

  /** Localização atual do motoboy (atualizada pelo rastreamento em background quando rota ativa). */
  currentLocation: CurrentLocation | null;
  setCurrentLocation: (location: CurrentLocation | null) => void;

  /** Modo da última otimização de rota (backend ou fallback local). */
  routeOptimizationMode: RouteOptimizationMode;
  /** Distância total da última otimização (metros), quando disponível via OSRM. */
  routeDistanceM: number | null;
  /** Duração total da última otimização (segundos), quando disponível via OSRM. */
  routeDurationS: number | null;

  loadDeliveries: (opts?: { onlyToday?: boolean }) => Promise<void>;
  saveAddress: (idSaida: number, body: EnderecoBody) => Promise<EntregaListItem>;
  startRoute: (deliveryIds?: number[]) => Promise<number>;
  suggestRoute: (fromLat?: number, fromLon?: number) => void;
  markDelivered: (idSaida: number, body?: EntregueBody) => Promise<MarcacaoEntregaResponse>;
  markAbsent: (idSaida: number, motivoId: number, observacao?: string) => Promise<MarcacaoEntregaResponse>;
  finalizePendingBatch: (body: FinalizarLoteBody) => Promise<FinalizarLoteResponse>;
  setSelectedDelivery: (d: EntregaListItem | null) => void;
  setMapMode: (mode: MapMode) => void;
  clearSuggestedOrder: () => void;

  setRouteDeliveries: (deliveries: EntregaListItem[]) => void;
  clearRoute: () => void;
  /** Limpa rota ativa e dados locais (logout ou quando backend não retorna rota ativa). */
  clearActiveRouteState: () => void;
  optimizeRoute: (opts?: OptimizeRouteOptions) => Promise<OptimizeRouteResult>;
  reorderRoute: (order: number[]) => void;
  setRouteDeliveryStatus: (idSaida: number, status: "pendente" | "entregue" | "ausente") => void;
  removeFromRoute: (idSaidas: number[]) => void;
  moveGroupedStopToIndex: (fromStopIndex: number, toStopIndex: number) => void;
  moveGroupedStopToStart: (stopIndex: number) => void;
  moveGroupedStopToEnd: (stopIndex: number) => void;
  updateRouteDelivery: (idSaida: number, partial: Partial<EntregaListItem>) => void;
  findInRouteByCodigo: (
    codigo: string
  ) => { stopIndex: number; delivery: EntregaListItem; sameStopDeliveries: EntregaListItem[] } | null;
  appendToRoute: (deliveries: EntregaListItem[]) => void;

  /** Inicia rota persistida com routeOrder atual; retorna rota_id. */
  startActiveRoute: () => Promise<string>;
  completeStop: () => Promise<void>;
  syncActiveStopIndex: () => void;
  finishRoute: () => Promise<void>;
  restoreActiveRoute: (payload: RotasAtivaResponse) => Promise<void>;
  novaTentativa: (idSaida: number) => Promise<void>;
}

function withAddress(d: EntregaListItem): boolean {
  return d.possui_endereco === true;
}

function distSq(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dlat = lat1 - lat2;
  const dlon = lon1 - lon2;
  return dlat * dlat + dlon * dlon;
}

function routeStatusFromExibicao(exibicao: string): "pendente" | "entregue" | "ausente" {
  if (exibicao === "Entregue") return "entregue";
  if (exibicao === "Ausente") return "ausente";
  return "pendente";
}

function optimizeRouteLocal(
  routeDeliveries: EntregaListItem[],
  routeOrder: number[],
  fromLat?: number,
  fromLon?: number
): number[] {
  const withCoords = routeDeliveries.filter((d) => d.latitude != null && d.longitude != null);
  const withoutCoords = routeDeliveries.filter((d) => d.latitude == null || d.longitude == null);
  let refLat = fromLat;
  let refLon = fromLon;
  if (refLat == null || refLon == null) {
    const first = routeDeliveries.find((d) => d.id_saida === routeOrder[0]) ?? withCoords[0];
    refLat = first?.latitude ?? 0;
    refLon = first?.longitude ?? 0;
  }
  const sortedWithCoords: EntregaListItem[] = [];
  const remaining = [...withCoords];
  let curLat = refLat;
  let curLon = refLon;
  while (remaining.length > 0) {
    let nearestIdx = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = remaining[i];
      const d2 = distSq(curLat, curLon, d.latitude!, d.longitude!);
      if (d2 < nearestDist) {
        nearestDist = d2;
        nearestIdx = i;
      }
    }
    if (nearestIdx === -1) break;
    const next = remaining.splice(nearestIdx, 1)[0];
    sortedWithCoords.push(next);
    curLat = next.latitude!;
    curLon = next.longitude!;
  }
  const withoutIds = withoutCoords.map((d) => d.id_saida);
  const withoutSet = new Set(withoutIds);
  const orderedWithout = routeOrder.filter((id) => withoutSet.has(id));
  const missingWithout = withoutIds.filter((id) => !orderedWithout.includes(id));
  return sortedWithCoords.map((d) => d.id_saida).concat(orderedWithout, missingWithout);
}

async function persistActiveRouteOrder(
  activeRouteId: string,
  routeOrder: number[]
): Promise<void> {
  await putRotasOrdem(activeRouteId, routeOrder);
}

export const useDeliveryStore = create<DeliveryState>((set, get) => ({
  pendingDeliveries: [],
  deliveriesWithAddress: [],
  deliveriesWithoutAddress: [],
  selectedDelivery: null,
  routeStarted: false,
  mapMode: "list",
  suggestedOrder: null,
  loading: false,
  error: null,
  routeDeliveries: [],
  routeOrder: [],
  routeDeliveryStatus: {},
  activeRouteId: null,
  activeStopIndex: 0,
  currentLocation: null,
  routeOptimizationMode: null,
  routeDistanceM: null,
  routeDurationS: null,
  setCurrentLocation: (location) => set({ currentLocation: location }),

  loadDeliveries: async (opts) => {
    set({ loading: true, error: null });
    try {
      const prefOnlyToday = useMotoboyPrefsStore.getState().somenteHojePendentes;
      const useOnlyToday = opts?.onlyToday ?? prefOnlyToday;
      const list = await getEntregas(
        "pendente",
        useOnlyToday ? { dia: "hoje", data: getTodayISO() } : undefined
      );
      const withAddr = list.filter(withAddress);
      const withoutAddr = list.filter((d) => !withAddress(d));
      set({
        pendingDeliveries: list,
        deliveriesWithAddress: withAddr,
        deliveriesWithoutAddress: withoutAddr,
        suggestedOrder: null,
        loading: false,
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro ao carregar entregas";
      set({
        error: message,
        loading: false,
        pendingDeliveries: [],
        deliveriesWithAddress: [],
        deliveriesWithoutAddress: [],
      });
    }
  },

  saveAddress: async (idSaida, body) => {
    let finalBody = body;
    if (!isValidGeocodeCoords(body.latitude, body.longitude)) {
      const coords = await geocodeAddressFromValues({
        rua: body.rua,
        numero: body.numero,
        bairro: body.bairro,
        cidade: body.cidade,
        estado: body.estado,
        cep: body.cep,
      });
      if (coords) {
        finalBody = { ...body, latitude: coords.latitude, longitude: coords.longitude };
      }
    }
    try {
      const updated = await putEndereco(idSaida, finalBody);
      set((state) => {
        const list = state.pendingDeliveries.map((d) => (d.id_saida === idSaida ? updated : d));
        const withAddr = list.filter(withAddress);
        const withoutAddr = list.filter((d) => !withAddress(d));
        return {
          pendingDeliveries: list,
          deliveriesWithAddress: withAddr,
          deliveriesWithoutAddress: withoutAddr,
          selectedDelivery: state.selectedDelivery?.id_saida === idSaida ? updated : state.selectedDelivery,
        };
      });
      return updated;
    } catch (err: unknown) {
      throw new Error(formatApiError(err, "Não foi possível salvar o endereço."));
    }
  },

  startRoute: async (deliveryIds) => {
    const { atualizados } = await iniciarRota(deliveryIds);
    set({ routeStarted: true });
    await get().loadDeliveries();
    return atualizados;
  },

  startActiveRoute: async () => {
    const { routeOrder } = get();
    if (routeOrder.length === 0) throw new Error("Nenhuma entrega na rota.");
    const { rota_id } = await postRotasIniciar(routeOrder);
    set({
      activeRouteId: rota_id,
      activeStopIndex: 0,
      routeStarted: true,
    });
    await startBackgroundTracking();
    await get().loadDeliveries();
    return rota_id;
  },

  completeStop: async () => {
    const { activeRouteId } = get();
    if (!activeRouteId) return;
    await postRotasAvancar(activeRouteId);
    get().syncActiveStopIndex();
  },

  syncActiveStopIndex: () => {
    const { activeRouteId, routeOrder, routeDeliveryStatus } = get();
    if (!activeRouteId || routeOrder.length === 0) return;
    const idx = getFirstPendingRouteIndex(routeOrder, routeDeliveryStatus);
    set({ activeStopIndex: idx });
  },

  finishRoute: async () => {
    const { activeRouteId } = get();
    if (!activeRouteId) return;
    await stopBackgroundTracking();
    await postRotasFinalizar(activeRouteId);
    set({
      activeRouteId: null,
      activeStopIndex: 0,
      routeDeliveries: [],
      routeOrder: [],
      routeDeliveryStatus: {},
      currentLocation: null,
    });
  },

  novaTentativa: async (idSaida) => {
    await postNovaTentativa(idSaida);
    await get().loadDeliveries();
    get().clearActiveRouteState();
  },

  restoreActiveRoute: async (payload) => {
    const state = get();
    const existingById = new Map(state.routeDeliveries.map((d) => [d.id_saida, d]));
    const [pendentes, finalizadas, ausentes] = await Promise.all([
      getEntregas("pendente"),
      getEntregas("finalizadas"),
      getEntregas("ausentes"),
    ]);
    const freshListIds = new Set<number>();
    const byId = new Map<number, EntregaListItem>();
    for (const d of [...pendentes, ...finalizadas, ...ausentes]) {
      byId.set(d.id_saida, d);
      freshListIds.add(d.id_saida);
    }
    existingById.forEach((d, id) => {
      if (!byId.has(id)) byId.set(id, d);
    });
    const missingIds = payload.ordem.filter((id) => !byId.has(id));
    if (missingIds.length > 0) {
      const fetched = await Promise.all(
        missingIds.map((id) => getEntrega(id).catch(() => null))
      );
      for (const d of fetched) {
        if (d) {
          byId.set(d.id_saida, d);
          freshListIds.add(d.id_saida);
        }
      }
    }
    const deliveries: EntregaListItem[] = [];
    const routeDeliveryStatus: Record<number, "pendente" | "entregue" | "ausente"> = {};
    for (const id of payload.ordem) {
      const d = byId.get(id);
      if (!d) continue;
      deliveries.push(d);
      if (freshListIds.has(id)) {
        routeDeliveryStatus[id] = routeStatusFromExibicao(d.exibicao);
      } else {
        routeDeliveryStatus[id] =
          state.routeDeliveryStatus[id] ?? routeStatusFromExibicao(d.exibicao);
      }
    }
    set({
      activeRouteId: payload.rota_id,
      routeOrder: payload.ordem,
      activeStopIndex: payload.parada_atual,
      routeDeliveries: deliveries,
      routeDeliveryStatus,
    });
    get().syncActiveStopIndex();
    await startBackgroundTracking();
  },

  suggestRoute: (fromLat?, fromLon?) => {
    const { pendingDeliveries } = get();
    const withCoords = pendingDeliveries.filter((d) => d.latitude != null && d.longitude != null);
    const withoutCoords = pendingDeliveries.filter((d) => d.latitude == null || d.longitude == null);
    let refLat = fromLat;
    let refLon = fromLon;
    if (refLat == null || refLon == null) {
      if (withCoords.length > 0) {
        refLat = withCoords[0].latitude!;
        refLon = withCoords[0].longitude!;
      } else {
        set({ suggestedOrder: pendingDeliveries.map((d) => d.id_saida) });
        return;
      }
    }
    const sorted = [...withCoords].sort(
      (a, b) =>
        distSq(refLat!, refLon!, a.latitude!, a.longitude!) -
        distSq(refLat!, refLon!, b.latitude!, b.longitude!)
    );
    const orderedIds = sorted.map((d) => d.id_saida);
    withoutCoords.forEach((d) => orderedIds.push(d.id_saida));
    set({ suggestedOrder: orderedIds });
  },

  markDelivered: async (idSaida, body) => {
    const response = await marcarEntregue(idSaida, body);
    set((state) => ({
      pendingDeliveries: state.pendingDeliveries.filter((d) => d.id_saida !== idSaida),
      deliveriesWithAddress: state.deliveriesWithAddress.filter((d) => d.id_saida !== idSaida),
      deliveriesWithoutAddress: state.deliveriesWithoutAddress.filter((d) => d.id_saida !== idSaida),
      selectedDelivery: state.selectedDelivery?.id_saida === idSaida ? null : state.selectedDelivery,
      routeDeliveries: state.routeDeliveries.map((d) =>
        d.id_saida === idSaida ? { ...d, exibicao: "Entregue", status: "Entregue" } : d
      ),
      routeDeliveryStatus: { ...state.routeDeliveryStatus, [idSaida]: "entregue" as const },
    }));
    if (get().activeRouteId) get().syncActiveStopIndex();
    return response;
  },

  markAbsent: async (idSaida, motivoId, observacao) => {
    const response = await marcarAusente(idSaida, motivoId, observacao);
    set((state) => ({
      pendingDeliveries: state.pendingDeliveries.filter((d) => d.id_saida !== idSaida),
      deliveriesWithAddress: state.deliveriesWithAddress.filter((d) => d.id_saida !== idSaida),
      deliveriesWithoutAddress: state.deliveriesWithoutAddress.filter((d) => d.id_saida !== idSaida),
      selectedDelivery: state.selectedDelivery?.id_saida === idSaida ? null : state.selectedDelivery,
      routeDeliveries: state.routeDeliveries.map((d) =>
        d.id_saida === idSaida ? { ...d, exibicao: "Ausente", status: "Ausente" } : d
      ),
      routeDeliveryStatus: { ...state.routeDeliveryStatus, [idSaida]: "ausente" as const },
    }));
    if (get().activeRouteId) get().syncActiveStopIndex();
    return response;
  },

  finalizePendingBatch: async (body) => {
    const response = await finalizarLote(body);
    const finalizedIds = new Set(response.finalizados.map((f) => f.id_saida));
    if (finalizedIds.size > 0) {
      set((state) => ({
        pendingDeliveries: state.pendingDeliveries.filter((d) => !finalizedIds.has(d.id_saida)),
        deliveriesWithAddress: state.deliveriesWithAddress.filter((d) => !finalizedIds.has(d.id_saida)),
        deliveriesWithoutAddress: state.deliveriesWithoutAddress.filter((d) => !finalizedIds.has(d.id_saida)),
        selectedDelivery:
          state.selectedDelivery && finalizedIds.has(state.selectedDelivery.id_saida)
            ? null
            : state.selectedDelivery,
      }));
    }
    return response;
  },

  setSelectedDelivery: (d) => set({ selectedDelivery: d }),
  setMapMode: (mode) => set({ mapMode: mode }),
  clearSuggestedOrder: () => set({ suggestedOrder: null }),

  setRouteDeliveries: (deliveries) => {
    const state = get();
    if (state.activeRouteId != null) {
      return;
    }
    const order = clusterRouteOrderByAddress(
      deliveries,
      deliveries.map((d) => d.id_saida)
    );
    const routeDeliveryStatus: Record<number, "pendente" | "entregue" | "ausente"> = {};
    deliveries.forEach((d) => {
      routeDeliveryStatus[d.id_saida] = "pendente";
    });
    set({ routeDeliveries: deliveries, routeOrder: order, routeDeliveryStatus });
  },
  clearRoute: () =>
    set({
      routeDeliveries: [],
      routeOrder: [],
      routeDeliveryStatus: {},
      routeOptimizationMode: null,
      routeDistanceM: null,
      routeDurationS: null,
    }),
  clearActiveRouteState: () => {
    stopBackgroundTracking().catch(() => {});
    set({
      activeRouteId: null,
      activeStopIndex: 0,
      routeDeliveries: [],
      routeOrder: [],
      routeDeliveryStatus: {},
      currentLocation: null,
      routeOptimizationMode: null,
      routeDistanceM: null,
      routeDurationS: null,
    });
  },
  optimizeRoute: async (opts) => {
    const { routeDeliveries, routeOrder, activeRouteId, activeStopIndex } = get();
    const noop: OptimizeRouteResult = {
      ok: false,
      mode: null,
      semCoordenadas: [],
      message: "noop",
    };
    if (routeOrder.length === 0) return noop;

    const fromIndex =
      opts?.fromDeliveryIndex ?? (activeRouteId != null ? activeStopIndex : 0);
    const prefix = routeOrder.slice(0, fromIndex);
    const suffix = routeOrder.slice(fromIndex);
    const idsForApi = activeRouteId != null ? suffix : routeOrder;

    if (idsForApi.length < 2) return noop;

    const start =
      opts?.fromLat != null && opts?.fromLon != null
        ? { latitude: opts.fromLat, longitude: opts.fromLon }
        : undefined;

    const applyOrder = async (
      newSuffix: number[],
      mode: RouteOptimizationMode,
      message: OptimizeRouteResult["message"],
      semCoordenadas: number[],
      stats?: { distanceM: number | null; durationS: number | null }
    ) => {
      let newOrder = activeRouteId != null ? [...prefix, ...newSuffix] : newSuffix;
      newOrder = clusterRouteOrderByAddress(routeDeliveries, newOrder);
      set({
        routeOrder: newOrder,
        routeOptimizationMode: mode,
        routeDistanceM: stats?.distanceM ?? null,
        routeDurationS: stats?.durationS ?? null,
      });
      if (activeRouteId != null && opts?.persistActive !== false) {
        await persistActiveRouteOrder(activeRouteId, newOrder);
      }
      return { ok: true, mode, semCoordenadas, message } as OptimizeRouteResult;
    };

    const routePriority: RoutePriority = useMotoboyPrefsStore.getState().routePriority;
    const apiPriority = toApiPriorityPayload(routePriority);

    try {
      const res = await postRotasOtimizar(idsForApi, start, apiPriority);
      const semCoordenadas = res.sem_coordenadas ?? [];
      const message: OptimizeRouteResult["message"] =
        semCoordenadas.length > 0 ? "partial" : "success";
      return applyOrder(res.ordem, res.modo, message, semCoordenadas, {
        distanceM: res.distancia_total_m ?? null,
        durationS: res.duracao_total_s ?? null,
      });
    } catch {
      const suffixDeliveries = getOrderedRouteDeliveries(
        routeDeliveries.filter((d) => suffix.includes(d.id_saida)),
        suffix
      );
      const orderedIds =
        routePriority.type !== "none"
          ? optimizeStopsSoftPriority(
              suffixDeliveries,
              suffix,
              routePriority,
              opts?.fromLat,
              opts?.fromLon
            )
          : optimizeRouteLocal(
              suffixDeliveries,
              suffix,
              opts?.fromLat,
              opts?.fromLon
            );
      const semCoordenadas = suffixDeliveries
        .filter((d) => d.latitude == null || d.longitude == null)
        .map((d) => d.id_saida);
      const distKm = estimateRouteDistanceKm(suffixDeliveries, orderedIds);
      const mode: RouteOptimizationMode =
        routePriority.type !== "none" ? "priority_soft" : "local_fallback";
      return applyOrder(orderedIds, mode, "local_fallback", semCoordenadas, {
        distanceM: Math.round(distKm * 1000),
        durationS: Math.round((distKm / 30) * 3600),
      });
    }
  },
  reorderRoute: (order) => {
    const { activeRouteId, activeStopIndex, routeOrder } = get();
    if (activeRouteId != null) {
      const prefix = routeOrder.slice(0, activeStopIndex);
      if (order.slice(0, activeStopIndex).join(",") !== prefix.join(",")) return;
    }
    set({ routeOrder: order });
    if (activeRouteId != null) {
      void persistActiveRouteOrder(activeRouteId, order);
    }
  },
  setRouteDeliveryStatus: (idSaida, status) =>
    set((state) => ({ routeDeliveryStatus: { ...state.routeDeliveryStatus, [idSaida]: status } })),
  removeFromRoute: (idSaidas) => {
    const { activeRouteId } = get();
    const removeSet = new Set(idSaidas);
    let nextOrder: number[] = [];
    set((state) => {
      const nextStatus = { ...state.routeDeliveryStatus };
      for (const id of idSaidas) delete nextStatus[id];
      nextOrder = state.routeOrder.filter((id) => !removeSet.has(id));
      return {
        routeDeliveries: state.routeDeliveries.filter((d) => !removeSet.has(d.id_saida)),
        routeOrder: nextOrder,
        routeDeliveryStatus: nextStatus,
      };
    });
    if (activeRouteId != null) {
      void persistActiveRouteOrder(activeRouteId, nextOrder);
    }
  },
  moveGroupedStopToIndex: (fromStopIndex, toStopIndex) => {
    const { routeDeliveries, routeOrder, activeRouteId, activeStopIndex } = get();
    const ordered = getOrderedRouteDeliveries(routeDeliveries, routeOrder);
    const groups = groupOrderedByAddress(ordered);
    const minGroup =
      activeRouteId != null ? getActiveGroupIndex(groups, activeStopIndex) : 0;
    if (fromStopIndex < minGroup || fromStopIndex >= groups.length) return;
    const to = Math.max(minGroup, Math.min(toStopIndex, groups.length - 1));
    const reordered = moveGroupInOrder(groups, fromStopIndex, to);
    const newOrder = flattenGroupsToRouteOrder(reordered);
    set({ routeOrder: newOrder });
    if (activeRouteId != null) {
      void persistActiveRouteOrder(activeRouteId, newOrder);
    }
  },
  moveGroupedStopToStart: (stopIndex) => {
    const { routeDeliveries, routeOrder, activeRouteId, activeStopIndex } = get();
    let target = 0;
    if (activeRouteId != null) {
      const ordered = getOrderedRouteDeliveries(routeDeliveries, routeOrder);
      const groups = groupOrderedByAddress(ordered);
      target = getActiveGroupIndex(groups, activeStopIndex);
    }
    get().moveGroupedStopToIndex(stopIndex, target);
  },
  moveGroupedStopToEnd: (stopIndex) => {
    const { routeDeliveries, routeOrder } = get();
    const ordered = getOrderedRouteDeliveries(routeDeliveries, routeOrder);
    const groups = groupOrderedByAddress(ordered);
    get().moveGroupedStopToIndex(stopIndex, groups.length - 1);
  },
  updateRouteDelivery: (idSaida, partial) => {
    set((state) => ({
      routeDeliveries: state.routeDeliveries.map((d) =>
        d.id_saida === idSaida ? { ...d, ...partial } : d
      ),
    }));
  },
  findInRouteByCodigo: (codigo) => {
    const normalized = codigo.trim().toLowerCase();
    if (!normalized) return null;
    const { routeDeliveries, routeOrder } = get();
    const ordered = getOrderedRouteDeliveries(routeDeliveries, routeOrder);
    const groups = groupOrderedByAddress(ordered);
    for (let stopIndex = 0; stopIndex < groups.length; stopIndex++) {
      for (const delivery of groups[stopIndex].deliveries) {
        if ((delivery.codigo ?? "").trim().toLowerCase() === normalized) {
          return {
            stopIndex,
            delivery,
            sameStopDeliveries: groups[stopIndex].deliveries,
          };
        }
      }
    }
    return null;
  },
  appendToRoute: (deliveries) => {
    if (get().activeRouteId != null) return;
    set((state) => {
      const existingIds = new Set(state.routeOrder);
      const newOnes = deliveries.filter((d) => !existingIds.has(d.id_saida));
      if (newOnes.length === 0) return state;
      const nextStatus = { ...state.routeDeliveryStatus };
      for (const d of newOnes) nextStatus[d.id_saida] = "pendente";
      const routeDeliveries = [...state.routeDeliveries, ...newOnes];
      const routeOrder = clusterRouteOrderByAddress(routeDeliveries, [
        ...state.routeOrder,
        ...newOnes.map((d) => d.id_saida),
      ]);
      return {
        routeDeliveries,
        routeOrder,
        routeDeliveryStatus: nextStatus,
      };
    });
  },
}));
