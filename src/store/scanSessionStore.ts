import { create } from "zustand";

export interface LeituraSession {
  id_saida: number;
  codigo: string;
  servico: "Shopee" | "Flex" | "Avulso";
}

interface ScanSessionState {
  leituras: LeituraSession[];
  rotaIniciada: boolean;
  setLeituras: (leituras: LeituraSession[]) => void;
  addLeitura: (leitura: LeituraSession) => void;
  removeLeitura: (id_saida: number) => void;
  clearLeituras: () => void;
  setRotaIniciada: (value: boolean) => void;
  /** Chama ao entrar no Scan: se rota foi iniciada antes, limpa sessão e reseta flag. */
  clearSessionIfRotaIniciada: () => void;
}

export const useScanSessionStore = create<ScanSessionState>((set) => ({
  leituras: [],
  rotaIniciada: false,

  setLeituras: (leituras) => set({ leituras }),

  addLeitura: (leitura) =>
    set((state) => {
      if (state.leituras.some((l) => l.id_saida === leitura.id_saida)) return state;
      return { leituras: [...state.leituras, leitura] };
    }),

  removeLeitura: (id_saida) =>
    set((state) => ({
      leituras: state.leituras.filter((l) => l.id_saida !== id_saida),
    })),

  clearLeituras: () => set({ leituras: [] }),

  setRotaIniciada: (value) => set({ rotaIniciada: value }),

  clearSessionIfRotaIniciada: () =>
    set((state) => {
      if (state.rotaIniciada) {
        return { leituras: [], rotaIniciada: false };
      }
      return state;
    }),
}));
