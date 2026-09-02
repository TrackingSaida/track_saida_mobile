import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { radius } from "../../../theme/spacing";
import { useSemanticTones, type SemanticKey } from "../../../theme/semantic";
import AppText from "../../../components/ui/AppText";

type Props = {
  label: string;
  semantic: SemanticKey;
};

export default function StatusBadge({ label, semantic }: Props) {
  const tones = useSemanticTones();
  const tone = tones[semantic];

  const styles = useMemo(
    () =>
      StyleSheet.create({
        badge: {
          alignSelf: "flex-start",
          flexShrink: 0,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: radius.full,
          backgroundColor: tone.bg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tone.border,
          maxWidth: 140,
        },
        text: {
          fontSize: 11,
          fontWeight: "800",
          color: tone.fg,
        },
      }),
    [tone]
  );

  return (
    <View style={styles.badge} accessibilityLabel={`Status ${label}`}>
      <AppText style={styles.text} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}
