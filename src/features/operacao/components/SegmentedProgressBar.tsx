import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "../../../theme/spacing";
import { useThemeColors } from "../../../theme/colors";

export type ProgressSegment = {
  value: number;
  color: string;
};

type Props = {
  segments: ProgressSegment[];
  total: number;
  height?: number;
  accessibilityLabel?: string;
};

export default function SegmentedProgressBar({
  segments,
  total,
  height = 10,
  accessibilityLabel,
}: Props) {
  const colors = useThemeColors();
  const safeTotal = Math.max(0, total);
  const used = segments.reduce((sum, seg) => sum + Math.max(0, seg.value), 0);
  const remaining = Math.max(0, safeTotal - used);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        track: {
          height,
          borderRadius: radius.full,
          backgroundColor: colors.inputBackground,
          overflow: "hidden",
          flexDirection: "row",
        },
        seg: {
          height: "100%",
        },
      }),
    [colors, height]
  );

  return (
    <View style={styles.track} accessibilityLabel={accessibilityLabel} accessible={!!accessibilityLabel}>
      {segments.map((seg, index) =>
        seg.value > 0 ? (
          <View
            key={`${seg.color}-${index}`}
            style={[
              styles.seg,
              {
                flex: seg.value,
                minWidth: 4,
                backgroundColor: seg.color,
              },
            ]}
          />
        ) : null
      )}
      {remaining > 0 || used === 0 ? <View style={[styles.seg, { flex: Math.max(remaining, 1) }]} /> : null}
    </View>
  );
}
