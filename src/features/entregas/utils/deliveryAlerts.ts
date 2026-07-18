import { Alert } from "react-native";

const SYNC_PENDING_SUFFIX =
  " Salva no aparelho. Será enviada quando a internet voltar.";

export function alertEntregaFinalizada(
  codigo: string | null | undefined,
  onOk?: () => void,
  pendingSync?: boolean
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  const suffix = pendingSync ? SYNC_PENDING_SUFFIX : ".";
  Alert.alert("✅ Entrega finalizada", `${cod} marcada como entregue${suffix}`, [
    { text: "OK", onPress: onOk },
  ]);
}

export function alertAusenciaRegistrada(
  codigo: string | null | undefined,
  onOk?: () => void,
  pendingSync?: boolean
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  const suffix = pendingSync ? SYNC_PENDING_SUFFIX : ".";
  Alert.alert("⚠️ Ausência registrada", `${cod} marcado como ausente${suffix}`, [
    { text: "OK", onPress: onOk },
  ]);
}

export function alertEntregaAtrasadaConcluida(
  codigo: string | null | undefined,
  tipo: "entregue" | "ausente",
  onOk?: () => void,
  pendingSync?: boolean
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  const titulo = tipo === "entregue" ? "✅ Entrega atrasada concluída" : "⚠️ Ausência atrasada registrada";
  const baseMsg =
    tipo === "entregue"
      ? `${cod} foi finalizado com sucesso.`
      : `${cod} foi marcado como ausente.`;
  const msg = pendingSync ? `${baseMsg}${SYNC_PENDING_SUFFIX}` : baseMsg;
  Alert.alert(titulo, msg, [{ text: "OK", onPress: onOk }]);
}
