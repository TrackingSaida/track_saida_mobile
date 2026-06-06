import { create } from "zustand";

export const VALOR_DIA_LABEL = "Valor do dia";
export const VALOR_ROTA_LABEL = "Valor da rota";

export type CompletionVariant = "day" | "route";

export interface DayCompletionStats {
  variant: "day";
  entregues: number;
  ausentes: number;
  total: number;
  pendentes: number;
  valorDia: string;
  valorLabel: string;
}

export interface RouteCompletionStats {
  variant: "route";
  paradas: number;
  pedidos: number;
  entregues: number;
  ausentes: number;
  pendentes: number;
  valorRota: string;
  valorLabel: string;
}

export type CompletionStats = DayCompletionStats | RouteCompletionStats;

interface DiaRotaConcluidaState {
  visible: boolean;
  stats: CompletionStats | null;
  playCelebration: boolean;
  open: (stats: CompletionStats) => void;
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

// Compat: export antigo usado em testes legados
export const VALOR_DIA_LABEL_PREVISTO = VALOR_DIA_LABEL;
