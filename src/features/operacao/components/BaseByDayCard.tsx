import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { radius, space } from "../../../theme/spacing";
import { useSemanticTones } from "../../../theme/semantic";
import AppText from "../../../components/ui/AppText";
import { formatDateLabel } from "../utils/periodoConsulta";
import { baseDayAge, formatInteger } from "../utils/dashboardFormat";

type DayItem = { date: string; qty: number };

type Props = {
  items: DayItem[];
  onPressDay?: (date: string) => void;
};

export default function BaseByDayCard({ items, onPressDay }: Props) {
  const colors = useThemeColors();
  const tones = useSemanticTones();
  const visible = items.slice(0, 5);
  const maxQty = Math.max(1, ...visible.map((d) => d.qty));

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          marginTop: space.sm,
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.md,
          padding: space.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        title: {
          fontSize: 13,
          fontWeight: "800",
          color: colors.text,
          marginBottom: space.sm,
        },
        row: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 28,
          marginBottom: 8,
        },
        date: {
          width: 88,
          flexShrink: 0,
          fontSize: 13,
          fontWeight: "600",
          color: colors.text,
        },
        barTrack: {
          flex: 1,
          minWidth: 24,
          height: 6,
          borderRadius: radius.full,
          backgroundColor: colors.inputBackground,
          overflow: "hidden",
        },
        barFill: {
          height: "100%",
          borderRadius: radius.full,
        },
        qty: {
          flexShrink: 1,
          minWidth: 72,
          maxWidth: 110,
          textAlign: "right",
          fontSize: 13,
          fontWeight: "700",
          color: colors.text,
        },
      }),
    [colors]
  );

  return (
    <View style={styles.card} accessibilityLabel="Ainda na base, por data do pacote">
      <AppText style={styles.title}>Ainda na base, por data do pacote</AppText>
      {visible.map((item) => {
        const age = baseDayAge(item.date);
        const barColor =
          age === "older" ? tones.route.bar : age === "recent" ? tones.warning.bar : tones.neutral.bar;
        const labelColor =
          age === "older" ? tones.route.fg : age === "recent" ? tones.warning.fg : colors.text;
        const qtyLabel = `${formatInteger(item.qty)} pacote(s)`;
        const content = (
          <View style={styles.row}>
            <AppText style={[styles.date, { color: labelColor }]}>{formatDateLabel(item.date)}</AppText>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${Math.max(8, (item.qty / maxQty) * 100)}%`,
                    backgroundColor: barColor,
                  },
                ]}
              />
            </View>
            <AppText style={styles.qty} numberOfLines={1}>
              {qtyLabel}
            </AppText>
          </View>
        );
        if (!onPressDay) {
          return (
            <View key={item.date} accessibilityLabel={`${formatDateLabel(item.date)}, ${qtyLabel}`}>
              {content}
            </View>
          );
        }
        return (
          <Pressable
            key={item.date}
            onPress={() => onPressDay(item.date)}
            accessibilityRole="button"
            accessibilityLabel={`${formatDateLabel(item.date)}, ${qtyLabel}`}
          >
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}
