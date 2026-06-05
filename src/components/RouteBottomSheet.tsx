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
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  getStopPrimaryCodigo,
  getStopPedidoLabel,
  getStopAddressLine,
  getStopVolumesSummary,
  type GroupedStop,
} from "../features/entregas/utils/routeUtils";
import type { EntregaListItem } from "../features/entregas/types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
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
  isDragging: boolean;
  isCurrentStop: boolean;
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
          width: 36,
          minHeight: 36,
          borderRadius: 8,
          backgroundColor: isCurrentStop ? colors.primary : badgeColor,
          justifyContent: "center",
          alignItems: "center",
          marginRight: 10,
        },
        orderText: { fontSize: 15, fontWeight: "800", color: "#fff" },
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
        <Text style={styles.pedido}>{first ? getStopPedidoLabel(first) : ""}</Text>
        <Text style={styles.destinatario} numberOfLines={1}>
          {first?.cliente || first?.exibicao || "—"}
        </Text>
        <Text style={styles.meta}>
          {tipo} · {getStopVolumesSummary(group).replace("📦 ", "")}
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
  onStopPress,
}: {
  disableDrag?: boolean;
  activeGroupIndex?: number;
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
      let result;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        result = await optimizeRoute();
      } else {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          result = await optimizeRoute(pos.coords.latitude, pos.coords.longitude);
        } catch {
          result = await optimizeRoute();
        }
      }

      if (!result || result.message === "noop") return;

      if (result.message === "success") {
        Alert.alert("Rota otimizada", "A ordem das paradas foi atualizada com sucesso.");
      } else if (result.message === "partial") {
        Alert.alert(
          "Rota otimizada parcialmente",
          "Alguns endereços sem coordenadas ficaram ao final da rota."
        );
      } else if (result.message === "local_fallback") {
        Alert.alert(
          "Ordenação local",
          "Não foi possível otimizar online; usamos a ordenação local por proximidade."
        );
      }
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
          isDragging={isActive}
          isCurrentStop={activeGroupIndex === (typeof idx === "number" ? idx : -1)}
          drag={drag}
          colors={colors}
          status={groupStatus(item.deliveries, routeDeliveryStatus)}
          disableDrag={disableDrag}
          onPress={onStopPress ? () => onStopPress(item, paradaNumber) : undefined}
        />
      );
    },
    [colors, routeDeliveryStatus, disableDrag, onStopPress, activeGroupIndex]
  );

  const renderRow = useCallback(
    ({ item, index }: { item: GroupedStop; index: number }) => {
      const paradaNumber = (index ?? 0) + 1;
      return (
        <GroupedStopRow
          group={item}
          stopIndex={paradaNumber}
          isDragging={false}
          isCurrentStop={activeGroupIndex === index}
          drag={() => {}}
          colors={colors}
          status={groupStatus(item.deliveries, routeDeliveryStatus)}
          disableDrag
          onPress={onStopPress ? () => onStopPress(item, paradaNumber) : undefined}
        />
      );
    },
    [colors, routeDeliveryStatus, onStopPress, activeGroupIndex]
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
