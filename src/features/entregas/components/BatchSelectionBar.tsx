import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../theme/colors";

export const BATCH_SELECTION_LIST_PADDING = 180;

export interface BatchSelectionBarProps {
  count: number;
  maxCount?: number;
  loading?: boolean;
  onMarcarEntregue: () => void;
  onMarcarAusente: () => void;
  onCancelar: () => void;
}

export default function BatchSelectionBar({
  count,
  maxCount,
  loading = false,
  onMarcarEntregue,
  onMarcarAusente,
  onCancelar,
}: BatchSelectionBarProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: colors.backgroundCard,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          borderTopWidth: 1,
          borderTopColor: colors.separator,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.12,
          shadowRadius: 6,
          elevation: 8,
          zIndex: 10,
        },
        countText: {
          fontSize: 14,
          fontWeight: "600",
          color: colors.text,
          marginBottom: 4,
          textAlign: "center",
        },
        limitText: {
          fontSize: 12,
          color: colors.warning,
          marginBottom: 10,
          textAlign: "center",
        },
        btnDisabled: { opacity: 0.45 },
        row: {
          flexDirection: "row",
          gap: 8,
        },
        btn: {
          flex: 1,
          paddingVertical: 10,
          borderRadius: 8,
          alignItems: "center",
        },
        btnEntregue: { backgroundColor: colors.success },
        btnAusente: { backgroundColor: colors.warning },
        btnCancel: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.separator,
        },
        btnText: { color: colors.primaryContrast, fontSize: 13, fontWeight: "600" },
        btnCancelText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
      }),
    [colors, insets.bottom]
  );

  if (count <= 0) return null;

  const overLimit = maxCount != null && count > maxCount;
  const actionsDisabled = loading || overLimit;

  return (
    <View style={styles.wrap}>
      <Text style={styles.countText}>
        {loading
          ? "Finalizando em lote..."
          : `${count} selecionado${count !== 1 ? "s" : ""}`}
      </Text>
      {overLimit && !loading && (
        <Text style={styles.limitText}>
          Máximo {maxCount} pedidos por lote. Reduza a seleção para continuar.
        </Text>
      )}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, styles.btnEntregue, actionsDisabled && styles.btnDisabled]}
          onPress={onMarcarEntregue}
          disabled={actionsDisabled}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primaryContrast} />
          ) : (
            <Text style={styles.btnText} numberOfLines={1}>
              Marcar entregue
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnAusente, actionsDisabled && styles.btnDisabled]}
          onPress={onMarcarAusente}
          disabled={actionsDisabled}
        >
          <Text style={styles.btnText} numberOfLines={1}>
            Marcar ausente
          </Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.btn, styles.btnCancel, { marginTop: 8 }, loading && styles.btnDisabled]}
        onPress={onCancelar}
        disabled={loading}
      >
        <Text style={styles.btnCancelText} numberOfLines={1}>
          Cancelar seleção
        </Text>
      </TouchableOpacity>
    </View>
  );
}
