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
  /** Precisão ao nível da rua — pin continua, com aviso visual. */
  isStreetLevel?: boolean;
}

function resolveMarkerStyle(props: RouteStopMarkerProps): {
  backgroundColor: string;
  textColor: string;
} {
  const { status = "pendente", isCurrent, isNext } = props;
  if (status === "entregue" || status === "ausente" || status === "cancelado") {
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
  isStreetLevel = false,
}: RouteStopMarkerProps) {
  const { backgroundColor, textColor } = resolveMarkerStyle({
    stopNumber,
    status,
    isCurrent,
    isCompleted,
    isNext,
  });
  const isFinalized = status === "entregue" || status === "ausente" || status === "cancelado";

  return (
    <View style={styles.snapshotBox} collapsable={false}>
      <View
        style={[
          styles.wrap,
          { backgroundColor },
          isFinalized && styles.wrapFinalized,
          isStreetLevel && !isFinalized && styles.wrapStreetLevel,
        ]}
      >
        <Text style={[styles.stopNumber, { color: textColor }]}>{stopNumber}</Text>
        {status === "entregue" && (
          <Ionicons name="checkmark" size={13} color={STATUS_ICON_COLOR} style={styles.statusIcon} />
        )}
        {status === "ausente" && (
          <Ionicons name="close" size={13} color={STATUS_ICON_COLOR} style={styles.statusIcon} />
        )}
        {status === "cancelado" && (
          <Ionicons name="return-down-back" size={12} color={STATUS_ICON_COLOR} style={styles.statusIcon} />
        )}
        {isSelected && <View style={styles.selectedRing} pointerEvents="none" />}
      </View>
      {isStreetLevel && !isFinalized ? (
        <View style={styles.streetBadge} pointerEvents="none">
          <Text style={styles.streetBadgeText}>≈</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  snapshotBox: {
    minWidth: 30,
    height: MARKER_HEIGHT + 10,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 0,
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
  wrapStreetLevel: {
    borderColor: "#F59E0B",
    borderStyle: "dashed",
  },
  streetBadge: {
    marginTop: 1,
    minWidth: 16,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  streetBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 12,
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
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
