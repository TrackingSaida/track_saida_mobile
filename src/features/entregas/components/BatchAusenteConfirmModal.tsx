import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { getMotivosAusencia } from "../api";
import type { MotivoAusencia } from "../types";

export interface BatchAusenteConfirmModalProps {
  visible: boolean;
  count: number;
  onClose: () => void;
  onConfirm: (data: { motivoId: number; observacao?: string }) => void;
}

export default function BatchAusenteConfirmModal({
  visible,
  count,
  onClose,
  onConfirm,
}: BatchAusenteConfirmModalProps) {
  const colors = useThemeColors();
  const [motivos, setMotivos] = useState<MotivoAusencia[]>([]);
  const [loadingMotivos, setLoadingMotivos] = useState(false);
  const [motivoId, setMotivoId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (!visible) return;
    setLoadingMotivos(true);
    getMotivosAusencia()
      .then(setMotivos)
      .catch(() => setMotivos([]))
      .finally(() => setLoadingMotivos(false));
  }, [visible]);

  const motivoSelecionado = motivos.find((m) => m.id === motivoId);
  const isOutro = motivoSelecionado?.descricao.trim().toLowerCase() === "outro";

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20,
          maxHeight: "80%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
        motivoItem: {
          paddingVertical: 12,
          paddingHorizontal: 12,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: colors.separator,
          marginBottom: 8,
        },
        motivoItemActive: { borderColor: colors.primary, backgroundColor: colors.inputBackground },
        motivoText: { fontSize: 15, color: colors.text },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: 8,
          padding: 12,
          color: colors.text,
          marginBottom: 12,
          minHeight: 80,
          textAlignVertical: "top",
        },
        btnRow: { flexDirection: "row", gap: 10, marginTop: 8 },
        btn: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: "center" },
        btnPrimary: { backgroundColor: colors.primary },
        btnSecondary: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.separator },
        btnPrimaryText: { color: colors.primaryContrast, fontWeight: "600" },
        btnSecondaryText: { color: colors.textSecondary, fontWeight: "600" },
      }),
    [colors]
  );

  const handleConfirm = () => {
    if (motivoId == null) {
      Alert.alert("Atenção", "Selecione um motivo de ausência.");
      return;
    }
    if (isOutro && !observacao.trim()) {
      Alert.alert("Atenção", "Informe a observação quando o motivo for 'Outro'.");
      return;
    }
    const desc = motivoSelecionado?.descricao ?? "—";
    Alert.alert(
      "Confirmar ausência em lote?",
      `Você está marcando ${count} pedido${count !== 1 ? "s" : ""} como ausente${count !== 1 ? "s" : ""} pelo motivo: ${desc}.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => {
            onConfirm({
              motivoId,
              observacao: observacao.trim() || undefined,
            });
            setMotivoId(null);
            setObservacao("");
          },
        },
      ]
    );
  };

  const handleClose = () => {
    setMotivoId(null);
    setObservacao("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={styles.box} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Ausência em lote</Text>
          <Text style={styles.subtitle}>
            Selecione o motivo para {count} pedido{count !== 1 ? "s" : ""}.
          </Text>
          {loadingMotivos ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : (
            <ScrollView style={{ maxHeight: 220 }}>
              {motivos.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.motivoItem, motivoId === m.id && styles.motivoItemActive]}
                  onPress={() => setMotivoId(m.id)}
                >
                  <Text style={styles.motivoText}>{m.descricao}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {(isOutro || observacao.length > 0) && (
            <TextInput
              style={styles.input}
              placeholder="Observação (obrigatória para Outro)"
              placeholderTextColor={colors.placeholder}
              value={observacao}
              onChangeText={setObservacao}
              multiline
            />
          )}
          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleClose}>
              <Text style={styles.btnSecondaryText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleConfirm}>
              <Text style={styles.btnPrimaryText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
