import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { getEntrega, getMotivosAusencia, marcarEntregue, marcarAusente } from "../api";
import type { EntregaListItem, MotivoAusencia } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "EntregaDetail">;

export default function EntregaDetailScreen({ route, navigation }: Props) {
  const { idSaida } = route.params;
  const [entrega, setEntrega] = useState<EntregaListItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalAusente, setModalAusente] = useState(false);
  const [motivos, setMotivos] = useState<MotivoAusencia[]>([]);
  const [motivoId, setMotivoId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [e, m] = await Promise.all([getEntrega(idSaida), getMotivosAusencia()]);
      setEntrega(e);
      setMotivos(m);
      if (m.length) setMotivoId(m[0].id);
    } catch {
      setEntrega(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [idSaida]);

  const handleEntregue = async () => {
    setSaving(true);
    try {
      await marcarEntregue(idSaida);
      Alert.alert("Sucesso", "Entrega marcada como entregue.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Erro ao salvar.";
      Alert.alert("Erro", String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleAbrirAusente = () => setModalAusente(true);

  const handleConfirmarAusente = async () => {
    if (motivoId == null) {
      Alert.alert("Atenção", "Selecione um motivo.");
      return;
    }
    const motivo = motivos.find((m) => m.id === motivoId);
    if (motivo?.descricao.trim().toLowerCase() === "outro" && !observacao.trim()) {
      Alert.alert("Atenção", "Informe a observação quando o motivo for 'Outro'.");
      return;
    }
    setSaving(true);
    try {
      await marcarAusente(idSaida, motivoId, observacao.trim() || undefined);
      setModalAusente(false);
      setObservacao("");
      Alert.alert("Sucesso", "Entrega marcada como ausente.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "response" in e
        ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : "Erro ao salvar.";
      Alert.alert("Erro", String(msg));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !entrega) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const telefone = entrega.contato?.replace(/\D/g, "") || "";
  const linkTel = telefone.length >= 10 ? `tel:+55${telefone}` : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Detalhe da entrega</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Código</Text>
        <Text style={styles.value}>{entrega.codigo || "—"}</Text>

        <Text style={styles.label}>Cliente</Text>
        <Text style={styles.value}>{entrega.cliente || "—"}</Text>

        <Text style={styles.label}>Endereço</Text>
        <Text style={styles.value}>{entrega.endereco || "—"}</Text>
        {entrega.bairro ? <Text style={styles.valueSec}>{entrega.bairro}</Text> : null}

        <Text style={styles.label}>Telefone</Text>
        {linkTel ? (
          <TouchableOpacity onPress={() => Linking.openURL(linkTel)}>
            <Text style={styles.link}>{entrega.contato || "—"}</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.value}>{entrega.contato || "—"}</Text>
        )}
      </View>

      <TouchableOpacity
        style={[styles.btnEntregue, saving && styles.btnDisabled]}
        onPress={handleEntregue}
        disabled={saving}
      >
        <Text style={styles.btnEntregueText}>
          {saving ? "Salvando…" : "Marcar como entregue"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btnAusente, saving && styles.btnDisabled]}
        onPress={handleAbrirAusente}
        disabled={saving}
      >
        <Text style={styles.btnAusenteText}>Marcar como ausente</Text>
      </TouchableOpacity>

      <Modal visible={modalAusente} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Motivo da ausência</Text>
            {motivos.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.radio, motivoId === m.id && styles.radioActive]}
                onPress={() => setMotivoId(m.id)}
              >
                <Text style={styles.radioText}>{m.descricao}</Text>
              </TouchableOpacity>
            ))}
            {motivoId !== null && motivos.find((m) => m.id === motivoId)?.descricao.trim().toLowerCase() === "outro" && (
              <TextInput
                style={styles.input}
                placeholder="Observação (obrigatório)"
                value={observacao}
                onChangeText={setObservacao}
                multiline
              />
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalAusente(false)}>
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtnOk} onPress={handleConfirmarAusente} disabled={saving}>
                <Text style={styles.modalBtnOkText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { marginBottom: 16 },
  backText: { fontSize: 16, color: "#0d6efd", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  label: { fontSize: 12, color: "#666", marginTop: 12, marginBottom: 4 },
  value: { fontSize: 16, color: "#333" },
  valueSec: { fontSize: 14, color: "#666", marginTop: 2 },
  link: { fontSize: 16, color: "#0d6efd" },
  btnEntregue: {
    backgroundColor: "#198754",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  btnAusente: {
    backgroundColor: "#dc3545",
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnEntregueText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  btnAusenteText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: { backgroundColor: "#fff", borderRadius: 12, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  radio: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, marginBottom: 8, backgroundColor: "#f5f5f5" },
  radioActive: { backgroundColor: "#0d6efd" },
  radioText: { fontSize: 16 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginTop: 12, minHeight: 80 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 24, gap: 12 },
  modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 20 },
  modalBtnCancelText: { color: "#666" },
  modalBtnOk: { backgroundColor: "#0d6efd", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8 },
  modalBtnOkText: { color: "#fff", fontWeight: "600" },
});
