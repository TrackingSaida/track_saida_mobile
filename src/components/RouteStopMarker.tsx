import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ROUTE_STOP_MARKER_COLORS,
  type RouteDeliveryStatus,
} from "../features/entregas/utils/routeUtils";

const MARKER_HEIGHT = 28;
const STATUS_ICON_COLOR = "#6B7280";
const FINALIZED_TEXT_COLOR = "#1F2937";

export interface RouteStopMarkerProps {
  stopNumber: number;
  status?: RouteDeliveryStatus;
  isCurrent?: boolean;
  isCompleted?: boolean;
  isNext?: boolean;
  isSelected?: boolean;
}

function resolveMarkerStyle(props: RouteStopMarkerProps): {
  backgroundColor: string;
  textColor: string;
} {
  const { status = "pendente", isCurrent, isNext } = props;
  if (status === "entregue" || status === "ausente") {
    return { backgroundColor: "#FFFFFF", textColor: FINALIZED_TEXT_COLOR };
  }
  if (isCurrent) {
    return { backgroundColor: ROUTE_STOP_MARKER_COLORS.current, textColor: "#fff" };
  }
  if (isNext) {
    return { backgroundColor: ROUTE_STOP_MARKER_COLORS.next, textColor: "#fff" };
  }
  return { backgroundColor: ROUTE_STOP_MARKER_COLORS.pending, textColor: "#fff" };
}

export default function RouteStopMarker({
  stopNumber,
  status = "pendente",
  isCurrent = false,
  isCompleted = false,
  isNext = false,
  isSelected = false,
}: RouteStopMarkerProps) {
  const { backgroundColor, textColor } = resolveMarkerStyle({
    stopNumber,
    status,
    isCurrent,
    isCompleted,
    isNext,
  });
  const isFinalized = status === "entregue" || status === "ausente";

  return (
    <View style={styles.snapshotBox} collapsable={false}>
      <View
        style={[
          styles.wrap,
          { backgroundColor },
          isFinalized && styles.wrapFinalized,
        ]}
      >
        <Text style={[styles.stopNumber, { color: textColor }]}>{stopNumber}</Text>
        {status === "entregue" && (
          <Ionicons name="checkmark" size={13} color={STATUS_ICON_COLOR} style={styles.statusIcon} />
        )}
        {status === "ausente" && (
          <Ionicons name="close" size={13} color={STATUS_ICON_COLOR} style={styles.statusIcon} />
        )}
        {isSelected && <View style={styles.selectedRing} pointerEvents="none" />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  snapshotBox: {
    minWidth: 30,
    height: MARKER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 30,
    height: MARKER_HEIGHT,
    paddingHorizontal: 7,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 1,
    overflow: "hidden",
  },
  wrapFinalized: {
    borderColor: "rgba(0,0,0,0.08)",
    borderWidth: 1,
    shadowOpacity: 0.15,
  },
  selectedRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  stopNumber: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 15,
    textAlign: "center",
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },
  statusIcon: {
    marginLeft: 2,
  },
});
