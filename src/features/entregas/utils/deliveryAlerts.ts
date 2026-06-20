import { Alert } from "react-native";

export function alertEntregaFinalizada(codigo: string | null | undefined, onOk?: () => void): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  Alert.alert("✅ Entrega finalizada", `${cod} marcada como entregue.`, [
    { text: "OK", onPress: onOk },
  ]);
}

export function alertAusenciaRegistrada(codigo: string | null | undefined, onOk?: () => void): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  Alert.alert("⚠️ Ausência registrada", `${cod} marcado como ausente.`, [
    { text: "OK", onPress: onOk },
  ]);
}

export function alertEntregaAtrasadaConcluida(
  codigo: string | null | undefined,
  tipo: "entregue" | "ausente",
  onOk?: () => void
): void {
  const cod = (codigo || "Pedido").trim() || "Pedido";
  const titulo = tipo === "entregue" ? "✅ Entrega atrasada concluída" : "⚠️ Ausência atrasada registrada";
  const msg =
    tipo === "entregue"
      ? `${cod} foi finalizado com sucesso.`
      : `${cod} foi marcado como ausente.`;
  Alert.alert(titulo, msg, [{ text: "OK", onPress: onOk }]);
}
