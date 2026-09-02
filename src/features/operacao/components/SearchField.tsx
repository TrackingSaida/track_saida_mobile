import React, { useMemo } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import { radius, space } from "../../../theme/spacing";
import { useFontScale } from "../../../hooks/useFontScale";

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
};

export default function SearchField({ value, onChangeText, placeholder }: Props) {
  const colors = useThemeColors();
  const { ms } = useFontScale();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          minHeight: ms(44),
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
          borderRadius: radius.md,
          paddingHorizontal: space.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: space.sm,
        },
        input: {
          flex: 1,
          minWidth: 0,
          color: colors.text,
          fontSize: 15,
          paddingVertical: 10,
        },
      }),
    [colors, ms]
  );

  return (
    <View style={styles.wrap}>
      <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        autoCapitalize="words"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
    </View>
  );
}
