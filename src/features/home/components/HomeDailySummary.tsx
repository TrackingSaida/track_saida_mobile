import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import type { HomeResumo } from "../utils/homeOperationalState";

type Props = {
  resumo: HomeResumo;
  onPressDetails: () => void;
};

export default function HomeDailySummary({ resumo, onPressDetails }: Props) {
  const colors = useThemeColors();
  const items = [
    { key: "pendentes", label: "Pendentes", value: resumo.pendentes },
    { key: "entregues", label: "Entregues", value: resumo.finalizadas_hoje },
    { key: "ausencias", label: "Ausências", value: resumo.ausentes },
  ] as const;
  const hasDetails =
    resumo.pendentes + resumo.finalizadas_hoje + resumo.ausentes + resumo.atraso_d1 > 0;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginTop: space.md },
        label: {
          fontSize: typo.sectionLabel,
          fontWeight: "700",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          color: colors.textSecondary,
          marginBottom: space.sm,
        },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          paddingVertical: space.lg,
          paddingHorizontal: space.md,
        },
        row: {
          flexDirection: "row",
          justifyContent: "space-around",
        },
        col: { alignItems: "center", flex: 1 },
        value: {
          fontSize: 22,
          fontWeight: "800",
          color: colors.text,
        },
        itemLabel: {
          fontSize: typo.caption,
          color: colors.textSecondary,
          fontWeight: "600",
          marginTop: 4,
        },
        details: {
          marginTop: space.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
        },
        detailsText: {
          fontSize: typo.bodySmall,
          fontWeight: "700",
          color: colors.deliveryAccent,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Resumo de hoje</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          {items.map((item) => (
            <View key={item.key} style={styles.col}>
              <Text style={styles.value}>{item.value}</Text>
              <Text style={styles.itemLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
        {hasDetails ? (
          <TouchableOpacity
            style={styles.details}
            onPress={onPressDetails}
            accessibilityRole="button"
            accessibilityLabel="Ver detalhes do resumo"
          >
            <Text style={styles.detailsText}>Ver detalhes</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.deliveryAccent} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
