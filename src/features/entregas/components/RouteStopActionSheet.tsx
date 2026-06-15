import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import type { EntregaListItem } from "../types";
import { servicoTipo } from "../utils/servico";
import {
  ADDRESS_REVIEW_LABELS,
  getAddressReviewIssue,
  getApproximateLocationLabel,
  getStopAddressLine,
  getStopPrimaryCodigo,
  type GroupedStop,
} from "../utils/routeUtils";
import type { GeocodedMetaMap, LegacyValidationCache } from "../utils/deliveryDestination";
import RouteChangePositionSheet from "./RouteChangePositionSheet";

const SERVICO_COLORS: Record<string, string> = {
  Shopee: "#EE4D2D",
  Flex: "#F5A623",
  Avulso: "#7B61FF",
};

type IoniconName = ComponentProps<typeof Ionicons>["name"];

interface RouteStopActionSheetProps {
  visible: boolean;
  group: GroupedStop | null;
  stopIndex: number;
  totalStops: number;
  canMutateStop?: boolean;
  isReviewPhase?: boolean;
  isCurrentStop?: boolean;
  minPosition?: number;
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>;
  geocodedMeta?: GeocodedMetaMap;
  legacyValidationCache?: LegacyValidationCache;
  onClose: () => void;
  onNavegar: () => void;
  onVerPedidos: () => void;
  onEditarParada: (delivery: EntregaListItem) => void;
  onConfirmRecalculate: (toIndex: number) => void;
  onConfirmSwapOnly: (toIndex: number) => void;
  onMoverInicio: () => void;
  onMoverFim: () => void;
  onRemover: () => void;
}

type ActionItem = {
  key: string;
  label: string;
  icon: IoniconName;
  destructive?: boolean;
  onPress: () => void;
};

function getLocationBadge(
  delivery: EntregaListItem,
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>,
  geocodedMeta?: GeocodedMetaMap,
  legacyValidationCache?: LegacyValidationCache
): { text: string; tone: "ok" | "warn" | "review" } {
  const reviewIssue = getAddressReviewIssue(
    delivery,
    geocodedCoords,
    geocodedMeta,
    legacyValidationCache
  );
  if (reviewIssue) {
    return { text: ADDRESS_REVIEW_LABELS[reviewIssue], tone: "review" };
  }
  const approx = getApproximateLocationLabel(delivery);
  if (approx) {
    return { text: "Localização aproximada — confira o endereço", tone: "warn" };
  }
  return { text: "Localização confirmada", tone: "ok" };
}

export default function RouteStopActionSheet({
  visible,
  group,
  stopIndex,
  totalStops,
  canMutateStop = true,
  isReviewPhase = false,
  isCurrentStop = false,
  minPosition = 1,
  geocodedCoords,
  geocodedMeta,
  legacyValidationCache,
  onClose,
  onNavegar,
  onVerPedidos,
  onEditarParada,
  onConfirmRecalculate,
  onConfirmSwapOnly,
  onMoverInicio,
  onMoverFim,
  onRemover,
}: RouteStopActionSheetProps) {
  const colors = useThemeColors();
  const [showPositionPicker, setShowPositionPicker] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20,
          paddingBottom: 32,
          maxHeight: "85%",
        },
        stopNumber: {
          fontSize: 28,
          fontWeight: "800",
          color: colors.text,
          marginBottom: 6,
        },
        metaLine: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
        addressLine: { fontSize: 14, color: colors.text, marginBottom: 10, lineHeight: 20 },
        locationBadge: {
          alignSelf: "flex-start",
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 8,
          marginBottom: 10,
        },
        locationBadgeOk: { backgroundColor: colors.success + "20" },
        locationBadgeWarn: { backgroundColor: colors.warning + "20" },
        locationBadgeReview: { backgroundColor: colors.danger + "15" },
        locationBadgeText: { fontSize: 12, fontWeight: "600" },
        locationBadgeTextOk: { color: colors.success },
        locationBadgeTextWarn: { color: colors.warning },
        locationBadgeTextReview: { color: colors.danger },
        annotateHint: {
          fontSize: 12,
          color: colors.textSecondary,
          fontStyle: "italic",
          marginBottom: 12,
        },
        headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 4, gap: 8 },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, flex: 1 },
        badge: {
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
        },
        badgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
        currentBadge: {
          alignSelf: "flex-start",
          backgroundColor: colors.primary + "22",
          borderWidth: 1,
          borderColor: colors.primary,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 6,
          marginBottom: 12,
        },
        currentBadgeText: { fontSize: 11, fontWeight: "700", color: colors.primary },
        subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
        sectionLabel: {
          fontSize: 11,
          fontWeight: "700",
          color: colors.textSecondary,
          letterSpacing: 0.5,
          marginTop: 4,
          marginBottom: 4,
        },
        action: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
          gap: 12,
        },
        actionText: { fontSize: 16, color: colors.text, flex: 1 },
        actionDestructive: { color: colors.danger },
        cancel: { marginTop: 12, alignItems: "center", paddingVertical: 12 },
        cancelText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors]
  );

  const first = group?.deliveries[0];
  const servico = first ? servicoTipo(first.servico) : "";
  const servicoColor = SERVICO_COLORS[servico] || colors.placeholder;
  const packageCount = group?.deliveries.length ?? 0;

  const handleRemover = () => {
    Alert.alert(
      "Remover da rota",
      `Remover ${group?.deliveries.length ?? 0} pedido(s) desta parada da rota?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: () => { onClose(); onRemover(); } },
      ]
    );
  };

  const mainActions: ActionItem[] = [
    { key: "navegar", label: "Navegar", icon: "navigate-outline", onPress: () => { onClose(); onNavegar(); } },
    { key: "pedidos", label: "Ver pedidos", icon: "list-outline", onPress: () => { onClose(); onVerPedidos(); } },
  ];

  const editActions: ActionItem[] = canMutateStop
    ? [
        {
          key: "editar",
          label: "Editar endereço",
          icon: "create-outline",
          onPress: () => {
            if (first) {
              onClose();
              onEditarParada(first);
            }
          },
        },
        {
          key: "posicao",
          label: "Alterar posição",
          icon: "swap-vertical-outline",
          onPress: () => setShowPositionPicker(true),
        },
      ]
    : [];

  const advancedActions: ActionItem[] = canMutateStop
    ? [
        {
          key: "inicio",
          label: "Mover para o início",
          icon: "arrow-up-outline",
          onPress: () => { onClose(); onMoverInicio(); },
        },
        {
          key: "fim",
          label: "Mover para o fim",
          icon: "arrow-down-outline",
          onPress: () => { onClose(); onMoverFim(); },
        },
        {
          key: "remover",
          label: "Remover da rota",
          icon: "trash-outline",
          destructive: true,
          onPress: handleRemover,
        },
      ]
    : [];

  if (!group) return null;

  const locationBadge = first
    ? getLocationBadge(first, geocodedCoords, geocodedMeta, legacyValidationCache)
    : null;

  const renderActions = (items: ActionItem[]) =>
    items.map((a) => (
      <TouchableOpacity key={a.key} style={styles.action} onPress={a.onPress}>
        <Ionicons
          name={a.icon}
          size={22}
          color={a.destructive ? colors.danger : colors.primary}
        />
        <Text style={[styles.actionText, a.destructive && styles.actionDestructive]}>
          {a.label}
        </Text>
      </TouchableOpacity>
    ));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.box} onStartShouldSetResponder={() => true}>
          {showPositionPicker ? (
            <RouteChangePositionSheet
              group={group}
              stopIndex={stopIndex}
              totalStops={totalStops}
              minPosition={minPosition}
              onConfirmRecalculate={(toIndex) => {
                setShowPositionPicker(false);
                onClose();
                onConfirmRecalculate(toIndex);
              }}
              onConfirmSwapOnly={(toIndex) => {
                setShowPositionPicker(false);
                onClose();
                onConfirmSwapOnly(toIndex);
              }}
              onBack={() => setShowPositionPicker(false)}
            />
          ) : isReviewPhase && canMutateStop ? (
            <>
              <Text style={styles.stopNumber}>
                Parada {stopIndex} de {totalStops}
              </Text>
              <Text style={styles.metaLine}>
                {packageCount} pacote{packageCount !== 1 ? "s" : ""}
                {servico ? ` · ${servico}` : ""}
              </Text>
              <Text style={styles.addressLine} numberOfLines={2}>
                {first ? getStopAddressLine(first) : "—"}
              </Text>
              {locationBadge ? (
                <View
                  style={[
                    styles.locationBadge,
                    locationBadge.tone === "ok" && styles.locationBadgeOk,
                    locationBadge.tone === "warn" && styles.locationBadgeWarn,
                    locationBadge.tone === "review" && styles.locationBadgeReview,
                  ]}
                >
                  <Text
                    style={[
                      styles.locationBadgeText,
                      locationBadge.tone === "ok" && styles.locationBadgeTextOk,
                      locationBadge.tone === "warn" && styles.locationBadgeTextWarn,
                      locationBadge.tone === "review" && styles.locationBadgeTextReview,
                    ]}
                  >
                    {locationBadge.text}
                  </Text>
                </View>
              ) : null}
              {packageCount > 1 ? (
                <Text style={styles.annotateHint}>
                  Anote o número {stopIndex} no pacote
                </Text>
              ) : null}
              {renderActions(mainActions)}
              {editActions.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>EDIÇÃO</Text>
                  {renderActions(editActions)}
                </>
              ) : null}
              {advancedActions.length > 0 ? (
                <>
                  <Text style={styles.sectionLabel}>AVANÇADAS</Text>
                  {renderActions(advancedActions)}
                </>
              ) : null}
              <TouchableOpacity style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{getStopPrimaryCodigo(group)}</Text>
                {servico ? (
                  <View style={[styles.badge, { backgroundColor: servicoColor }]}>
                    <Text style={styles.badgeText}>{servico}</Text>
                  </View>
                ) : null}
              </View>
              {isCurrentStop && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>PARADA ATUAL</Text>
                </View>
              )}
              <Text style={styles.subtitle}>
                Parada {stopIndex} de {totalStops}
                {first ? ` · ${first.cliente || "—"}` : ""}
              </Text>
              {renderActions([...mainActions, ...editActions, ...advancedActions])}
              <TouchableOpacity style={styles.cancel} onPress={onClose}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
