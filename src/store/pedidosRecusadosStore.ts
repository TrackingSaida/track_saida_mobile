import { create } from "zustand";
import { listPedidosRecusados } from "../features/operacao/pedidosRecusadosApi";
import { isAdminRole } from "../utils/role";
import { useAuthStore } from "./authStore";

type PedidosRecusadosState = {
  total: number;
  hydrated: boolean;
  refresh: () => Promise<void>;
  clear: () => void;
};

export const usePedidosRecusadosStore = create<PedidosRecusadosState>((set) => ({
  total: 0,
  hydrated: false,
  clear: () => set({ total: 0, hydrated: false }),
  refresh: async () => {
    const role = useAuthStore.getState().currentUser?.role as number | undefined;
    if (!isAdminRole(role)) {
      set({ total: 0, hydrated: true });
      return;
    }
    try {
      const res = await listPedidosRecusados();
      set({ total: res.total, hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
}));
