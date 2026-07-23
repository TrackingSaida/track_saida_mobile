import { useToastStore } from "../../../store/toastStore";

const SYNC_PENDING_SUFFIX =
  " Salva no aparelho. Será enviada quando a internet voltar.";

function showToast(
  title: string,
  message: string,
  tone: "success" | "warn" = "success"
): void {
  useToastStore.getState().show({ title, message, tone, durationMs: 1600 });
}

export function alertEntregaFinalizada(
  codigo: string | null | undefined,
  onOk?: () => void,
  pendingSync?: boolean
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  const suffix = pendingSync ? SYNC_PENDING_SUFFIX : ".";
  showToast("Entrega finalizada", `${cod} marcada como entregue${suffix}`, "success");
  onOk?.();
}

export function alertAusenciaRegistrada(
  codigo: string | null | undefined,
  onOk?: () => void,
  pendingSync?: boolean
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  const suffix = pendingSync ? SYNC_PENDING_SUFFIX : ".";
  showToast("Ausência registrada", `${cod} marcado como ausente${suffix}`, "warn");
  onOk?.();
}

export function alertEntregaAtrasadaConcluida(
  codigo: string | null | undefined,
  tipo: "entregue" | "ausente",
  onOk?: () => void,
  pendingSync?: boolean
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  const titulo = tipo === "entregue" ? "Entrega atrasada concluída" : "Ausência atrasada registrada";
  const baseMsg =
    tipo === "entregue"
      ? `${cod} foi finalizado com sucesso.`
      : `${cod} foi marcado como ausente.`;
  const msg = pendingSync ? `${baseMsg}${SYNC_PENDING_SUFFIX}` : baseMsg;
  showToast(titulo, msg, tipo === "entregue" ? "success" : "warn");
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
  const suffix = pendingSync ? SYNC_PENDING_SUFFIX : ".";
  showToast("Devolução feita", `${cod} devolvido à ${base}${suffix}`, "success");
  onOk?.();
}
