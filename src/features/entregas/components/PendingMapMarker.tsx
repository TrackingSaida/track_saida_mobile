import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const MARKER_HEIGHT = 30;
const LATE_BG = "#FFF7ED";
const LATE_BORDER = "#EA580C";
const DEFAULT_BG = "#FFFFFF";
const DEFAULT_BORDER = "#6366F1";
const ICON_COLOR = "#4B5563";
const LATE_ICON_COLOR = "#EA580C";

export interface PendingMapMarkerProps {
  packageCount: number;
  hasLate?: boolean;
}

export default function PendingMapMarker({ packageCount, hasLate = false }: PendingMapMarkerProps) {
  const isLate = hasLate;
  const showCount = packageCount > 1;

  return (
    <View style={styles.snapshotBox} collapsable={false}>
      <View
        style={[
          styles.wrap,
          {
            backgroundColor: isLate ? LATE_BG : DEFAULT_BG,
            borderColor: isLate ? LATE_BORDER : DEFAULT_BORDER,
          },
        ]}
      >
        {isLate && (
          <Ionicons name="warning" size={12} color={LATE_ICON_COLOR} style={styles.warnIcon} />
        )}
        <Ionicons name="cube" size={14} color={isLate ? LATE_ICON_COLOR : ICON_COLOR} />
        {showCount && (
          <Text style={[styles.count, isLate && styles.countLate]}>{packageCount}</Text>
        )}
      </View>
    </View>
  );
}

export function PendingMapClusterMarker({ count }: { count: number }) {
  return (
    <View style={styles.snapshotBox} collapsable={false}>
      <View style={[styles.clusterWrap, { borderColor: DEFAULT_BORDER }]}>
        <Text style={styles.clusterCount}>{count}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  snapshotBox: {
    minWidth: 34,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 34,
    height: MARKER_HEIGHT,
    paddingHorizontal: 8,
    borderRadius: 15,
    borderWidth: 2,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    overflow: "hidden",
  },
  warnIcon: {
    marginRight: 2,
  },
  count: {
    marginLeft: 3,
    fontSize: 12,
    fontWeight: "800",
    color: "#1F2937",
    lineHeight: 14,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },
  countLate: {
    color: "#C2410C",
  },
  clusterWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  clusterCount: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },
});
