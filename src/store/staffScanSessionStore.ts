import { create } from "zustand";

export interface StaffLeituraSessionItem {
  codigo: string;
  servico?: string | null;
  entregador: string;
  motoboyId: number;
  status: "sucesso" | "nao_coletado" | "erro" | "alterado";
}

interface StaffScanSessionState {
  motoboyId: number | null;
  motoboyNome: string;
  leituras: StaffLeituraSessionItem[];
  /** true após Confirmar Leitura com sucesso (até nova leitura). */
  confirmada: boolean;
  setMotoboy: (id: number, nome: string) => void;
  /** Sincroniza tela → store (restauração ao reabrir). */
  syncSession: (payload: {
    motoboyId: number | null;
    motoboyNome: string;
    leituras: StaffLeituraSessionItem[];
  }) => void;
  markConfirmada: () => void;
  /** Após confirmar: zera leituras e mantém motoboy. */
  archivarAposConfirmar: () => void;
  clearSession: () => void;
  podeTrocarMotoboy: () => boolean;
}

function temLeiturasValidasNaoConfirmadas(state: {
  confirmada: boolean;
  leituras: StaffLeituraSessionItem[];
}): boolean {
  if (state.confirmada) return false;
  return state.leituras.some((l) => l.status !== "erro");
}

export const useStaffScanSessionStore = create<StaffScanSessionState>((set, get) => ({
  motoboyId: null,
  motoboyNome: "",
  leituras: [],
  confirmada: false,

  setMotoboy: (id, nome) =>
    set((state) => {
      if (state.motoboyId === id) {
        return { motoboyNome: nome || state.motoboyNome };
      }
      return {
        motoboyId: id,
        motoboyNome: nome || "",
        leituras: [],
        confirmada: false,
      };
    }),

  syncSession: ({ motoboyId, motoboyNome, leituras }) =>
    set((state) => {
      const sameMotoboy = state.motoboyId === motoboyId;
      const grew =
        leituras.length > state.leituras.length ||
        (!sameMotoboy && leituras.length > 0);
      return {
        motoboyId,
        motoboyNome: motoboyNome || "",
        leituras,
        confirmada: grew ? false : state.confirmada && sameMotoboy && leituras.length === 0,
      };
    }),

  markConfirmada: () => set({ confirmada: true }),

  archivarAposConfirmar: () =>
    set((state) => ({
      leituras: [],
      confirmada: true,
      motoboyId: state.motoboyId,
      motoboyNome: state.motoboyNome,
    })),

  clearSession: () =>
    set({
      motoboyId: null,
      motoboyNome: "",
      leituras: [],
      confirmada: false,
    }),

  podeTrocarMotoboy: () => !temLeiturasValidasNaoConfirmadas(get()),
}));

export function staffSessionTemPendenciaConfirmacao(): boolean {
  return temLeiturasValidasNaoConfirmadas(useStaffScanSessionStore.getState());
}
