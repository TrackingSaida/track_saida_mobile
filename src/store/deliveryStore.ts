import { create } from "zustand";
import type { EntregaListItem } from "../features/entregas/types";
import {
  getEntregas,
  putEndereco,
  iniciarRota,
  marcarEntregue,
  marcarAusente,
  type EnderecoBody,
} from "../features/entregas/api";

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

  loadDeliveries: () => Promise<void>;
  saveAddress: (idSaida: number, body: EnderecoBody) => Promise<EntregaListItem>;
  startRoute: (deliveryIds?: number[]) => Promise<number>;
  suggestRoute: (fromLat?: number, fromLon?: number) => void;
  markDelivered: (idSaida: number) => Promise<void>;
  markAbsent: (idSaida: number, motivoId: number, observacao?: string) => Promise<void>;
  setSelectedDelivery: (d: EntregaListItem | null) => void;
  setMapMode: (mode: MapMode) => void;
  clearSuggestedOrder: () => void;
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
      set({ error: message, loading: false });
    }
  },

  saveAddress: async (idSaida, body) => {
    const updated = await putEndereco(idSaida, body);
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

  markDelivered: async (idSaida) => {
    await marcarEntregue(idSaida);
    set((state) => ({
      pendingDeliveries: state.pendingDeliveries.filter((d) => d.id_saida !== idSaida),
      deliveriesWithAddress: state.deliveriesWithAddress.filter((d) => d.id_saida !== idSaida),
      deliveriesWithoutAddress: state.deliveriesWithoutAddress.filter((d) => d.id_saida !== idSaida),
      selectedDelivery: state.selectedDelivery?.id_saida === idSaida ? null : state.selectedDelivery,
    }));
  },

  markAbsent: async (idSaida, motivoId, observacao) => {
    await marcarAusente(idSaida, motivoId, observacao);
    set((state) => ({
      pendingDeliveries: state.pendingDeliveries.filter((d) => d.id_saida !== idSaida),
      deliveriesWithAddress: state.deliveriesWithAddress.filter((d) => d.id_saida !== idSaida),
      deliveriesWithoutAddress: state.deliveriesWithoutAddress.filter((d) => d.id_saida !== idSaida),
      selectedDelivery: state.selectedDelivery?.id_saida === idSaida ? null : state.selectedDelivery,
    }));
  },

  setSelectedDelivery: (d) => set({ selectedDelivery: d }),
  setMapMode: (mode) => set({ mapMode: mode }),
  clearSuggestedOrder: () => set({ suggestedOrder: null }),
}));
