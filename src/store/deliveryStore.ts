import { create } from "zustand";
import type { EntregaListItem } from "../features/entregas/types";
import {
  getEntregas,
  getTodayISO,
  putEndereco,
  iniciarRota,
  marcarEntregue,
  marcarAusente,
  postNovaTentativa,
  postRotasIniciar,
  postRotasOtimizar,
  getRotasAtiva,
  postRotasAvancar,
  postRotasFinalizar,
  type EnderecoBody,
  type EntregueBody,
  type RotasAtivaResponse,
} from "../features/entregas/api";
import { geocodeAddress } from "../features/entregas/utils/geocode";
import {
  flattenGroupsToRouteOrder,
  getOrderedRouteDeliveries,
  groupOrderedByAddress,
  moveGroupInOrder,
} from "../features/entregas/utils/routeUtils";
import { startBackgroundTracking, stopBackgroundTracking } from "../services/location/locationService";
import { useMotoboyPrefsStore } from "./motoboyPrefsStore";

export type MapMode = "list" | "map";

export type CurrentLocation = {
  latitude: number;
  longitude: number;
  heading?: number;
};

export type RouteOptimizationMode = "osrm_trip" | "nearest_fallback" | "local_fallback" | null;

export type OptimizeRouteResult = {
  ok: boolean;
  mode: RouteOptimizationMode;
  semCoordenadas: number[];
  message: "success" | "partial" | "local_fallback" | "noop";
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

  loadDeliveries: (opts?: { onlyToday?: boolean }) => Promise<void>;
  saveAddress: (idSaida: number, body: EnderecoBody) => Promise<EntregaListItem>;
  startRoute: (deliveryIds?: number[]) => Promise<number>;
  suggestRoute: (fromLat?: number, fromLon?: number) => void;
  markDelivered: (idSaida: number, body?: EntregueBody) => Promise<void>;
  markAbsent: (idSaida: number, motivoId: number, observacao?: string) => Promise<void>;
  setSelectedDelivery: (d: EntregaListItem | null) => void;
  setMapMode: (mode: MapMode) => void;
  clearSuggestedOrder: () => void;

  setRouteDeliveries: (deliveries: EntregaListItem[]) => void;
  clearRoute: () => void;
  /** Limpa rota ativa e dados locais (logout ou quando backend não retorna rota ativa). */
  clearActiveRouteState: () => void;
  optimizeRoute: (fromLat?: number, fromLon?: number) => Promise<OptimizeRouteResult>;
  reorderRoute: (order: number[]) => void;
  setRouteDeliveryStatus: (idSaida: number, status: "pendente" | "entregue" | "ausente") => void;
  removeFromRoute: (idSaidas: number[]) => void;
  moveGroupedStopToIndex: (fromStopIndex: number, toStopIndex: number) => void;
  moveGroupedStopToStart: (stopIndex: number) => void;
  moveGroupedStopToEnd: (stopIndex: number) => void;
  updateRouteDelivery: (idSaida: number, partial: Partial<EntregaListItem>) => void;
  findInRouteByCodigo: (codigo: string) => { stopIndex: number; delivery: EntregaListItem } | null;
  appendToRoute: (deliveries: EntregaListItem[]) => void;

  /** Inicia rota persistida com routeOrder atual; retorna rota_id. */
  startActiveRoute: () => Promise<string>;
  completeStop: () => Promise<void>;
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
    if (body.latitude == null || body.longitude == null) {
      const parts = [body.rua, body.numero, body.bairro, body.cidade, body.estado].filter(Boolean);
      const address = parts.join(", ");
      const coords = await geocodeAddress(address, {
        cidade: body.cidade,
        estado: body.estado,
        bairro: body.bairro,
        numero: body.numero,
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
      const msg =
        err && typeof err === "object" && "response" in err && err.response && typeof err.response === "object" && "data" in err.response && err.response.data && typeof err.response.data === "object" && "detail" in err.response.data
          ? String((err.response.data as { detail?: unknown }).detail)
          : err instanceof Error
            ? err.message
            : "Não foi possível salvar o endereço.";
      throw new Error(msg);
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
    const { parada_atual } = await postRotasAvancar(activeRouteId);
    set({ activeStopIndex: parada_atual });
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
    const prefOnlyToday = useMotoboyPrefsStore.getState().somenteHojePendentes;
    const paramsHoje = prefOnlyToday ? { dia: "hoje" as const, data: getTodayISO() } : undefined;
    const [pendentes, finalizadas, ausentes] = await Promise.all([
      getEntregas("pendente", paramsHoje),
      getEntregas("finalizadas", paramsHoje),
      getEntregas("ausentes", paramsHoje),
    ]);
    const byId = new Map<number, EntregaListItem>();
    [...pendentes, ...finalizadas, ...ausentes].forEach((d) => byId.set(d.id_saida, d));
    const deliveries: EntregaListItem[] = [];
    const routeDeliveryStatus: Record<number, "pendente" | "entregue" | "ausente"> = {};
    for (const id of payload.ordem) {
      const d = byId.get(id);
      if (d) {
        deliveries.push(d);
        routeDeliveryStatus[d.id_saida] =
          d.exibicao === "Entregue" ? "entregue" : d.exibicao === "Ausente" ? "ausente" : "pendente";
      }
    }
    set({
      activeRouteId: payload.rota_id,
      routeOrder: payload.ordem,
      activeStopIndex: payload.parada_atual,
      routeDeliveries: deliveries,
      routeDeliveryStatus,
    });
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
    await marcarEntregue(idSaida, body);
    set((state) => ({
      pendingDeliveries: state.pendingDeliveries.filter((d) => d.id_saida !== idSaida),
      deliveriesWithAddress: state.deliveriesWithAddress.filter((d) => d.id_saida !== idSaida),
      deliveriesWithoutAddress: state.deliveriesWithoutAddress.filter((d) => d.id_saida !== idSaida),
      selectedDelivery: state.selectedDelivery?.id_saida === idSaida ? null : state.selectedDelivery,
      routeDeliveryStatus: { ...state.routeDeliveryStatus, [idSaida]: "entregue" as const },
    }));
  },

  markAbsent: async (idSaida, motivoId, observacao) => {
    await marcarAusente(idSaida, motivoId, observacao);
    set((state) => ({
      pendingDeliveries: state.pendingDeliveries.filter((d) => d.id_saida !== idSaida),
      deliveriesWithAddress: state.deliveriesWithAddress.filter((d) => d.id_saida !== idSaida),
      deliveriesWithoutAddress: state.deliveriesWithoutAddress.filter((d) => d.id_saida !== idSaida),
      selectedDelivery: state.selectedDelivery?.id_saida === idSaida ? null : state.selectedDelivery,
      routeDeliveryStatus: { ...state.routeDeliveryStatus, [idSaida]: "ausente" as const },
    }));
  },

  setSelectedDelivery: (d) => set({ selectedDelivery: d }),
  setMapMode: (mode) => set({ mapMode: mode }),
  clearSuggestedOrder: () => set({ suggestedOrder: null }),

  setRouteDeliveries: (deliveries) => {
    const state = get();
    if (state.activeRouteId != null) {
      return;
    }
    const order = deliveries.map((d) => d.id_saida);
    const routeDeliveryStatus: Record<number, "pendente" | "entregue" | "ausente"> = {};
    deliveries.forEach((d) => {
      routeDeliveryStatus[d.id_saida] = "pendente";
    });
    set({ routeDeliveries: deliveries, routeOrder: order, routeDeliveryStatus });
  },
  clearRoute: () => set({ routeDeliveries: [], routeOrder: [], routeDeliveryStatus: {} }),
  clearActiveRouteState: () => {
    stopBackgroundTracking().catch(() => {});
    set({
      activeRouteId: null,
      activeStopIndex: 0,
      routeDeliveries: [],
      routeOrder: [],
      routeDeliveryStatus: {},
      currentLocation: null,
    });
  },
  optimizeRoute: async (fromLat?, fromLon?) => {
    const { routeDeliveries, routeOrder, activeRouteId } = get();
    const noop: OptimizeRouteResult = {
      ok: false,
      mode: null,
      semCoordenadas: [],
      message: "noop",
    };
    if (activeRouteId != null || routeOrder.length === 0) return noop;

    const deliveryIds = [...routeOrder];
    const start =
      fromLat != null && fromLon != null
        ? { latitude: fromLat, longitude: fromLon }
        : undefined;

    try {
      const res = await postRotasOtimizar(deliveryIds, start);
      const semCoordenadas = res.sem_coordenadas ?? [];
      const message: OptimizeRouteResult["message"] =
        semCoordenadas.length > 0 ? "partial" : "success";
      set({
        routeOrder: res.ordem,
        routeOptimizationMode: res.modo,
      });
      return {
        ok: true,
        mode: res.modo,
        semCoordenadas,
        message,
      };
    } catch {
      const orderedIds = optimizeRouteLocal(routeDeliveries, routeOrder, fromLat, fromLon);
      set({
        routeOrder: orderedIds,
        routeOptimizationMode: "local_fallback",
      });
      const semCoordenadas = routeDeliveries
        .filter((d) => d.latitude == null || d.longitude == null)
        .map((d) => d.id_saida);
      return {
        ok: true,
        mode: "local_fallback",
        semCoordenadas,
        message: "local_fallback",
      };
    }
  },
  reorderRoute: (order) => {
    if (get().activeRouteId != null) return;
    set({ routeOrder: order });
  },
  setRouteDeliveryStatus: (idSaida, status) =>
    set((state) => ({ routeDeliveryStatus: { ...state.routeDeliveryStatus, [idSaida]: status } })),
  removeFromRoute: (idSaidas) => {
    if (get().activeRouteId != null) return;
    const removeSet = new Set(idSaidas);
    set((state) => {
      const nextStatus = { ...state.routeDeliveryStatus };
      for (const id of idSaidas) delete nextStatus[id];
      return {
        routeDeliveries: state.routeDeliveries.filter((d) => !removeSet.has(d.id_saida)),
        routeOrder: state.routeOrder.filter((id) => !removeSet.has(id)),
        routeDeliveryStatus: nextStatus,
      };
    });
  },
  moveGroupedStopToIndex: (fromStopIndex, toStopIndex) => {
    if (get().activeRouteId != null) return;
    const { routeDeliveries, routeOrder } = get();
    const ordered = getOrderedRouteDeliveries(routeDeliveries, routeOrder);
    const groups = groupOrderedByAddress(ordered);
    if (fromStopIndex < 0 || fromStopIndex >= groups.length) return;
    const to = Math.max(0, Math.min(toStopIndex, groups.length - 1));
    const reordered = moveGroupInOrder(groups, fromStopIndex, to);
    set({ routeOrder: flattenGroupsToRouteOrder(reordered) });
  },
  moveGroupedStopToStart: (stopIndex) => {
    get().moveGroupedStopToIndex(stopIndex, 0);
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
          return { stopIndex, delivery };
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
      return {
        routeDeliveries: [...state.routeDeliveries, ...newOnes],
        routeOrder: [...state.routeOrder, ...newOnes.map((d) => d.id_saida)],
        routeDeliveryStatus: nextStatus,
      };
    });
  },
}));
