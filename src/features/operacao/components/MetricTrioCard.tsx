import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { radius, space } from "../../../theme/spacing";
import { useSemanticTones, type SemanticKey } from "../../../theme/semantic";
import AppText from "../../../components/ui/AppText";
import { formatInteger, formatPercent } from "../utils/dashboardFormat";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

export type MetricColumnItem = {
  label: string;
  value: number | string;
  semantic: SemanticKey;
  icon: IoniconName;
  isPercent?: boolean;
};

type Props = {
  title: string;
  items: MetricColumnItem[];
};

export default function MetricTrioCard({ title, items }: Props) {
  const colors = useThemeColors();
  const tones = useSemanticTones();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          padding: space.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          marginBottom: space.md,
        },
        title: {
          fontSize: 13,
          fontWeight: "800",
          color: colors.text,
          marginBottom: space.sm,
        },
        row: {
          flexDirection: "row",
          alignItems: "stretch",
        },
        cell: {
          flex: 1,
          minWidth: 0,
          alignItems: "center",
          paddingHorizontal: 4,
        },
        divider: {
          width: StyleSheet.hairlineWidth,
          backgroundColor: colors.separator,
        },
        iconWrap: {
          width: 28,
          height: 28,
          borderRadius: 8,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 6,
        },
        label: {
          fontSize: 11,
          color: colors.textSecondary,
          marginBottom: 4,
          textAlign: "center",
        },
        value: {
          fontSize: 18,
          fontWeight: "800",
          textAlign: "center",
        },
      }),
    [colors]
  );

  return (
    <View style={styles.card} accessibilityLabel={title}>
      <AppText style={styles.title}>{title}</AppText>
      <View style={styles.row}>
        {items.map((item, index) => {
          const tone = tones[item.semantic];
          const display =
            typeof item.value === "number"
              ? item.isPercent
                ? formatPercent(item.value)
                : formatInteger(item.value)
              : item.value;
          return (
            <React.Fragment key={item.label}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.cell} accessibilityLabel={`${item.label} ${display}`}>
                <View style={[styles.iconWrap, { backgroundColor: tone.iconBg }]}>
                  <Ionicons name={item.icon} size={16} color={tone.fg} />
                </View>
                <AppText style={styles.label} numberOfLines={1}>
                  {item.label}
                </AppText>
                <AppText
                  style={[styles.value, { color: tone.fg }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {display}
                </AppText>
              </View>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );
}
