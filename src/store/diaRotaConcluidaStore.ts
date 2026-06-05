import { create } from "zustand";

export const VALOR_DIA_LABEL_PREVISTO = "Valor previsto hoje";

export interface DiaRotaConcluidaStats {
  entregues: number;
  ausentes: number;
  total: number;
  pendentes: number;
  motoboyNome?: string;
  valorDia: string;
  valorLabel: string;
}

interface DiaRotaConcluidaState {
  visible: boolean;
  stats: DiaRotaConcluidaStats | null;
  playCelebration: boolean;
  open: (stats: DiaRotaConcluidaStats) => void;
  close: () => void;
  consumeCelebration: () => void;
}

export const useDiaRotaConcluidaStore = create<DiaRotaConcluidaState>((set) => ({
  visible: false,
  stats: null,
  playCelebration: false,
  open: (stats) => set({ visible: true, stats, playCelebration: true }),
  close: () => set({ visible: false, stats: null, playCelebration: false }),
  consumeCelebration: () => set({ playCelebration: false }),
}));
