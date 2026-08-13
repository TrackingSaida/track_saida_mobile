import React, { useMemo } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../theme/colors";
import AppText from "../../../components/ui/AppText";
import { textStyle } from "../../../theme/typography";

/** Fallback enquanto a barra ainda não mediu a altura real. */
export const BATCH_SELECTION_LIST_PADDING = 148;

export interface BatchSelectionBarProps {
  count: number;
  maxCount?: number;
  loading?: boolean;
  onMarcarEntregue: () => void;
  onMarcarAusente: () => void;
  onCancelar: () => void;
  /** Altura medida da barra (para padding dinâmico da lista). */
  onHeightChange?: (height: number) => void;
}

export default function BatchSelectionBar({
  count,
  maxCount,
  loading = false,
  onMarcarEntregue,
  onMarcarAusente,
  onCancelar,
  onHeightChange,
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
          paddingTop: 10,
          paddingBottom: Math.max(8, insets.bottom),
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
          ...textStyle("bodySmall"),
          fontWeight: "600",
          color: colors.text,
          marginBottom: 2,
          textAlign: "center",
        },
        limitText: {
          ...textStyle("caption"),
          color: colors.warning,
          marginBottom: 8,
          textAlign: "center",
        },
        btnDisabled: { opacity: 0.45 },
        row: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
        },
        btn: {
          flex: 1,
          minWidth: 120,
          minHeight: 40,
          paddingVertical: 10,
          paddingHorizontal: 8,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
        },
        btnEntregue: { backgroundColor: colors.success },
        btnAusente: { backgroundColor: colors.warning },
        btnCancel: {
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.separator,
        },
        btnText: { color: colors.primaryContrast, ...textStyle("bodySmall"), fontWeight: "600", textAlign: "center" },
        btnCancelText: {
          color: colors.textSecondary,
          ...textStyle("bodySmall"),
          fontWeight: "600",
          textAlign: "center",
        },
      }),
    [colors, insets.bottom]
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    onHeightChange?.(e.nativeEvent.layout.height);
  };

  if (count <= 0) return null;

  const overLimit = maxCount != null && count > maxCount;
  const actionsDisabled = loading || overLimit;

  return (
    <View style={styles.wrap} onLayout={handleLayout}>
      <AppText style={styles.countText}>
        {loading
          ? "Finalizando em lote..."
          : `${count} selecionado${count !== 1 ? "s" : ""}`}
      </AppText>
      {overLimit && !loading ? (
        <AppText style={styles.limitText}>
          Máximo {maxCount} pedidos por lote. Reduza a seleção para continuar.
        </AppText>
      ) : null}
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, styles.btnEntregue, actionsDisabled && styles.btnDisabled]}
          onPress={onMarcarEntregue}
          disabled={actionsDisabled}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primaryContrast} />
          ) : (
            <AppText style={styles.btnText} numberOfLines={2}>
              Marcar entregue
            </AppText>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnAusente, actionsDisabled && styles.btnDisabled]}
          onPress={onMarcarAusente}
          disabled={actionsDisabled}
        >
          <AppText style={styles.btnText} numberOfLines={2}>
            Marcar ausente
          </AppText>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.btn, styles.btnCancel, { marginTop: 6, minWidth: "100%" }, loading && styles.btnDisabled]}
        onPress={onCancelar}
        disabled={loading}
      >
        <AppText style={styles.btnCancelText} numberOfLines={2}>
          Cancelar seleção
        </AppText>
      </TouchableOpacity>
    </View>
  );
}
