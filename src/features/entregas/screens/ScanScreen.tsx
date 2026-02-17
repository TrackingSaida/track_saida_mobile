import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { scanCodigo, assumirEntrega } from "../api";

type Props = NativeStackScreenProps<RootStackParamList, "Scan">;

export default function ScanScreen({ navigation }: Props) {
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [conflito, setConflito] = useState<{ motoboy_atual: string; id_saida: number } | null>(null);
  const [assumindo, setAssumindo] = useState(false);

  const handleScan = async () => {
    const c = codigo.trim();
    if (!c) {
      Alert.alert("Atenção", "Digite o código.");
      return;
    }
    setLoading(true);
    setConflito(null);
    try {
      const result = await scanCodigo(c);
      if (result.conflito) {
        setConflito({ motoboy_atual: result.motoboy_atual, id_saida: result.id_saida });
      } else {
        Alert.alert("Sucesso", "Entrega atribuída.", [
          { text: "Ver entrega", onPress: () => navigation.navigate("EntregaDetail", { idSaida: result.entrega.id_saida }) },
          { text: "Continuar", onPress: () => { setCodigo(""); } },
        ]);
      }
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Código não encontrado ou erro ao processar.";
      Alert.alert("Erro", String(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleAssumir = async () => {
    if (!conflito) return;
    setAssumindo(true);
    try {
      await assumirEntrega(conflito.id_saida);
      setConflito(null);
      Alert.alert("Sucesso", "Entrega assumida.", [
        { text: "Ver entrega", onPress: () => navigation.navigate("EntregaDetail", { idSaida: conflito.id_saida }) },
        { text: "Continuar", onPress: () => { setCodigo(""); } },
      ]);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Erro ao assumir.";
      Alert.alert("Erro", String(msg));
    } finally {
      setAssumindo(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Escanear</Text>
        <Text style={styles.subtitle}>Digite o código da entrega</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Código"
        value={codigo}
        onChangeText={setCodigo}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />

      <TouchableOpacity
        style={[styles.btnScan, loading && styles.btnDisabled]}
        onPress={handleScan}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnScanText}>Confirmar</Text>
        )}
      </TouchableOpacity>

      <Modal visible={!!conflito} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Conflito</Text>
            <Text style={styles.modalMessage}>
              Pedido já atribuído ao motoboy {conflito?.motoboy_atual}. Deseja assumir?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setConflito(null)}
                disabled={assumindo}
              >
                <Text style={styles.modalBtnCancelText}>Não</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnOk, assumindo && styles.btnDisabled]}
                onPress={handleAssumir}
                disabled={assumindo}
              >
                {assumindo ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalBtnOkText}>Sim, assumir</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5", padding: 24, paddingTop: 48 },
  header: { marginBottom: 32 },
  backText: { fontSize: 16, color: "#0d6efd", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, color: "#666", marginTop: 4 },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 24,
  },
  btnScan: {
    backgroundColor: "#198754",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnScanText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 12, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  modalMessage: { fontSize: 16, color: "#333", marginBottom: 24 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  modalBtnCancel: { paddingVertical: 12, paddingHorizontal: 24 },
  modalBtnCancelText: { color: "#666", fontSize: 16 },
  modalBtnOk: { backgroundColor: "#0d6efd", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8 },
  modalBtnOkText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});
