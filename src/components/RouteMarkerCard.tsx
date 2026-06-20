import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";

const DEFAULT_SCROLL_MAX_HEIGHT = Dimensions.get("window").height * 0.55;
import { useThemeColors } from "../theme/colors";
import EntregaCodigoHeader from "../features/entregas/components/EntregaCodigoHeader";
import type { EntregaListItem } from "../features/entregas/types";
import {
  getStopAddressLine,
  getApproximateLocationLabel,
  type GroupedStop,
  type RouteDeliveryStatus,
} from "../features/entregas/utils/routeUtils";

export interface RouteMarkerCardProps {
  delivery: EntregaListItem;
  group?: GroupedStop;
  status: RouteDeliveryStatus;
  orderNumber?: number;
  totalStops?: number;
  maxScrollHeight?: number;
  deliveryStatusMap?: Record<number, RouteDeliveryStatus>;
  canMarkDelivery?: boolean;
  onClose: () => void;
  onMarcarEntregue: () => void;
  onMarcarAusente: () => void;
  onMarcarEntregueFor?: (delivery: EntregaListItem) => void;
  onMarcarAusenteFor?: (delivery: EntregaListItem) => void;
  onNavegar: () => void;
  onLocalizarPacote?: () => void;
  onEditarParada?: () => void;
  onSelectDelivery?: (delivery: EntregaListItem) => void;
}

export default function RouteMarkerCard({
  delivery,
  group,
  status,
  orderNumber,
  totalStops,
  maxScrollHeight = DEFAULT_SCROLL_MAX_HEIGHT,
  deliveryStatusMap = {},
  canMarkDelivery = true,
  onClose,
  onMarcarEntregue,
  onMarcarAusente,
  onMarcarEntregueFor,
  onMarcarAusenteFor,
  onNavegar,
  onLocalizarPacote,
  onEditarParada,
  onSelectDelivery,
}: RouteMarkerCardProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          borderWidth: 1,
          borderColor: colors.separator,
          overflow: "hidden",
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 8,
        },
        scroll: { maxHeight: maxScrollHeight },
        scrollContent: { paddingHorizontal: 16, paddingBottom: 16 },
        close: { padding: 4 },
        closeText: { fontSize: 18, color: colors.textSecondary, fontWeight: "600" },
        title: { fontSize: 20, fontWeight: "800", color: colors.text },
        pedidosMeta: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
        codigoRow: {
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          gap: 8,
        },
        codigoRowSelected: {
          borderColor: colors.primary,
          borderWidth: 2,
          backgroundColor: colors.primary + "12",
        },
        codigoRowDone: { opacity: 0.55 },
        inlineActionsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
        inlineBtn: {
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 6,
          alignItems: "center",
          justifyContent: "center",
        },
        inlineBtnEntregue: { backgroundColor: colors.success },
        inlineBtnAusente: { backgroundColor: colors.danger },
        inlineBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
        selectedLabel: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.text,
          marginBottom: 10,
          marginTop: 4,
        },
        addressValue: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 16 },
        approxBadge: {
          fontSize: 12,
          fontWeight: "600",
          color: colors.warning,
          marginBottom: 8,
        },
        actionRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
        actionBtn: {
          flex: 1,
          paddingVertical: 10,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        actionBtnText: { fontSize: 12, fontWeight: "700", color: colors.primary },
        row: { flexDirection: "row", gap: 10, marginTop: 4 },
        btn: {
          flex: 1,
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
        },
        btnEntregue: { backgroundColor: colors.success },
        btnAusente: { backgroundColor: colors.danger },
        btnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
        statusBadge: {
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
          alignSelf: "flex-start",
        },
        statusBadgeText: { fontSize: 12, fontWeight: "600", color: "#fff" },
        hintText: { fontSize: 13, color: colors.textSecondary, textAlign: "center", marginTop: 8, marginBottom: 4 },
      }),
    [colors, maxScrollHeight]
  );

  const displayDelivery = group?.representativeDelivery ?? delivery;
  const packageCount = group?.deliveries.length ?? 1;
  const multiPackage = packageCount > 1;
  const podeAcoesRodape =
    !multiPackage &&
    (deliveryStatusMap[delivery.id_saida] ?? status) === "pendente" &&
    canMarkDelivery;
  const deliveriesList = group?.deliveries ?? [delivery];
  const navDelivery =
    group?.deliveries.find((d) => d.latitude != null && d.longitude != null) ?? displayDelivery;
  const temCoords = navDelivery.latitude != null && navDelivery.longitude != null;
  const showStartRouteHint =
    !canMarkDelivery &&
    deliveriesList.some((d) => (deliveryStatusMap[d.id_saida] ?? "pendente") === "pendente");
  const selectedCodigo = delivery.codigo?.trim() || "—";
  const approximateLabel = getApproximateLocationLabel(displayDelivery);

  const renderPackageRow = (d: EntregaListItem) => {
    const dStatus = deliveryStatusMap[d.id_saida] ?? "pendente";
    const isSelected = !multiPackage && d.id_saida === delivery.id_saida;
    const exibicao =
      d.exibicao ??
      (dStatus === "entregue" ? "Entregue" : dStatus === "ausente" ? "Ausente" : "Pendente");
    const showInlineActions =
      multiPackage && canMarkDelivery && dStatus === "pendente";

    const rowContent = (
      <>
        <EntregaCodigoHeader
          codigo={d.codigo}
          servico={d.servico}
          exibicao={exibicao}
          data={d.data}
          compact
        />
        {showInlineActions && (
          <View style={styles.inlineActionsRow}>
            <TouchableOpacity
              style={[styles.inlineBtn, styles.inlineBtnEntregue]}
              onPress={() => onMarcarEntregueFor?.(d)}
              activeOpacity={0.85}
            >
              <Text style={styles.inlineBtnText}>Entregue</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.inlineBtn, styles.inlineBtnAusente]}
              onPress={() => onMarcarAusenteFor?.(d)}
              activeOpacity={0.85}
            >
              <Text style={styles.inlineBtnText}>Ausente</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );

    if (!multiPackage && onSelectDelivery) {
      return (
        <TouchableOpacity
          key={d.id_saida}
          style={[
            styles.codigoRow,
            isSelected && styles.codigoRowSelected,
            dStatus !== "pendente" && styles.codigoRowDone,
          ]}
          onPress={() => onSelectDelivery(d)}
          activeOpacity={0.7}
        >
          {rowContent}
        </TouchableOpacity>
      );
    }

    return (
      <View
        key={d.id_saida}
        style={[styles.codigoRow, dStatus !== "pendente" && styles.codigoRowDone]}
      >
        {rowContent}
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          {orderNumber != null && (
            <Text style={styles.title}>
              Parada {orderNumber}
              {totalStops != null ? ` de ${totalStops}` : ""}
            </Text>
          )}
          <Text style={styles.pedidosMeta}>
            📦 {packageCount} pedido{packageCount !== 1 ? "s" : ""}
          </Text>
        </View>
        {!multiPackage && status !== "pendente" && (
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: status === "entregue" ? colors.success : colors.danger },
            ]}
          >
            <Text style={styles.statusBadgeText}>{status === "entregue" ? "Entregue" : "Ausente"}</Text>
          </View>
        )}
        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {deliveriesList.map(renderPackageRow)}

        {!multiPackage && (
          <Text style={styles.selectedLabel}>
            Pacote selecionado:{" "}
            <Text style={{ color: colors.primary, fontWeight: "800" }}>{selectedCodigo}</Text>
          </Text>
        )}

        <Text style={styles.addressValue}>{getStopAddressLine(displayDelivery)}</Text>
        {approximateLabel ? (
          <Text style={styles.approxBadge}>{approximateLabel}</Text>
        ) : null}

        <View style={styles.actionRow}>
          {temCoords && (
            <TouchableOpacity style={styles.actionBtn} onPress={onNavegar}>
              <Text style={styles.actionBtnText}>Navegar</Text>
            </TouchableOpacity>
          )}
          {onLocalizarPacote && (
            <TouchableOpacity style={styles.actionBtn} onPress={onLocalizarPacote}>
              <Text style={styles.actionBtnText}>Localizar pacote</Text>
            </TouchableOpacity>
          )}
          {onEditarParada && (
            <TouchableOpacity style={styles.actionBtn} onPress={onEditarParada}>
              <Text style={styles.actionBtnText}>Editar parada</Text>
            </TouchableOpacity>
          )}
        </View>

        {podeAcoesRodape && (
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnEntregue]} onPress={onMarcarEntregue}>
              <Text style={styles.btnText}>Marcar Entregue</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnAusente]} onPress={onMarcarAusente}>
              <Text style={styles.btnText}>Marcar Ausente</Text>
            </TouchableOpacity>
          </View>
        )}

        {showStartRouteHint && (
          <Text style={styles.hintText}>Inicie a rota para marcar entregas.</Text>
        )}
      </ScrollView>
    </View>
  );
}
