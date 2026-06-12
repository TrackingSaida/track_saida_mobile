import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import type { EntregaListItem } from "../types";
import {
  formatStopAddress,
  getOrderedRouteDeliveries,
  groupOrderedByAddress,
  servicoTipo,
  type GroupedStop,
} from "../utils/routeUtils";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type RowItem = {
  key: string;
  stopNumber: number;
  codigo: string;
  address: string;
  servico: string | null;
};

function buildRows(
  routeDeliveries: EntregaListItem[],
  routeOrder: number[]
): RowItem[] {
  const ordered = getOrderedRouteDeliveries(routeDeliveries, routeOrder);
  const groups = groupOrderedByAddress(ordered);
  const rows: RowItem[] = [];

  groups.forEach((group: GroupedStop, groupIndex: number) => {
    group.deliveries.forEach((d, pkgIndex) => {
      rows.push({
        key: `${group.stopKey}-${d.id_saida}`,
        stopNumber: groupIndex + 1,
        codigo: d.codigo || `Pedido ${d.id_saida}`,
        address: formatStopAddress(d),
        servico: pkgIndex === 0 ? servicoTipo(d.servico) : null,
      });
    });
  });

  return rows;
}

export type PrepSeparatePackagesSheetProps = {
  visible: boolean;
  routeDeliveries: EntregaListItem[];
  routeOrder: number[];
  onConfirm: () => void;
  onClose: () => void;
};

export default function PrepSeparatePackagesSheet({
  visible,
  routeDeliveries,
  routeOrder,
  onConfirm,
  onClose,
}: PrepSeparatePackagesSheetProps) {
  const colors = useThemeColors();
  const rows = useMemo(
    () => buildRows(routeDeliveries, routeOrder),
    [routeDeliveries, routeOrder]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          maxHeight: "85%",
          paddingBottom: Platform.OS === "ios" ? 28 : 20,
        },
        header: {
          paddingHorizontal: space.lg,
          paddingTop: space.lg,
          paddingBottom: space.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: 4,
        },
        subtitle: {
          fontSize: typo.bodySmall,
          color: colors.textSecondary,
          lineHeight: 20,
        },
        list: {
          paddingHorizontal: space.lg,
          paddingTop: space.sm,
        },
        row: {
          paddingVertical: space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        rowTitle: {
          fontSize: 15,
          fontWeight: "700",
          color: colors.text,
          marginBottom: 4,
        },
        rowAddress: {
          fontSize: 13,
          color: colors.textSecondary,
          lineHeight: 18,
        },
        rowServico: {
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 4,
          fontWeight: "600",
        },
        actions: {
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          gap: space.sm,
        },
        btnPrimary: {
          backgroundColor: colors.primary,
          paddingVertical: space.md,
          borderRadius: radius.lg,
          alignItems: "center",
        },
        btnPrimaryText: {
          color: colors.primaryContrast,
          fontSize: 16,
          fontWeight: "700",
        },
        btnGhost: {
          paddingVertical: space.sm,
          alignItems: "center",
        },
        btnGhostText: {
          fontSize: 15,
          color: colors.textSecondary,
          fontWeight: "600",
        },
      }),
    [colors]
  );

  const renderItem = useCallback(
    ({ item }: { item: RowItem }) => (
      <View style={styles.row}>
        <Text style={styles.rowTitle}>
          Parada {item.stopNumber} · {item.codigo}
        </Text>
        <Text style={styles.rowAddress}>{item.address}</Text>
        {item.servico ? (
          <Text style={styles.rowServico}>{item.servico}</Text>
        ) : null}
      </View>
    ),
    [styles]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Separar pacotes</Text>
            <Text style={styles.subtitle}>
              Confira qual pacote corresponde a cada parada da rota antes de iniciar a entrega.
            </Text>
          </View>
          <FlatList
            style={styles.list}
            data={rows}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            ListEmptyComponent={
              <Text style={[styles.subtitle, { paddingVertical: space.lg }]}>
                Nenhum pacote na rota.
              </Text>
            }
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnPrimary} onPress={onConfirm} activeOpacity={0.9}>
              <Text style={styles.btnPrimaryText}>Conferido — continuar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnGhost} onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.btnGhostText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
