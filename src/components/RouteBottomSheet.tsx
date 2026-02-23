import React, { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
  type DragEndParams,
} from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../theme/colors";
import { useDeliveryStore } from "../store/deliveryStore";
import {
  getOrderedRouteDeliveries,
  servicoTipo,
  ROUTE_MARKER_COLORS,
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

interface RouteItemProps {
  item: EntregaListItem;
  index: number;
  isActive: boolean;
  drag: () => void;
  colors: ReturnType<typeof useThemeColors>;
  status: RouteItemStatus;
  routeOrder: number[];
}

function RouteItemRow({ item, index, isActive, drag, colors, status, routeOrder }: RouteItemProps) {
  const idx = routeOrder.indexOf(item.id_saida);
  const routeNumber = idx >= 0 ? idx + 1 : 0;
  const orderDisplay = routeNumber >= 1 ? String(routeNumber) : "—";
  const tipo = servicoTipo(item.servico);
  const badgeColor =
    status === "entregue"
      ? colors.success
      : status === "ausente"
        ? colors.danger
        : ROUTE_MARKER_COLORS[tipo];
  const statusLabel = status === "entregue" ? "Entregue" : status === "ausente" ? "Ausente" : tipo;
  const pacotesLabel =
    "quantidade_pacotes" in item && item.quantidade_pacotes != null
      ? String(item.quantidade_pacotes)
      : "—";
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
          opacity: status !== "pendente" ? 0.9 : 1,
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
        body: { flex: 1 },
        badge: {
          alignSelf: "flex-start",
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 4,
          marginBottom: 4,
        },
        badgeText: { fontSize: 11, fontWeight: "600", color: "#fff" },
        destinatario: { fontSize: 15, fontWeight: "600", color: colors.text, marginBottom: 2 },
        endereco: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
        pacotes: { fontSize: 11, color: colors.textSecondary },
      }),
    [colors, isActive, status]
  );

  return (
    <TouchableOpacity
      style={styles.row}
      onLongPress={drag}
      delayLongPress={200}
      activeOpacity={1}
    >
      <View style={styles.orderBox}>
        <Text style={styles.orderText}>{orderDisplay}</Text>
      </View>
      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          <Text style={styles.badgeText}>{statusLabel}</Text>
        </View>
        <Text style={styles.destinatario} numberOfLines={1}>
          {item.cliente || item.exibicao || "—"}
        </Text>
        <Text style={styles.endereco} numberOfLines={1}>
          {enderecoResumido(item)}
        </Text>
        <Text style={styles.pacotes}>Pacotes nesta parada: {pacotesLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function RouteBottomSheet() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [collapsed, setCollapsed] = useState(false);

  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const routeOrder = useDeliveryStore((s) => s.routeOrder);
  const routeDeliveryStatus = useDeliveryStore((s) => s.routeDeliveryStatus);
  const optimizeRoute = useDeliveryStore((s) => s.optimizeRoute);
  const reorderRoute = useDeliveryStore((s) => s.reorderRoute);

  const ordered = useMemo(
    () => getOrderedRouteDeliveries(routeDeliveries, routeOrder),
    [routeDeliveries, routeOrder]
  );

  const toggleCollapsed = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((c) => !c);
  }, []);

  const handleDragEnd = useCallback(
    ({ data }: DragEndParams<EntregaListItem>) => {
      reorderRoute(data.map((d) => d.id_saida));
    },
    [reorderRoute]
  );

  const renderItem = useCallback(
    ({ item, index, drag, isActive }: RenderItemParams<EntregaListItem>) => (
      <RouteItemRow
        item={item}
        index={index}
        isActive={isActive}
        drag={drag}
        colors={colors}
        status={routeDeliveryStatus[item.id_saida] ?? "pendente"}
        routeOrder={routeOrder}
      />
    ),
    [colors, routeDeliveryStatus, routeOrder]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: Math.max(16, insets.bottom),
          maxHeight: "50%",
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
        optimizeBtn: {
          backgroundColor: colors.primary,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 8,
        },
        optimizeBtnText: { fontSize: 13, fontWeight: "600", color: colors.primaryContrast },
        list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, height: 280 },
        empty: {
          paddingVertical: 24,
          alignItems: "center",
        },
        emptyText: { fontSize: 14, color: colors.textSecondary },
      }),
    [colors, insets.bottom]
  );

  const total = ordered.length;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.handle} onPress={toggleCollapsed} activeOpacity={1}>
        <View style={styles.handleBar} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.totalText}>
          {total} parada{total !== 1 ? "s" : ""}
        </Text>
        <TouchableOpacity
          style={styles.optimizeBtn}
          onPress={optimizeRoute}
          disabled={total < 2}
        >
          <Text style={styles.optimizeBtnText}>Otimizar Rota</Text>
        </TouchableOpacity>
      </View>

      {!collapsed && (
        <View style={styles.list}>
          {ordered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhuma entrega na rota</Text>
            </View>
          ) : (
            <DraggableFlatList
              data={ordered}
              keyExtractor={(item) => String(item.id_saida)}
              renderItem={renderItem}
              onDragEnd={handleDragEnd}
            />
          )}
        </View>
      )}
    </View>
  );
}
