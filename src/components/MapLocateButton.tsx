import React, { useMemo } from "react";
import {
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/colors";

const BUTTON_SIZE = 44;

export interface MapLocateButtonProps {
  bottomInset?: number;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function MapLocateButton({
  bottomInset = 16,
  onPress,
  disabled = false,
  loading = false,
}: MapLocateButtonProps) {
  const colors = useThemeColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: "absolute",
          right: 12,
          bottom: bottomInset,
          zIndex: 6,
        },
        button: {
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: BUTTON_SIZE / 2,
          backgroundColor: colors.backgroundCard,
          borderWidth: 1,
          borderColor: colors.separator,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        },
        buttonDisabled: {
          opacity: 0.6,
        },
      }),
    [colors, bottomInset]
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      <TouchableOpacity
        style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
        onPress={onPress}
        disabled={disabled || loading}
        activeOpacity={0.85}
        accessibilityLabel="Centralizar na minha localização"
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="locate" size={22} color={colors.primary} />
        )}
      </TouchableOpacity>
    </View>
  );
}
