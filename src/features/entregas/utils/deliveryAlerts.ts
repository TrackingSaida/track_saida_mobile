import { useToastStore } from "../../../store/toastStore";

const SYNC_PENDING_SUFFIX =
  " Ainda enviando ao servidor. Acompanhe o aviso no topo — não marque de novo.";

function showToast(
  title: string,
  message: string,
  tone: "success" | "warn" = "success"
): void {
  useToastStore.getState().show({ title, message, tone, durationMs: pendingToneDuration(tone) });
}

function pendingToneDuration(tone: "success" | "warn"): number {
  return tone === "warn" ? 2800 : 1600;
}

export function alertEntregaFinalizada(
  codigo: string | null | undefined,
  onOk?: () => void,
  pendingSync?: boolean
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  if (pendingSync) {
    showToast("Enviando entrega", `${cod}.${SYNC_PENDING_SUFFIX}`, "warn");
  } else {
    showToast("Entrega finalizada", `${cod} marcada como entregue.`, "success");
  }
  onOk?.();
}

export function alertAusenciaRegistrada(
  codigo: string | null | undefined,
  onOk?: () => void,
  pendingSync?: boolean
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  if (pendingSync) {
    showToast("Enviando ausência", `${cod}.${SYNC_PENDING_SUFFIX}`, "warn");
  } else {
    showToast("Ausência registrada", `${cod} marcado como ausente.`, "warn");
  }
  onOk?.();
}

export function alertEntregaAtrasadaConcluida(
  codigo: string | null | undefined,
  tipo: "entregue" | "ausente",
  onOk?: () => void,
  pendingSync?: boolean
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  if (pendingSync) {
    const titulo = tipo === "entregue" ? "Enviando entrega" : "Enviando ausência";
    showToast(titulo, `${cod}.${SYNC_PENDING_SUFFIX}`, "warn");
  } else {
    const titulo = tipo === "entregue" ? "Entrega atrasada concluída" : "Ausência atrasada registrada";
    const baseMsg =
      tipo === "entregue"
        ? `${cod} foi finalizado com sucesso.`
        : `${cod} foi marcado como ausente.`;
    showToast(titulo, baseMsg, tipo === "entregue" ? "success" : "warn");
  }
  onOk?.();
}

export function alertDevolucaoFeita(
  codigo: string | null | undefined,
  nomeSubBase: string | null | undefined,
  onOk?: () => void,
  pendingSync?: boolean
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  const base = (nomeSubBase || "base").trim() || "base";
  if (pendingSync) {
    showToast("Enviando devolução", `${cod}.${SYNC_PENDING_SUFFIX}`, "warn");
  } else {
    showToast("Devolução feita", `${cod} devolvido à ${base}.`, "success");
  }
  onOk?.();
}
