import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import type { EntregaListItem } from "../types";
import { servicoTipo } from "../utils/servico";
import {
  getStopPrimaryCodigo,
  getStopPedidoLabel,
  type GroupedStop,
} from "../utils/routeUtils";

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
  isCurrentStop?: boolean;
  minPosition?: number;
  onClose: () => void;
  onNavegar: () => void;
  onVerPedidos: () => void;
  onEditarParada: (delivery: EntregaListItem) => void;
  onAlterarPosicao: (toIndex: number) => void;
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

export default function RouteStopActionSheet({
  visible,
  group,
  stopIndex,
  totalStops,
  canMutateStop = true,
  isCurrentStop = false,
  minPosition = 1,
  onClose,
  onNavegar,
  onVerPedidos,
  onEditarParada,
  onAlterarPosicao,
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
        pickerTitle: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 12 },
        pickerItem: {
          paddingVertical: 12,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          marginBottom: 8,
        },
        pickerItemActive: { borderWidth: 1, borderColor: colors.primary },
        pickerItemText: { fontSize: 15, color: colors.text },
      }),
    [colors]
  );

  const first = group?.deliveries[0];
  const servico = first ? servicoTipo(first.servico) : "";
  const servicoColor = SERVICO_COLORS[servico] || colors.placeholder;

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

  const actions: ActionItem[] = [
    { key: "navegar", label: "Navegar", icon: "navigate-outline", onPress: () => { onClose(); onNavegar(); } },
    { key: "pedidos", label: "Ver pedidos", icon: "list-outline", onPress: () => { onClose(); onVerPedidos(); } },
    {
      key: "editar",
      label: "Editar parada",
      icon: "create-outline",
      onPress: () => {
        if (first) {
          onClose();
          onEditarParada(first);
        }
      },
    },
  ];

  if (canMutateStop) {
    actions.push(
      {
        key: "posicao",
        label: "Alterar posição",
        icon: "swap-vertical-outline",
        onPress: () => setShowPositionPicker(true),
      },
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
      }
    );
  }

  if (!group) return null;

  const positions = Array.from({ length: totalStops }, (_, i) => i + 1).filter(
    (pos) => pos >= minPosition
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.box} onStartShouldSetResponder={() => true}>
          {showPositionPicker ? (
            <>
              <Text style={styles.pickerTitle}>Mover para posição</Text>
              <FlatList
                data={positions}
                keyExtractor={(n) => String(n)}
                renderItem={({ item: pos }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, pos === stopIndex && styles.pickerItemActive]}
                    onPress={() => {
                      setShowPositionPicker(false);
                      onClose();
                      onAlterarPosicao(pos - 1);
                    }}
                  >
                    <Text style={styles.pickerItemText}>
                      Posição {pos}{pos === stopIndex ? " (atual)" : ""}
                    </Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.cancel} onPress={() => setShowPositionPicker(false)}>
                <Text style={styles.cancelText}>Voltar</Text>
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
                Parada {stopIndex} · {first ? getStopPedidoLabel(first) : ""} · {first?.cliente || "—"}
              </Text>
              {actions.map((a) => (
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
              ))}
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
