import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { runOptimizeRouteWithFeedback } from "../features/entregas/utils/optimizeRouteFeedback";
import DraggableFlatList, {
  type RenderItemParams,
  type DragEndParams,
} from "react-native-draggable-flatlist";
import { useThemeColors } from "../theme/colors";
import { useDeliveryStore } from "../store/deliveryStore";
import {
  getOrderedRouteDeliveries,
  groupOrderedByAddress,
  servicoTipo,
  ROUTE_STOP_MARKER_COLORS,
  getGroupStatus,
  getStopPrimaryCodigo,
  getStopPedidosList,
  getStopAddressLine,
  getStopVolumesSummary,
  getStopMarkerOperationalState,
  type GroupedStop,
} from "../features/entregas/utils/routeUtils";
import type { EntregaListItem } from "../features/entregas/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type RouteItemStatus = "pendente" | "entregue" | "ausente";

interface GroupedStopRowProps {
  group: GroupedStop;
  stopIndex: number;
  isDragging: boolean;
  isCurrentStop: boolean;
  isNextStop: boolean;
  drag: () => void;
  colors: ReturnType<typeof useThemeColors>;
  status: RouteItemStatus;
  disableDrag?: boolean;
  onPress?: () => void;
}

function GroupedStopRow({
  group,
  stopIndex,
  isDragging,
  isCurrentStop,
  isNextStop,
  drag,
  colors,
  status,
  disableDrag,
  onPress,
}: GroupedStopRowProps) {
  const first = group.deliveries[0];
  const tipo = servicoTipo(first?.servico);
  const packageCount = group.deliveries.length;
  const badgeColor = isCurrentStop
    ? ROUTE_STOP_MARKER_COLORS.current
    : isNextStop
      ? ROUTE_STOP_MARKER_COLORS.next
      : status !== "pendente"
        ? ROUTE_STOP_MARKER_COLORS.completed
        : ROUTE_STOP_MARKER_COLORS.pending;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "flex-start",
          paddingVertical: 12,
          paddingHorizontal: 12,
          backgroundColor: isDragging ? colors.inputBackground : colors.backgroundCard,
          borderRadius: 10,
          marginBottom: 8,
          borderWidth: isCurrentStop ? 2 : 1,
          borderColor: isCurrentStop ? colors.primary : isDragging ? colors.primary : colors.separator,
          opacity: status !== "pendente" ? 0.75 : 1,
          ...(isDragging
            ? {
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 6,
                elevation: 6,
                transform: [{ scale: 1.02 }],
              }
            : {}),
        },
        orderBox: {
          width: 40,
          minHeight: 44,
          borderRadius: 8,
          backgroundColor: badgeColor,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 10,
        },
        orderText: { fontSize: 15, fontWeight: "800", color: "#fff" },
        orderPackage: { fontSize: 9, fontWeight: "600", color: "rgba(255,255,255,0.9)", marginTop: 1 },
        body: { flex: 1, minWidth: 0 },
        currentBadge: {
          alignSelf: "flex-start",
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 4,
          backgroundColor: colors.primary + "25",
          marginBottom: 6,
        },
        currentBadgeText: { fontSize: 10, fontWeight: "800", color: colors.primary },
        codigo: {
          fontSize: 17,
          fontWeight: "800",
          color: colors.primary,
          marginBottom: 2,
        },
        pedido: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
        destinatario: {
          fontSize: 14,
          fontWeight: "600",
          color: status !== "pendente" ? colors.textSecondary : colors.text,
          marginBottom: 2,
        },
        meta: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
        endereco: { fontSize: 12, color: colors.textSecondary },
        dragHandle: {
          paddingLeft: 8,
          paddingVertical: 4,
          justifyContent: "center",
        },
      }),
    [colors, isDragging, isCurrentStop, status, badgeColor]
  );

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.orderBox}>
        <Text style={styles.orderText}>{stopIndex}</Text>
        <Text style={styles.orderPackage}>📦{packageCount}</Text>
      </View>
      <View style={styles.body}>
        {isCurrentStop && (
          <View style={styles.currentBadge}>
            <Text style={styles.currentBadgeText}>PARADA ATUAL</Text>
          </View>
        )}
        <Text style={styles.codigo} numberOfLines={1}>
          {getStopPrimaryCodigo(group)}
        </Text>
        <Text style={styles.pedido}>
          {group.deliveries.length > 1 ? getStopPedidosList(group) : first ? `Pedido ${first.id_saida}` : ""}
        </Text>
        <Text style={styles.destinatario} numberOfLines={1}>
          {first?.cliente || first?.exibicao || "—"}
        </Text>
        <Text style={styles.meta}>
          {getStopVolumesSummary(group)} · {tipo}
        </Text>
        <Text style={styles.endereco} numberOfLines={1}>
          {first ? getStopAddressLine(first) : "—"}
        </Text>
      </View>
      {!disableDrag && (
        <TouchableOpacity
          style={styles.dragHandle}
          onPressIn={drag}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="menu" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function RouteBottomSheet({
  disableDrag = false,
  activeGroupIndex = -1,
  isRouteActive = false,
  onStopPress,
  collapsed: collapsedProp,
  onCollapsedChange,
  defaultCollapsed = true,
  planningHeaderCollapsed = false,
}: {
  disableDrag?: boolean;
  activeGroupIndex?: number;
  isRouteActive?: boolean;
  onStopPress?: (group: GroupedStop, stopIndex: number) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  defaultCollapsed?: boolean;
  /** Header "Rota pronta" recolhido — lista pode ocupar mais altura */
  planningHeaderCollapsed?: boolean;
}) {
  const colors = useThemeColors();
  const [collapsedInternal, setCollapsedInternal] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? collapsedInternal;

  const setCollapsed = useCallback(
    (value: boolean | ((prev: boolean) => boolean)) => {
      const prev = collapsedProp ?? collapsedInternal;
      const next = typeof value === "function" ? value(prev) : value;
      if (collapsedProp === undefined) setCollapsedInternal(next);
      onCollapsedChange?.(next);
    },
    [collapsedProp, collapsedInternal, onCollapsedChange]
  );

  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const routeOrder = useDeliveryStore((s) => s.routeOrder);
  const routeDeliveryStatus = useDeliveryStore((s) => s.routeDeliveryStatus);
  const optimizeRoute = useDeliveryStore((s) => s.optimizeRoute);
  const reorderRoute = useDeliveryStore((s) => s.reorderRoute);

  const [optimizing, setOptimizing] = useState(false);
  const listRef = useRef<FlatList<GroupedStop>>(null);
  const scrollAttemptRef = useRef(0);
  const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ROW_HEIGHT = 136;
  const MAX_SCROLL_ATTEMPTS = 3;

  const ordered = useMemo(
    () => getOrderedRouteDeliveries(routeDeliveries, routeOrder),
    [routeDeliveries, routeOrder]
  );

  const groupedStops = useMemo(() => groupOrderedByAddress(ordered), [ordered]);

  const getRowOperationalState = useCallback(
    (groupIdx: number) =>
      getStopMarkerOperationalState(
        groupIdx,
        groupedStops,
        routeDeliveryStatus,
        activeGroupIndex,
        isRouteActive
      ),
    [groupedStops, routeDeliveryStatus, activeGroupIndex, isRouteActive]
  );

  const handleOptimize = useCallback(async () => {
    if (groupedStops.length < 2 || optimizing) return;
    setOptimizing(true);
    try {
      await runOptimizeRouteWithFeedback(optimizeRoute);
    } finally {
      setOptimizing(false);
    }
  }, [groupedStops.length, optimizeRoute, optimizing]);

  const expandList = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(false);
    if (!disableDrag) {
      setTimeout(() => {
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      }, 120);
    }
  }, [setCollapsed, disableDrag]);

  const collapseList = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(true);
  }, [setCollapsed]);

  const handleDragEnd = useCallback(
    ({ data }: DragEndParams<GroupedStop>) => {
      const newOrder = data.flatMap((g) => g.deliveries.map((d) => d.id_saida));
      reorderRoute(newOrder);
    },
    [reorderRoute]
  );

  const renderItem = useCallback(
    ({ item, getIndex, drag, isActive }: RenderItemParams<GroupedStop>) => {
      const idx = getIndex();
      const paradaNumber = (typeof idx === "number" ? idx : 0) + 1;
      const groupIdx = typeof idx === "number" ? idx : -1;
      const op = getRowOperationalState(groupIdx);
      return (
        <GroupedStopRow
          group={item}
          stopIndex={paradaNumber}
          isDragging={isActive}
          isCurrentStop={op.isCurrent}
          isNextStop={op.isNext}
          drag={drag}
          colors={colors}
          status={getGroupStatus(item.deliveries, routeDeliveryStatus)}
          disableDrag={disableDrag}
          onPress={onStopPress ? () => onStopPress(item, paradaNumber) : undefined}
        />
      );
    },
    [colors, routeDeliveryStatus, disableDrag, onStopPress, getRowOperationalState]
  );

  const renderRow = useCallback(
    ({ item, index }: { item: GroupedStop; index: number }) => {
      const paradaNumber = (index ?? 0) + 1;
      const op = getRowOperationalState(index);
      return (
        <GroupedStopRow
          group={item}
          stopIndex={paradaNumber}
          isDragging={false}
          isCurrentStop={op.isCurrent}
          isNextStop={op.isNext}
          drag={() => {}}
          colors={colors}
          status={getGroupStatus(item.deliveries, routeDeliveryStatus)}
          disableDrag
          onPress={onStopPress ? () => onStopPress(item, paradaNumber) : undefined}
        />
      );
    },
    [colors, routeDeliveryStatus, onStopPress, getRowOperationalState]
  );

  const total = groupedStops.length;

  const completedCount = useMemo(() => {
    return groupedStops.filter(
      (g) => getGroupStatus(g.deliveries, routeDeliveryStatus) !== "pendente"
    ).length;
  }, [groupedStops, routeDeliveryStatus]);

  const scrollToActiveGroupRobust = useCallback(
    (animated = true) => {
      if (activeGroupIndex < 0 || collapsed || !disableDrag) return;
      listRef.current?.scrollToIndex({
        index: activeGroupIndex,
        animated,
        viewPosition: 0.15,
      });
    },
    [activeGroupIndex, collapsed, disableDrag]
  );

  const scheduleScrollToActiveGroup = useCallback(() => {
    if (collapsed || !disableDrag || activeGroupIndex < 0) return;
    if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    scrollDebounceRef.current = setTimeout(() => {
      scrollDebounceRef.current = null;
      scrollToActiveGroupRobust();
    }, 50);
  }, [collapsed, disableDrag, activeGroupIndex, scrollToActiveGroupRobust]);

  const handleListLayout = useCallback(() => {
    if (scrollAttemptRef.current >= MAX_SCROLL_ATTEMPTS) return;
    scrollAttemptRef.current += 1;
    scheduleScrollToActiveGroup();
  }, [scheduleScrollToActiveGroup]);

  const handleContentSizeChange = useCallback(() => {
    if (scrollAttemptRef.current >= MAX_SCROLL_ATTEMPTS) return;
    scrollAttemptRef.current += 1;
    scheduleScrollToActiveGroup();
  }, [scheduleScrollToActiveGroup]);

  useEffect(() => {
    if (collapsed) {
      scrollAttemptRef.current = 0;
      return;
    }
    if (!disableDrag || activeGroupIndex < 0) return;
    scrollAttemptRef.current = 0;
    const timer = setTimeout(() => {
      scrollToActiveGroupRobust(false);
      scheduleScrollToActiveGroup();
    }, 150);
    return () => clearTimeout(timer);
  }, [collapsed, disableDrag, activeGroupIndex, scrollToActiveGroupRobust, scheduleScrollToActiveGroup]);

  useEffect(
    () => () => {
      if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
    },
    []
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<GroupedStop> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    []
  );

  const onScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      const itemLen = info.averageItemLength > 0 ? info.averageItemLength : ROW_HEIGHT;
      listRef.current?.scrollToOffset({
        offset: Math.max(0, itemLen * info.index),
        animated: false,
      });
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: info.index,
          animated: true,
          viewPosition: 0.15,
        });
      }, 150);
    },
    []
  );

  const windowHeight = Dimensions.get("window").height;
  const planningMapBarHeight = !disableDrag && !collapsed ? 56 : 0;
  const CHROME_HEIGHT = 110 + planningMapBarHeight;
  const maxExpandedHeight = planningHeaderCollapsed
    ? Math.round(windowHeight * 0.68)
    : Math.round(windowHeight * 0.52);
  const contentHeight = CHROME_HEIGHT + total * ROW_HEIGHT + 16;
  const expandedHeight = Math.min(
    maxExpandedHeight,
    Math.max(CHROME_HEIGHT + 80, contentHeight)
  );
  const listScrollable = contentHeight > maxExpandedHeight;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: 8,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.12,
          shadowRadius: 8,
          elevation: 12,
        },
        handle: {
          alignItems: "center",
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        handleBar: {
          width: 40,
          height: 5,
          borderRadius: 3,
          backgroundColor: colors.textSecondary,
          opacity: 0.45,
          marginBottom: 4,
        },
        collapsedRow: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 16,
          gap: 10,
        },
        collapsedMain: { flex: 1, minWidth: 0 },
        mapToggleBtn: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 8,
          backgroundColor: colors.primary + "18",
          borderWidth: 1,
          borderColor: colors.primary + "40",
        },
        mapToggleBtnActive: {
          backgroundColor: colors.primary,
          borderColor: colors.primary,
        },
        mapToggleText: { fontSize: 13, fontWeight: "700", color: colors.primary },
        mapToggleTextActive: { color: colors.primaryContrast },
        expandHint: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        totalText: { fontSize: 15, fontWeight: "600", color: colors.text },
        optimizeBtn: {
          backgroundColor: colors.primary,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 8,
        },
        optimizeBtnText: { fontSize: 13, fontWeight: "600", color: colors.primaryContrast },
        list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
        listScrollable: { flex: 1, minHeight: 0 },
        empty: {
          paddingVertical: 24,
          alignItems: "center",
        },
        emptyText: { fontSize: 14, color: colors.textSecondary },
        mapBarPrimary: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginHorizontal: 16,
          marginBottom: 8,
          paddingVertical: 14,
          borderRadius: 10,
          backgroundColor: colors.primary,
        },
        mapBarPrimaryText: {
          fontSize: 16,
          fontWeight: "700",
          color: colors.primaryContrast,
        },
      }),
    [colors, collapsed]
  );

  const listContentStyle = { paddingBottom: 8 };

  return (
    <View
      style={[styles.container, !collapsed && { height: expandedHeight }]}
    >
      {collapsed ? (
        <View style={styles.collapsedRow}>
          <TouchableOpacity style={{ flex: 1, minWidth: 0 }} onPress={expandList} activeOpacity={0.85}>
            <View style={styles.handleBar} />
            <View style={styles.collapsedMain}>
              <Text style={styles.totalText} numberOfLines={1}>
                {disableDrag && total > 0
                  ? `${completedCount} de ${total} parada${total !== 1 ? "s" : ""}`
                  : `${total} parada${total !== 1 ? "s" : ""}`}
              </Text>
              <Text style={styles.expandHint}>Toque para ver a lista da rota</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mapToggleBtnActive} onPress={expandList} activeOpacity={0.85}>
            <Ionicons name="list" size={16} color={colors.primaryContrast} />
            <Text style={[styles.mapToggleText, styles.mapToggleTextActive]}>Lista</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={listScrollable ? { flex: 1, minHeight: 0 } : undefined}>
          <TouchableOpacity style={styles.handle} onPress={collapseList} activeOpacity={0.85}>
            <View style={styles.handleBar} />
          </TouchableOpacity>

          {!disableDrag && (
            <TouchableOpacity
              style={styles.mapBarPrimary}
              onPress={collapseList}
              activeOpacity={0.85}
            >
              <Ionicons name="map" size={20} color={colors.primaryContrast} />
              <Text style={styles.mapBarPrimaryText}>Ver mapa</Text>
            </TouchableOpacity>
          )}

          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
              <Text style={styles.totalText} numberOfLines={1} ellipsizeMode="tail">
                {disableDrag && total > 0
                  ? `${completedCount} de ${total} parada${total !== 1 ? "s" : ""}`
                  : `${total} parada${total !== 1 ? "s" : ""}`}
              </Text>
            </View>
            {disableDrag && (
              <TouchableOpacity style={styles.mapToggleBtn} onPress={collapseList} activeOpacity={0.85}>
                <Ionicons name="map" size={16} color={colors.primary} />
                <Text style={styles.mapToggleText}>Mapa</Text>
              </TouchableOpacity>
            )}
            {!disableDrag && (
              <TouchableOpacity
                style={[styles.optimizeBtn, { marginLeft: 8 }]}
                onPress={handleOptimize}
                disabled={total < 2 || optimizing}
              >
                {optimizing ? (
                  <ActivityIndicator size="small" color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.optimizeBtnText}>Otimizar</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.list, listScrollable && styles.listScrollable]}>
            {groupedStops.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Nenhuma entrega na rota</Text>
              </View>
            ) : disableDrag ? (
              <FlatList
                ref={listRef}
                data={groupedStops}
                keyExtractor={(_, index) => `stop-${index}`}
                renderItem={({ item, index }) => renderRow({ item, index })}
                scrollEnabled={listScrollable}
                nestedScrollEnabled={listScrollable}
                contentContainerStyle={listContentStyle}
                getItemLayout={getItemLayout}
                initialScrollIndex={
                  activeGroupIndex > 0 ? activeGroupIndex : undefined
                }
                onLayout={handleListLayout}
                onContentSizeChange={handleContentSizeChange}
                onScrollToIndexFailed={onScrollToIndexFailed}
              />
            ) : (
              <DraggableFlatList
                data={groupedStops}
                keyExtractor={(_, index) => `stop-${index}`}
                renderItem={renderItem}
                onDragEnd={handleDragEnd}
                scrollEnabled={listScrollable}
                contentContainerStyle={listContentStyle}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}
