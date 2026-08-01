import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import {
  formatMotoboyHomeAddress,
  type MotoboyHomeAddress,
} from "../api";

type Props = {
  visible: boolean;
  initialAddress: MotoboyHomeAddress | null;
  confirming: boolean;
  onConfirm: (address: MotoboyHomeAddress) => void;
  onCancel: () => void;
};

const emptyAddress = (): MotoboyHomeAddress => ({
  rua: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
  cep: "",
});

export default function ConfirmRouteDestinationModal({
  visible,
  initialAddress,
  confirming,
  onConfirm,
  onCancel,
}: Props) {
  const colors = useThemeColors();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MotoboyHomeAddress>(emptyAddress());

  useEffect(() => {
    if (!visible) return;
    setDraft(initialAddress ?? emptyAddress());
    setEditing(!initialAddress);
  }, [visible, initialAddress]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 28,
          maxHeight: "88%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 6 },
        subtitle: {
          fontSize: 14,
          color: colors.textSecondary,
          marginBottom: 14,
          lineHeight: 20,
        },
        addressBox: {
          backgroundColor: colors.background,
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.separator,
          marginBottom: 14,
        },
        addressText: { fontSize: 15, color: colors.text, lineHeight: 22 },
        emptyHint: { fontSize: 14, color: colors.warning, marginBottom: 12, lineHeight: 20 },
        fieldLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 4, marginTop: 8 },
        input: {
          borderWidth: 1,
          borderColor: colors.separator,
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          fontSize: 15,
          color: colors.text,
          backgroundColor: colors.background,
        },
        row: { flexDirection: "row", gap: 10 },
        flex1: { flex: 1 },
        btnPrimary: {
          backgroundColor: colors.success,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
          marginTop: 16,
        },
        btnPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
        btnSecondary: {
          borderWidth: 1,
          borderColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 12,
          alignItems: "center",
          marginTop: 10,
        },
        btnSecondaryText: { color: colors.primary, fontSize: 15, fontWeight: "600" },
        btnGhost: { paddingVertical: 12, alignItems: "center", marginTop: 4 },
        btnGhostText: { color: colors.textSecondary, fontSize: 14, fontWeight: "600" },
        disabled: { opacity: 0.55 },
      }),
    [colors]
  );

  const preview = formatMotoboyHomeAddress(draft);
  const canConfirm =
    draft.rua.trim().length > 0 &&
    draft.numero.trim().length > 0 &&
    draft.bairro.trim().length > 0 &&
    draft.cidade.trim().length > 0 &&
    draft.estado.trim().length > 0 &&
    draft.cep.replace(/\D/g, "").length === 8;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Confirme o endereço de destino</Text>
          <Text style={styles.subtitle}>
            A rota será montada saindo do seu local atual e terminando neste endereço (sua casa).
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled">
            {!initialAddress && !editing ? (
              <Text style={styles.emptyHint}>
                Não encontramos um endereço completo no cadastro. Informe o destino da rota.
              </Text>
            ) : null}

            {!editing ? (
              <View style={styles.addressBox}>
                <Text style={styles.addressText}>{preview || "Endereço não informado"}</Text>
              </View>
            ) : (
              <View>
                <Text style={styles.fieldLabel}>Rua</Text>
                <TextInput
                  style={styles.input}
                  value={draft.rua}
                  onChangeText={(rua) => setDraft((d) => ({ ...d, rua }))}
                  placeholder="Rua"
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={styles.row}>
                  <View style={styles.flex1}>
                    <Text style={styles.fieldLabel}>Número</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.numero}
                      onChangeText={(numero) => setDraft((d) => ({ ...d, numero }))}
                      placeholder="Nº"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.fieldLabel}>Complemento</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.complemento}
                      onChangeText={(complemento) => setDraft((d) => ({ ...d, complemento }))}
                      placeholder="Apto / casa"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>
                <Text style={styles.fieldLabel}>Bairro</Text>
                <TextInput
                  style={styles.input}
                  value={draft.bairro}
                  onChangeText={(bairro) => setDraft((d) => ({ ...d, bairro }))}
                  placeholder="Bairro"
                  placeholderTextColor={colors.textSecondary}
                />
                <View style={styles.row}>
                  <View style={[styles.flex1, { flex: 2 }]}>
                    <Text style={styles.fieldLabel}>Cidade</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.cidade}
                      onChangeText={(cidade) => setDraft((d) => ({ ...d, cidade }))}
                      placeholder="Cidade"
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.fieldLabel}>UF</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.estado}
                      onChangeText={(estado) =>
                        setDraft((d) => ({ ...d, estado: estado.toUpperCase().slice(0, 2) }))
                      }
                      placeholder="UF"
                      autoCapitalize="characters"
                      maxLength={2}
                      placeholderTextColor={colors.textSecondary}
                    />
                  </View>
                </View>
                <Text style={styles.fieldLabel}>CEP</Text>
                <TextInput
                  style={styles.input}
                  value={draft.cep}
                  onChangeText={(cep) =>
                    setDraft((d) => ({ ...d, cep: cep.replace(/\D/g, "").slice(0, 8) }))
                  }
                  placeholder="00000000"
                  keyboardType="number-pad"
                  maxLength={8}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.btnPrimary, (!canConfirm || confirming) && styles.disabled]}
              disabled={!canConfirm || confirming}
              onPress={() => onConfirm(draft)}
              activeOpacity={0.9}
            >
              {confirming ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Confirmar e gerar rota</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnSecondary}
              disabled={confirming}
              onPress={() => setEditing((v) => !v)}
              activeOpacity={0.85}
            >
              <Text style={styles.btnSecondaryText}>{editing ? "Ver resumo" : "Editar destino"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnGhost} disabled={confirming} onPress={onCancel}>
              <Text style={styles.btnGhostText}>Voltar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
