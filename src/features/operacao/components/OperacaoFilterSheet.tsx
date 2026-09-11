import React, { useMemo } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import {
  PERIOD_PRESETS,
  parseYmd,
  type PeriodoConsulta,
  type PeriodoPreset,
} from "../utils/periodoConsulta";

type OperacaoFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  children: React.ReactNode;
  title?: string;
};

export default function OperacaoFilterSheet({
  visible,
  onClose,
  onClear,
  onApply,
  children,
  title = "Filtros",
}: OperacaoFilterSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

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
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          padding: 20,
          paddingBottom: Math.max(20, insets.bottom + 12),
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 14 },
        actions: { flexDirection: "row", gap: 10, marginTop: 16 },
        btnSecondary: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          alignItems: "center",
        },
        btnSecondaryText: { fontWeight: "600", color: colors.text },
        btnPrimary: {
          flex: 1,
          paddingVertical: 14,
          borderRadius: 12,
          backgroundColor: colors.primary,
          alignItems: "center",
        },
        btnPrimaryText: { color: colors.primaryContrast, fontSize: 16, fontWeight: "700" },
      }),
    [colors, insets.bottom]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fechar filtros" />
        <View style={styles.sheet}>
          <Text style={styles.title}>{title}</Text>
          {children}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnSecondary} onPress={onClear} accessibilityRole="button">
              <Text style={styles.btnSecondaryText}>Limpar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={onApply} accessibilityRole="button">
              <Text style={styles.btnPrimaryText}>Aplicar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type PeriodoFilterSheetProps = {
  visible: boolean;
  draft: PeriodoConsulta;
  showDatePicker: boolean;
  onClose: () => void;
  onClear: () => void;
  onApply: () => void;
  onSelectPreset: (key: PeriodoPreset) => void;
  onDateChange: (event: DateTimePickerEvent, date?: Date) => void;
};

export function OperacaoPeriodoFilterSheet({
  visible,
  draft,
  showDatePicker,
  onClose,
  onClear,
  onApply,
  onSelectPreset,
  onDateChange,
}: PeriodoFilterSheetProps) {
  const colors = useThemeColors();
  const pickerValue = parseYmd(draft.dataFim) ?? new Date();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        sectionLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 8 },
        pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
        pill: {
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        },
        pillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
        pillText: { fontSize: 14, color: colors.textSecondary },
        pillTextActive: { color: colors.primary, fontWeight: "600" },
      }),
    [colors]
  );

  const picker = showDatePicker ? (
    <DateTimePicker
      value={pickerValue}
      mode="date"
      display={Platform.OS === "ios" ? "spinner" : "default"}
      onChange={onDateChange}
      maximumDate={new Date()}
    />
  ) : null;

  return (
    <>
      <OperacaoFilterSheet visible={visible} onClose={onClose} onClear={onClear} onApply={onApply}>
        <Text style={styles.sectionLabel}>Período</Text>
        <View style={styles.pillRow}>
          {PERIOD_PRESETS.map((opt) => {
            const active = draft.preset === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => onSelectPreset(opt.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                {opt.icon ? (
                  <Ionicons name={opt.icon} size={16} color={active ? colors.primary : colors.textSecondary} />
                ) : null}
                <Text style={[styles.pillText, active && styles.pillTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {Platform.OS === "ios" ? picker : null}
      </OperacaoFilterSheet>
      {Platform.OS === "android" ? picker : null}
    </>
  );
}
