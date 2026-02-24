import { create } from "zustand";
import type { EntregaListItem } from "../features/entregas/types";
import {
  getEntregas,
  putEndereco,
  iniciarRota,
  marcarEntregue,
  marcarAusente,
  postNovaTentativa,
  postRotasIniciar,
  getRotasAtiva,
  postRotasAvancar,
  postRotasFinalizar,
  type EnderecoBody,
  type EntregueBody,
  type RotasAtivaResponse,
} from "../features/entregas/api";
import { geocodeAddress } from "../features/entregas/utils/geocode";

export type MapMode = "list" | "map";

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

  loadDeliveries: () => Promise<void>;
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
  optimizeRoute: (fromLat?: number, fromLon?: number) => void;
  reorderRoute: (order: number[]) => void;
  setRouteDeliveryStatus: (idSaida: number, status: "pendente" | "entregue" | "ausente") => void;

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

  loadDeliveries: async () => {
    set({ loading: true, error: null });
    try {
      const list = await getEntregas("pendente");
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
    await postRotasFinalizar(activeRouteId);
    set({
      activeRouteId: null,
      activeStopIndex: 0,
      routeDeliveries: [],
      routeOrder: [],
      routeDeliveryStatus: {},
    });
  },

  novaTentativa: async (idSaida) => {
    await postNovaTentativa(idSaida);
    await get().loadDeliveries();
    get().clearActiveRouteState();
  },

  restoreActiveRoute: async (payload) => {
    const [pendentes, finalizadas, ausentes] = await Promise.all([
      getEntregas("pendente"),
      getEntregas("finalizadas"),
      getEntregas("ausentes"),
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
  clearActiveRouteState: () =>
    set({
      activeRouteId: null,
      activeStopIndex: 0,
      routeDeliveries: [],
      routeOrder: [],
      routeDeliveryStatus: {},
    }),
  optimizeRoute: (fromLat?, fromLon?) => {
    const { routeDeliveries, routeOrder, activeRouteId } = get();
    if (activeRouteId != null || routeOrder.length === 0) return;
    const withCoords = routeDeliveries.filter((d) => d.latitude != null && d.longitude != null);
    const withoutCoords = routeDeliveries.filter((d) => d.latitude == null || d.longitude == null);
    const byId = new Map(routeDeliveries.map((d) => [d.id_saida, d]));
    let refLat = fromLat;
    let refLon = fromLon;
    if (refLat == null || refLon == null) {
      const firstId = routeOrder[0];
      const first = byId.get(firstId);
      refLat = first?.latitude ?? 0;
      refLon = first?.longitude ?? 0;
      if (withCoords.length > 0 && (first?.latitude == null || first?.longitude == null)) {
        refLat = withCoords[0].latitude!;
        refLon = withCoords[0].longitude!;
      }
    }
    const orderedIds: number[] = [];
    const remaining = new Set(withCoords.map((d) => d.id_saida));
    let curLat = refLat;
    let curLon = refLon;
    while (remaining.size > 0) {
      let nearestId = -1;
      let nearestDist = Infinity;
      for (const id of remaining) {
        const d = byId.get(id)!;
        const d2 = distSq(curLat, curLon, d.latitude!, d.longitude!);
        if (d2 < nearestDist) {
          nearestDist = d2;
          nearestId = id;
        }
      }
      if (nearestId === -1) break;
      remaining.delete(nearestId);
      orderedIds.push(nearestId);
      const next = byId.get(nearestId)!;
      curLat = next.latitude!;
      curLon = next.longitude!;
    }
    withoutCoords.forEach((d) => orderedIds.push(d.id_saida));
    set({ routeOrder: orderedIds });
  },
  reorderRoute: (order) => {
    if (get().activeRouteId != null) return;
    set({ routeOrder: order });
  },
  setRouteDeliveryStatus: (idSaida, status) =>
    set((state) => ({ routeDeliveryStatus: { ...state.routeDeliveryStatus, [idSaida]: status } })),
}));
