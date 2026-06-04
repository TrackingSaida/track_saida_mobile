import { create } from "zustand";

export interface DiaRotaConcluidaStats {
  entregues: number;
  ausentes: number;
  total: number;
  pendentes: number;
}

interface DiaRotaConcluidaState {
  visible: boolean;
  stats: DiaRotaConcluidaStats | null;
  open: (stats: DiaRotaConcluidaStats) => void;
  close: () => void;
}

export const useDiaRotaConcluidaStore = create<DiaRotaConcluidaState>((set) => ({
  visible: false,
  stats: null,
  open: (stats) => set({ visible: true, stats }),
  close: () => set({ visible: false, stats: null }),
}));
