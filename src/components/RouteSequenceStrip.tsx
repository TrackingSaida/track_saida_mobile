import React, { useEffect, useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { useThemeColors } from "../theme/colors";
import {
  ROUTE_STOP_MARKER_COLORS,
  getStopMarkerOperationalState,
  type GroupedStop,
  type RouteDeliveryStatus,
} from "../features/entregas/utils/routeUtils";

interface RouteSequenceStripProps {
  groupedStops: GroupedStop[];
  statusMap: Record<number, RouteDeliveryStatus>;
  activeGroupIndex: number;
  isRouteActive: boolean;
  onPressStop: (stopNumber: number) => void;
}

function chipColor(
  groupIndex: number,
  groupedStops: GroupedStop[],
  statusMap: Record<number, RouteDeliveryStatus>,
  activeGroupIndex: number,
  isRouteActive: boolean
): string {
  const { isCurrent, isNext, isCompleted } = getStopMarkerOperationalState(
    groupIndex,
    groupedStops,
    statusMap,
    activeGroupIndex,
    isRouteActive
  );
  if (isCurrent) return ROUTE_STOP_MARKER_COLORS.current;
  if (isNext) return ROUTE_STOP_MARKER_COLORS.next;
  if (isCompleted) return ROUTE_STOP_MARKER_COLORS.completed;
  return ROUTE_STOP_MARKER_COLORS.pending;
}

export default function RouteSequenceStrip({
  groupedStops,
  statusMap,
  activeGroupIndex,
  isRouteActive,
  onPressStop,
}: RouteSequenceStripProps) {
  const colors = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);

  const focusIndex = useMemo(() => {
    if (isRouteActive && activeGroupIndex >= 0) return activeGroupIndex;
    return 0;
  }, [isRouteActive, activeGroupIndex]);

  useEffect(() => {
    if (groupedStops.length === 0) return;
    const chipWidth = 52;
    scrollRef.current?.scrollTo({ x: Math.max(0, focusIndex * chipWidth - 80), animated: true });
  }, [focusIndex, groupedStops.length]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.backgroundCard + "EE",
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
          paddingVertical: 8,
        },
        scroll: { paddingHorizontal: 12 },
        row: { flexDirection: "row", alignItems: "center" },
        chip: {
          minWidth: 40,
          minHeight: 40,
          borderRadius: 20,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 8,
          paddingVertical: 6,
        },
        chipText: { fontSize: 17, lineHeight: 22, fontWeight: "800", color: "#fff" },
        arrow: { fontSize: 14, color: colors.textSecondary, marginHorizontal: 2 },
      }),
    [colors]
  );

  if (groupedStops.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.row}>
          {groupedStops.map((_, i) => {
            const stopNumber = i + 1;
            const bg = chipColor(i, groupedStops, statusMap, activeGroupIndex, isRouteActive);
            return (
              <React.Fragment key={`seq-${stopNumber}`}>
                {i > 0 && <Text style={styles.arrow}>→</Text>}
                <TouchableOpacity
                  style={[styles.chip, { backgroundColor: bg }]}
                  onPress={() => onPressStop(stopNumber)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.chipText}>{stopNumber}</Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}
