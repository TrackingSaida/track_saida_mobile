import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../theme/colors";

interface PrepExportSheetProps {
  visible: boolean;
  onClose: () => void;
  onExport: () => void;
  exportCount: number;
  semEnderecoCount: number;
  exporting?: boolean;
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export default function PrepExportSheet({
  visible,
  onClose,
  onExport,
  exportCount,
  semEnderecoCount,
  exporting = false,
}: PrepExportSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const canExport = exportCount > 0 && !exporting;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 16,
          paddingTop: 12,
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.separator,
          alignSelf: "center",
          marginBottom: 12,
        },
        sheetTitle: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.textSecondary,
          marginBottom: 12,
        },
        headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
        headerIcon: { marginRight: 10 },
        title: { fontSize: 17, fontWeight: "700", color: colors.text },
        description: { fontSize: 14, color: colors.textSecondary, marginBottom: 14 },
        summary: {
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.separator,
          paddingHorizontal: 14,
          paddingVertical: 4,
          marginBottom: 16,
        },
        summaryRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
        },
        summaryDivider: {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
        },
        summaryIcon: { marginRight: 10 },
        summaryText: { fontSize: 15, color: colors.text, flex: 1 },
        summaryTextMuted: { fontSize: 14, color: colors.textSecondary, flex: 1 },
        primaryBtn: {
          minHeight: 52,
          borderRadius: 12,
          backgroundColor: colors.primary,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
        },
        primaryBtnDisabled: { opacity: 0.45 },
        primaryBtnText: { fontSize: 16, fontWeight: "700", color: colors.primaryContrast },
        cancel: { paddingVertical: 14, alignItems: "center" },
        cancelText: { fontSize: 16, fontWeight: "600", color: colors.primary },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.sheet, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Mais opções</Text>

            <View style={styles.headerRow}>
              <Ionicons name="download-outline" size={22} color={colors.text} style={styles.headerIcon} />
              <Text style={styles.title}>Exportar endereços</Text>
            </View>
            <Text style={styles.description}>
              Baixa uma planilha com endereço, número e CEP para usar em outro app de rota.
            </Text>

            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Ionicons
                  name={exportCount > 0 ? "checkmark-circle" : "alert-circle-outline"}
                  size={20}
                  color={exportCount > 0 ? colors.success : colors.textSecondary}
                  style={styles.summaryIcon}
                />
                <Text style={styles.summaryText}>
                  {exportCount > 0
                    ? `${plural(exportCount, "endereço pronto", "endereços prontos")} na planilha`
                    : "Nenhum endereço pronto para exportar"}
                </Text>
              </View>
              {semEnderecoCount > 0 ? (
                <View style={[styles.summaryRow, styles.summaryDivider]}>
                  <Ionicons
                    name="remove-circle-outline"
                    size={20}
                    color={colors.textSecondary}
                    style={styles.summaryIcon}
                  />
                  <Text style={styles.summaryTextMuted}>
                    {`${plural(semEnderecoCount, "pacote sem endereço fica", "pacotes sem endereço ficam")} de fora`}
                  </Text>
                </View>
              ) : null}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, !canExport && styles.primaryBtnDisabled]}
              onPress={onExport}
              disabled={!canExport}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canExport, busy: exporting }}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={colors.primaryContrast} />
              ) : (
                <Ionicons name="download-outline" size={20} color={colors.primaryContrast} />
              )}
              <Text style={styles.primaryBtnText}>{exporting ? "Gerando planilha..." : "Baixar planilha"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancel} onPress={onClose} disabled={exporting}>
              <Text style={styles.cancelText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
