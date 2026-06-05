import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Share,
  FlatList,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { copyToClipboard } from "../../../utils/clipboard";
import type { EntregaListItem } from "../types";
import {
  getStopPrimaryCodigo,
  getStopAddressLine,
  getStopPedidoLabel,
  type GroupedStop,
} from "../utils/routeUtils";

interface RouteStopActionSheetProps {
  visible: boolean;
  group: GroupedStop | null;
  stopIndex: number;
  totalStops: number;
  disableMutations?: boolean;
  onClose: () => void;
  onNavegar: () => void;
  onVerPedidos: () => void;
  onEditarEndereco: (delivery: EntregaListItem) => void;
  onAlterarPosicao: (toIndex: number) => void;
  onMoverInicio: () => void;
  onMoverFim: () => void;
  onRemover: () => void;
}

type ActionItem = {
  key: string;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

export default function RouteStopActionSheet({
  visible,
  group,
  stopIndex,
  totalStops,
  disableMutations,
  onClose,
  onNavegar,
  onVerPedidos,
  onEditarEndereco,
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
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
        subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 16 },
        action: {
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        actionText: { fontSize: 16, color: colors.text },
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
  const address = first ? getStopAddressLine(first) : "";

  const handleCopiarNumero = async () => {
    const copied = await copyToClipboard(String(stopIndex));
    if (copied) {
      Alert.alert("Copiado", `Número da parada ${stopIndex} copiado.`);
    }
  };

  const handleCopiarEndereco = async () => {
    if (!address || address === "—") {
      Alert.alert("Atenção", "Endereço indisponível para copiar.");
      return;
    }
    await Share.share({ message: address, title: "Endereço da parada" });
  };

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
    { key: "navegar", label: "Navegar", onPress: () => { onClose(); onNavegar(); } },
    { key: "pedidos", label: "Ver pedidos", onPress: () => { onClose(); onVerPedidos(); } },
    {
      key: "editar",
      label: "Editar endereço",
      onPress: () => {
        if (first) {
          onClose();
          onEditarEndereco(first);
        }
      },
    },
    { key: "copiar_num", label: "Copiar número da parada", onPress: handleCopiarNumero },
    { key: "copiar", label: "Copiar endereço", onPress: handleCopiarEndereco },
  ];

  if (!disableMutations) {
    actions.push(
      {
        key: "posicao",
        label: "Alterar posição",
        onPress: () => setShowPositionPicker(true),
      },
      {
        key: "inicio",
        label: "Mover para o início",
        onPress: () => { onClose(); onMoverInicio(); },
      },
      {
        key: "fim",
        label: "Mover para o fim",
        onPress: () => { onClose(); onMoverFim(); },
      },
      {
        key: "remover",
        label: "Remover da rota",
        destructive: true,
        onPress: handleRemover,
      }
    );
  }

  if (!group) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.box} onStartShouldSetResponder={() => true}>
          {showPositionPicker ? (
            <>
              <Text style={styles.pickerTitle}>Mover para posição</Text>
              <FlatList
                data={Array.from({ length: totalStops }, (_, i) => i + 1)}
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
              <Text style={styles.title}>{getStopPrimaryCodigo(group)}</Text>
              <Text style={styles.subtitle}>
                Parada {stopIndex} · {first ? getStopPedidoLabel(first) : ""} · {first?.cliente || "—"}
              </Text>
              {actions.map((a) => (
                <TouchableOpacity key={a.key} style={styles.action} onPress={a.onPress}>
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
