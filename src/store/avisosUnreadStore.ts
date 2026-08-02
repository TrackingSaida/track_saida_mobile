import { create } from "zustand";
import { listAvisos } from "../features/avisos/api";

type AvisosUnreadState = {
  unreadCount: number;
  refresh: () => Promise<void>;
};

export const useAvisosUnreadStore = create<AvisosUnreadState>((set) => ({
  unreadCount: 0,
  refresh: async () => {
    try {
      const items = await listAvisos();
      set({ unreadCount: items.filter((i) => !i.lido).length });
    } catch {
      // mantém o valor anterior em falha de rede
    }
  },
}));
