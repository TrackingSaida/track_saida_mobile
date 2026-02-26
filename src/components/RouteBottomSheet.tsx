import React, { useMemo, useCallback, useState } from "react";
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
import * as Location from "expo-location";
import DraggableFlatList, {
  type RenderItemParams,
  type DragEndParams,
} from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../theme/colors";
import { useDeliveryStore } from "../store/deliveryStore";
import {
  getOrderedRouteDeliveries,
  groupOrderedByAddress,
  servicoTipo,
  ROUTE_MARKER_COLORS,
  type GroupedStop,
} from "../features/entregas/utils/routeUtils";
import type { EntregaListItem } from "../features/entregas/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function enderecoResumido(d: EntregaListItem): string {
  const parts = [d.endereco, d.bairro].filter(Boolean);
  if (parts.length === 0) return d.endereco_formatado || "—";
  const s = parts.join(", ");
  return s.length > 40 ? s.slice(0, 37) + "…" : s;
}

type RouteItemStatus = "pendente" | "entregue" | "ausente";

function groupStatus(
  deliveries: EntregaListItem[],
  statusMap: Record<number, RouteItemStatus>
): RouteItemStatus {
  const statuses = deliveries.map((d) => statusMap[d.id_saida] ?? "pendente");
  if (statuses.every((s) => s === "entregue")) return "entregue";
  if (statuses.some((s) => s === "ausente")) return "ausente";
  return "pendente";
}

interface GroupedStopRowProps {
  group: GroupedStop;
  stopIndex: number;
  isActive: boolean;
  drag: () => void;
  colors: ReturnType<typeof useThemeColors>;
  status: RouteItemStatus;
  disableDrag?: boolean;
  onPress?: () => void;
}

function GroupedStopRow({
  group,
  stopIndex,
  isActive,
  drag,
  colors,
  status,
  disableDrag,
  onPress,
}: GroupedStopRowProps) {
  const first = group.deliveries[0];
  const tipo = servicoTipo(first?.servico);
  const badgeColor =
    status === "entregue"
      ? colors.success
      : status === "ausente"
        ? colors.danger
        : ROUTE_MARKER_COLORS[tipo];
  const statusLabel = status === "entregue" ? "Entregue" : status === "ausente" ? "Ausente" : tipo;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: "row",
          alignItems: "flex-start",
          paddingVertical: 12,
          paddingHorizontal: 12,
          backgroundColor: colors.backgroundCard,
          borderRadius: 10,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: isActive ? colors.primary : colors.separator,
          opacity: status !== "pendente" ? 0.75 : 1,
        },
        orderBox: {
          width: 40,
          minHeight: 40,
          borderRadius: 8,
          backgroundColor: colors.primary,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 12,
        },
        orderText: { fontSize: 16, fontWeight: "800", color: colors.primaryContrast },
        body: { flex: 1, minWidth: 0 },
        labelRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
        label: { fontSize: 11, color: colors.textSecondary },
        labelValue: { fontSize: 11, fontWeight: "600", color: colors.text },
        badge: {
          alignSelf: "flex-start",
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 4,
          marginBottom: 4,
        },
        badgeText: { fontSize: 11, fontWeight: "600", color: "#fff" },
        destinatario: {
          fontSize: 15,
          fontWeight: "600",
          color: status !== "pendente" ? colors.textSecondary : colors.text,
          marginBottom: 2,
        },
        endereco: { fontSize: 12, color: colors.textSecondary },
      }),
    [colors, isActive, status]
  );

  return (
    <TouchableOpacity
      style={styles.row}
      onLongPress={disableDrag ? undefined : drag}
      delayLongPress={disableDrag ? undefined : 200}
      onPress={onPress}
      activeOpacity={1}
    >
      <View style={styles.orderBox}>
        <Text style={styles.orderText}>{stopIndex ?? 1}</Text>
      </View>
      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{statusLabel}</Text>
        </View>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Parada na rota</Text>
          <Text style={styles.labelValue}>{stopIndex ?? 1}</Text>
          <Text style={styles.label}>Pedidos nesta parada</Text>
          <Text style={styles.labelValue}>{group.deliveries.length}</Text>
        </View>
        <Text style={styles.destinatario} numberOfLines={1} ellipsizeMode="tail">
          {first?.cliente || first?.exibicao || "—"}
        </Text>
        <Text style={styles.endereco} numberOfLines={1} ellipsizeMode="tail">
          {enderecoResumido(first ?? group.deliveries[0])}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function RouteBottomSheet({
  disableDrag = false,
  onStopPress,
}: {
  disableDrag?: boolean;
  onStopPress?: (group: GroupedStop, stopIndex: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [collapsed, setCollapsed] = useState(false);

  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const routeOrder = useDeliveryStore((s) => s.routeOrder);
  const routeDeliveryStatus = useDeliveryStore((s) => s.routeDeliveryStatus);
  const optimizeRoute = useDeliveryStore((s) => s.optimizeRoute);
  const reorderRoute = useDeliveryStore((s) => s.reorderRoute);

  const [optimizing, setOptimizing] = useState(false);

  const ordered = useMemo(
    () => getOrderedRouteDeliveries(routeDeliveries, routeOrder),
    [routeDeliveries, routeOrder]
  );

  const groupedStops = useMemo(() => groupOrderedByAddress(ordered), [ordered]);

  const handleOptimize = useCallback(async () => {
    if (groupedStops.length < 2) return;
    setOptimizing(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        optimizeRoute();
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      optimizeRoute(pos.coords.latitude, pos.coords.longitude);
    } catch {
      optimizeRoute();
    } finally {
      setOptimizing(false);
    }
  }, [groupedStops.length, optimizeRoute]);

  const toggleCollapsed = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => !c);
  }, []);

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
      return (
        <GroupedStopRow
          group={item}
          stopIndex={paradaNumber}
          isActive={isActive}
          drag={drag}
          colors={colors}
          status={groupStatus(item.deliveries, routeDeliveryStatus)}
          disableDrag={disableDrag}
          onPress={onStopPress ? () => onStopPress(item, paradaNumber) : undefined}
        />
      );
    },
    [colors, routeDeliveryStatus, disableDrag, onStopPress]
  );

  const renderRow = useCallback(
    ({ item, index }: { item: GroupedStop; index: number }) => {
      const paradaNumber = (index ?? 0) + 1;
      return (
        <GroupedStopRow
          group={item}
          stopIndex={paradaNumber}
          isActive={false}
          drag={() => {}}
          colors={colors}
          status={groupStatus(item.deliveries, routeDeliveryStatus)}
          disableDrag
          onPress={onStopPress ? () => onStopPress(item, paradaNumber) : undefined}
        />
      );
    },
    [colors, routeDeliveryStatus, onStopPress]
  );

  const total = groupedStops.length;

  const completedCount = useMemo(() => {
    return groupedStops.filter(
      (g) => groupStatus(g.deliveries, routeDeliveryStatus) !== "pendente"
    ).length;
  }, [groupedStops, routeDeliveryStatus]);

  const windowHeight = Dimensions.get("window").height;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: collapsed ? Math.max(8, insets.bottom) : Math.max(12, insets.bottom) + 24,
          maxHeight: windowHeight * 0.78,
          minHeight: 80,
        },
        handle: {
          alignItems: "center",
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        handleBar: {
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.separator,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingVertical: 12,
        },
        totalText: { fontSize: 15, fontWeight: "600", color: colors.text },
        collapsedHint: { fontSize: 12, color: colors.textSecondary, marginLeft: 8 },
        optimizeBtn: {
          backgroundColor: colors.primary,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 8,
        },
        optimizeBtnText: { fontSize: 13, fontWeight: "600", color: colors.primaryContrast },
        list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, flex: 1, minHeight: 200 },
        empty: {
          paddingVertical: 24,
          alignItems: "center",
        },
        emptyText: { fontSize: 14, color: colors.textSecondary },
      }),
    [colors, insets.bottom, collapsed, windowHeight]
  );

  return (
    <View
      style={[
        styles.container,
        collapsed && { minHeight: 104 },
        !collapsed && { height: windowHeight * 0.78 },
      ]}
    >
      {collapsed ? (
        <TouchableOpacity
          style={[styles.handle, { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 0 }]}
          onPress={toggleCollapsed}
          activeOpacity={1}
        >
          <View style={styles.handleBar} />
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 12, minWidth: 0, flexWrap: "wrap" }}>
            <Text style={styles.totalText} numberOfLines={1} ellipsizeMode="tail">
              {disableDrag && total > 0
                ? `${completedCount} de ${total} parada${total !== 1 ? "s" : ""}`
                : `${total} parada${total !== 1 ? "s" : ""}`}
            </Text>
            {total > 0 && (
              <Text style={styles.collapsedHint}>· Toque para expandir</Text>
            )}
          </View>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1, minHeight: 0 }}>
          <TouchableOpacity style={styles.handle} onPress={toggleCollapsed} activeOpacity={1}>
            <View style={styles.handleBar} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 }}>
              <Text style={styles.totalText} numberOfLines={1} ellipsizeMode="tail">
                {disableDrag && total > 0
                  ? `${completedCount} de ${total} parada${total !== 1 ? "s" : ""}`
                  : `${total} parada${total !== 1 ? "s" : ""}`}
              </Text>
            </View>
            {!disableDrag && (
              <TouchableOpacity
                style={styles.optimizeBtn}
                onPress={handleOptimize}
                disabled={total < 2 || optimizing}
              >
                {optimizing ? (
                  <ActivityIndicator size="small" color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.optimizeBtnText}>Otimizar Rota</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.list}>
            {groupedStops.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Nenhuma entrega na rota</Text>
              </View>
            ) : disableDrag ? (
              <FlatList
                data={groupedStops}
                keyExtractor={(_, index) => `stop-${index}`}
                renderItem={({ item, index }) => renderRow({ item, index })}
              />
            ) : (
              <DraggableFlatList
                data={groupedStops}
                keyExtractor={(_, index) => `stop-${index}`}
                renderItem={renderItem}
                onDragEnd={handleDragEnd}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
}
