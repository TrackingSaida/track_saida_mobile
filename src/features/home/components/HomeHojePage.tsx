import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import type { HomeResumo } from "../utils/homeOperationalState";

type Props = {
  resumo: HomeResumo;
  onPendentes: () => void;
  onFinalizadas: () => void;
  onAusentes: () => void;
  onAtrasadas: () => void;
};

type KpiItem = {
  key: string;
  label: string;
  value: number;
  onPress: () => void;
};

export default function HomeHojePage({ resumo, onPendentes, onFinalizadas, onAusentes, onAtrasadas }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          paddingHorizontal: space.md,
          paddingTop: space.md,
        },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: space.md,
        },
        grid: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: space.sm,
        },
        card: {
          width: "48%",
          flexGrow: 1,
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          padding: space.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        cardLabel: {
          fontSize: typo.caption,
          color: colors.textSecondary,
          fontWeight: "600",
        },
        cardValue: {
          fontSize: 28,
          fontWeight: "800",
          color: colors.text,
          marginTop: 6,
        },
        cardLink: {
          marginTop: space.sm,
          fontSize: typo.label,
          color: colors.primary,
          fontWeight: "700",
        },
      }),
    [colors]
  );

  const items: KpiItem[] = [
    { key: "pendentes", label: "Pendentes", value: resumo.pendentes, onPress: onPendentes },
    { key: "finalizadas", label: "Finalizadas hoje", value: resumo.finalizadas_hoje, onPress: onFinalizadas },
    { key: "ausentes", label: "Ausentes", value: resumo.ausentes, onPress: onAusentes },
    { key: "atrasadas", label: "Atrasadas", value: resumo.atraso_d1, onPress: onAtrasadas },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Resumo do dia</Text>
      <View style={styles.grid}>
        {items.map((item) => (
          <TouchableOpacity key={item.key} style={styles.card} onPress={item.onPress} activeOpacity={0.9}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardValue}>{item.value}</Text>
            <Text style={styles.cardLink}>Ver</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
