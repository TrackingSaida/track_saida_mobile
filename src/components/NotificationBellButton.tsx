import React, { useMemo } from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../theme/colors";

type Props = {
  onPress: () => void;
  unreadCount?: number;
};

export default function NotificationBellButton({ onPress, unreadCount = 0 }: Props) {
  const colors = useThemeColors();
  const count = Math.max(0, unreadCount);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bellBtn: {
          width: 42,
          height: 42,
          borderRadius: 21,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.18)",
        },
        bellBadge: {
          position: "absolute",
          top: 2,
          right: 2,
          minWidth: 18,
          height: 18,
          borderRadius: 9,
          paddingHorizontal: 4,
          backgroundColor: "#DC2626",
          alignItems: "center",
          justifyContent: "center",
        },
        bellBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
      }),
    []
  );

  return (
    <TouchableOpacity
      style={styles.bellBtn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Avisos, ${count} não lidos` : "Avisos"}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name={count > 0 ? "notifications" : "notifications-outline"}
        size={22}
        color={colors.text}
      />
      {count > 0 ? (
        <View style={styles.bellBadge}>
          <Text style={styles.bellBadgeText}>{count > 99 ? "99+" : String(count)}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
