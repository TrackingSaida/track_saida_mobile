import React from "react";
import { TouchableOpacity, View, Text, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ScannerTorchMode } from "../hooks/useScannerTorch";

type Props = {
  mode: ScannerTorchMode;
  onPress: () => void;
  style?: ViewStyle;
};

function accessibilityLabel(mode: ScannerTorchMode): string {
  switch (mode) {
    case "auto":
      return "Lanterna automática. Toque para ligar manualmente.";
    case "on":
      return "Lanterna ligada. Toque para desligar.";
    case "off":
      return "Lanterna desligada. Toque para modo automático.";
  }
}

export default function ScannerTorchButton({ mode, onPress, style }: Props) {
  const iconName =
    mode === "on" ? "flash" : mode === "off" ? "flash-off" : "flash-outline";

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel(mode)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name={iconName} size={22} color="#fff" />
      {mode === "auto" ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>A</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#0d6efd",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "800",
  },
});
