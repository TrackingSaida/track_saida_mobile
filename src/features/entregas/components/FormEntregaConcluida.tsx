import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import type { EntregueBody } from "../api";
import { formatCPF, formatRG, unmaskCPF, unmaskRG } from "../utils/formatDocument";

const TIPOS_RECEBEDOR = ["Comprador", "Familiar", "Vizinho", "Porteiro", "Outro"] as const;
const TIPOS_DOCUMENTO = ["RG", "CPF"] as const;

export interface FormEntregaConcluidaProps {
  visible: boolean;
  idSaida: number;
  destinatarioPreenchido?: string;
  onConfirm: (body: EntregueBody) => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
}

export default function FormEntregaConcluida({
  visible,
  idSaida,
  destinatarioPreenchido,
  onConfirm,
  onClose,
  onSuccess,
}: FormEntregaConcluidaProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, justifyContent: "flex-end" },
        backdrop: { flex: 1, backgroundColor: colors.overlay },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 24,
          paddingBottom: 32,
          maxHeight: "85%",
        },
        title: { fontSize: 18, fontWeight: "600", marginBottom: 16, color: colors.text },
        label: { fontSize: 12, color: colors.textSecondary, marginBottom: 6, marginTop: 12 },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
          backgroundColor: colors.inputBackground,
          color: colors.text,
        },
        textArea: { minHeight: 80, textAlignVertical: "top" as const },
        opcoesRow: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8 },
        chip: {
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
        },
        chipActive: { backgroundColor: colors.primary },
        chipText: { fontSize: 14, color: colors.text },
        chipTextActive: { color: colors.primaryContrast, fontWeight: "600" },
        error: { color: colors.danger, fontSize: 14, marginTop: 12 },
        actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 24, gap: 12 },
        btnCancel: { paddingVertical: 10, paddingHorizontal: 20 },
        btnCancelText: { color: colors.textSecondary, fontSize: 16 },
        btnOk: {
          backgroundColor: colors.success,
          paddingVertical: 10,
          paddingHorizontal: 24,
          borderRadius: 8,
          minWidth: 120,
          alignItems: "center",
        },
        btnDisabled: { opacity: 0.7 },
        btnOkText: { color: colors.primaryContrast, fontWeight: "600", fontSize: 16 },
      }),
    [colors]
  );
  const [tipoRecebedor, setTipoRecebedor] = useState<string>("Comprador");
  const [nomeRecebedor, setNomeRecebedor] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState<"RG" | "CPF">("RG");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setTipoRecebedor("Comprador");
      setNomeRecebedor(destinatarioPreenchido?.trim() ?? "");
      setTipoDocumento("RG");
      setNumeroDocumento("");
      setObservacao("");
      setError(null);
    }
  }, [visible, destinatarioPreenchido]);

  const handleTipoDocChange = (tipo: "RG" | "CPF") => {
    setTipoDocumento(tipo);
    const raw = tipo === "CPF" ? unmaskCPF(numeroDocumento) : unmaskRG(numeroDocumento);
    setNumeroDocumento(tipo === "CPF" ? formatCPF(raw) : formatRG(raw));
  };

  const handleNumeroDocChange = (text: string) => {
    const formatted = tipoDocumento === "CPF" ? formatCPF(text) : formatRG(text);
    setNumeroDocumento(formatted);
  };

  const handleConfirmar = async () => {
    setError(null);
    setSaving(true);
    try {
      const body: EntregueBody = {
        tipo_recebedor: tipoRecebedor || undefined,
        nome_recebedor: nomeRecebedor.trim() || undefined,
        tipo_documento: tipoDocumento || undefined,
        numero_documento:
          numeroDocumento.trim() ? (tipoDocumento === "CPF" ? unmaskCPF(numeroDocumento) : unmaskRG(numeroDocumento)) : undefined,
        observacao_entrega: observacao.trim() || undefined,
      };
      await onConfirm(body);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "Erro ao marcar como entregue.";
      setError(String(msg));
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide">
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.box}>
          <Text style={styles.title}>Dados do recebedor</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>Tipo do recebedor</Text>
            <View style={styles.opcoesRow}>
              {TIPOS_RECEBEDOR.map((op) => (
                <TouchableOpacity
                  key={op}
                  style={[styles.chip, tipoRecebedor === op && styles.chipActive]}
                  onPress={() => {
                    if (tipoRecebedor !== op) {
                      setTipoRecebedor(op);
                      setNomeRecebedor("");
                    }
                  }}
                >
                  <Text style={[styles.chipText, tipoRecebedor === op && styles.chipTextActive]}>{op}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Nome do recebedor</Text>
            <TextInput
              style={styles.input}
              value={nomeRecebedor}
              onChangeText={setNomeRecebedor}
              placeholder="Nome de quem recebeu"
              placeholderTextColor={colors.placeholder}
            />

            <Text style={styles.label}>Tipo do documento</Text>
            <View style={styles.opcoesRow}>
              {TIPOS_DOCUMENTO.map((op) => (
                <TouchableOpacity
                  key={op}
                  style={[styles.chip, tipoDocumento === op && styles.chipActive]}
                  onPress={() => handleTipoDocChange(op)}
                >
                  <Text style={[styles.chipText, tipoDocumento === op && styles.chipTextActive]}>{op}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Número do documento</Text>
            <TextInput
              style={styles.input}
              value={numeroDocumento}
              onChangeText={handleNumeroDocChange}
              placeholder={tipoDocumento === "CPF" ? "000.000.000-00" : "00.000.000-0"}
              placeholderTextColor={colors.placeholder}
              keyboardType={tipoDocumento === "CPF" ? "numeric" : "default"}
            />

            <Text style={styles.label}>Observação (opcional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Observação da entrega"
              placeholderTextColor={colors.placeholder}
              multiline
              numberOfLines={3}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.btnCancel} onPress={onClose} disabled={saving}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnOk, saving && styles.btnDisabled]} onPress={handleConfirmar} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={colors.primaryContrast} size="small" />
                ) : (
                  <Text style={styles.btnOkText}>Confirmar</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
