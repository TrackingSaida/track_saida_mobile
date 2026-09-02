import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "../../../theme/spacing";
import { useSemanticTones, type SemanticKey } from "../../../theme/semantic";
import AppText from "../../../components/ui/AppText";
import { formatInteger } from "../utils/dashboardFormat";

type Props = {
  label: string;
  value: number;
  semantic: SemanticKey;
};

export default function ServiceChip({ label, value, semantic }: Props) {
  const tones = useSemanticTones();
  const tone = tones[semantic];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        chip: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: radius.full,
          backgroundColor: tone.bg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tone.border,
        },
        text: {
          fontSize: 11,
          fontWeight: "700",
          color: tone.fg,
        },
      }),
    [tone]
  );

  return (
    <View style={styles.chip} accessibilityLabel={`${label} ${formatInteger(value)}`}>
      <AppText style={styles.text}>
        {label} {formatInteger(value)}
      </AppText>
    </View>
  );
}
