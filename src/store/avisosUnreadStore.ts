import { create } from "zustand";
import { listAvisos } from "../features/avisos/api";
import { playSound } from "../utils/sound";

type AvisosUnreadState = {
  unreadCount: number;
  /** Evita tocar som no primeiro carregamento da sessão. */
  hydrated: boolean;
  refresh: (opts?: { playOnIncrease?: boolean }) => Promise<void>;
};

export const useAvisosUnreadStore = create<AvisosUnreadState>((set, get) => ({
  unreadCount: 0,
  hydrated: false,
  refresh: async (opts) => {
    const playOnIncrease = opts?.playOnIncrease !== false;
    try {
      const items = await listAvisos();
      const next = items.filter((i) => !i.lido).length;
      const prev = get().unreadCount;
      const hydrated = get().hydrated;
      set({ unreadCount: next, hydrated: true });
      if (playOnIncrease && hydrated && next > prev) {
        void playSound("warn");
      }
    } catch {
      // mantém o valor anterior em falha de rede
    }
  },
}));
