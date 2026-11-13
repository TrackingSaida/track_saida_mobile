import { Alert } from "react-native";
import { AxiosError } from "axios";

const chavesPorTentativa = new Map<string, string>();

/** Uma chave por tentativa. O retry da mesma tentativa reutiliza o valor já gerado. */
export function chaveDaTentativa(tentativaId: string): string {
  const atual = chavesPorTentativa.get(tentativaId);
  if (atual) return atual;
  const chave = `saida-${tentativaId}-${Math.random().toString(36).slice(2, 10)}`;
  chavesPorTentativa.set(tentativaId, chave);
  return chave;
}

export function encerrarTentativa(tentativaId: string): void {
  chavesPorTentativa.delete(tentativaId);
}

export function idTentativaConfirmacao(input?: {
  sessao_ids?: number[];
  ids_removidos?: number[];
}): string {
  const sessoes = [...(input?.sessao_ids ?? [])].sort((a, b) => a - b).join(",");
  const removidos = [...(input?.ids_removidos ?? [])].sort((a, b) => a - b).join(",");
  return `confirmar:${sessoes}|${removidos}`;
}

export function pedirConfirmacaoContextual(total: number): Promise<boolean> {
  const n = Math.max(0, Math.floor(total));
  const corpo =
    n === 1
      ? "Você ainda não começou a entrega deste pacote. Confirmar 1 pacote e continuar?"
      : `Você ainda não começou a entrega destes pacotes. Confirmar ${n} pacotes e continuar?`;
  return new Promise((resolve) => {
    Alert.alert("Começar entrega", corpo, [
      { text: "Agora não", style: "cancel", onPress: () => resolve(false) },
      { text: "Confirmar e continuar", onPress: () => resolve(true) },
    ]);
  });
}

export class ConfirmacaoCanceladaError extends Error {
  constructor() {
    super("A ação não continuou porque a saída ainda não foi confirmada.");
    this.name = "ConfirmacaoCanceladaError";
  }
}

export function isSaidaNaoConfirmada(error: unknown): boolean {
  const ax = error as AxiosError<{ detail?: { code?: string } | string; code?: string }>;
  if (ax.response?.status !== 409) return false;
  const data = ax.response.data;
  if (!data || typeof data !== "object") return false;
  const detail = data.detail;
  if (detail && typeof detail === "object" && detail.code === "SAIDA_NAO_CONFIRMADA") return true;
  return data.code === "SAIDA_NAO_CONFIRMADA";
}
