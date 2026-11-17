import { create } from "zustand";

/**
 * Epoch incrementado após confirmarSaidaSessoes com sucesso.
 * Home (e outras UIs) escutam para zerar banner stale e refetch.
 */
type SaidaConfirmacaoUiState = {
  epoch: number;
  markConfirmed: () => void;
};

export const useSaidaConfirmacaoUiStore = create<SaidaConfirmacaoUiState>((set) => ({
  epoch: 0,
  markConfirmed: () => set((s) => ({ epoch: s.epoch + 1 })),
}));
