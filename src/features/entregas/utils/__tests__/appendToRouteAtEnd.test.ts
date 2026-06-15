import assert from "node:assert/strict";
import { test } from "node:test";
import type { EntregaListItem } from "../../types";

test("appendToRouteAtEnd preserva ordem e adiciona no fim", async () => {
  const { create } = await import("zustand");

  type MiniState = {
    activeRouteId: string | null;
    routeDeliveries: EntregaListItem[];
    routeOrder: number[];
    routeDeliveryStatus: Record<number, "pendente">;
    appendToRouteAtEnd: (deliveries: EntregaListItem[]) => void;
  };

  const useMini = create<MiniState>((set, get) => ({
    activeRouteId: null,
    routeDeliveries: [
      { id_saida: 10, possui_endereco: true, latitude: 1, longitude: 1 },
      { id_saida: 20, possui_endereco: true, latitude: 2, longitude: 2 },
    ] as EntregaListItem[],
    routeOrder: [10, 20],
    routeDeliveryStatus: { 10: "pendente", 20: "pendente" },
    appendToRouteAtEnd: (deliveries) => {
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

  const newDelivery = {
    id_saida: 30,
    possui_endereco: true,
    latitude: 3,
    longitude: 3,
  } as EntregaListItem;

  useMini.getState().appendToRouteAtEnd([newDelivery]);
  const { routeOrder } = useMini.getState();
  assert.deepEqual(routeOrder, [10, 20, 30]);
});
