import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import type { EntregaListItem } from "../types";
import { deliveryAddressSummary } from "../utils/deliveryAddress";

const ROW_HEIGHT = 64;

interface PrepProgressListProps {
  items: EntregaListItem[];
  onPressItem: (item: EntregaListItem) => void;
  onEditAddress?: (item: EntregaListItem) => void;
}

function hasCoords(d: EntregaListItem): boolean {
  return d.latitude != null && d.longitude != null;
}

export default function PrepProgressList({
  items,
  onPressItem,
  onEditAddress,
}: PrepProgressListProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        list: { flex: 1, minHeight: 200 },
        row: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 4,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
          minHeight: ROW_HEIGHT,
        },
        rowMain: {
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          minWidth: 0,
        },
        icon: { fontSize: 16, width: 28 },
        body: { flex: 1, minWidth: 0 },
        codigo: { fontSize: 14, fontWeight: "700", color: colors.text },
        address: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
        editBtn: {
          padding: 8,
          marginLeft: 4,
        },
      }),
    [colors]
  );

  const renderItem = useCallback(
    ({ item }: { item: EntregaListItem }) => {
      const ok = item.possui_endereco && hasCoords(item);
      const partial = item.possui_endereco && !hasCoords(item);
      const icon = ok ? "✓" : partial ? "◐" : "⚠";
      const canEdit = item.possui_endereco && onEditAddress;
      return (
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.rowMain}
            onPress={() => onPressItem(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{icon}</Text>
            <View style={styles.body}>
              <Text style={styles.codigo} numberOfLines={1}>
                {item.codigo || `Pedido ${item.id_saida}`}
              </Text>
              <Text style={styles.address} numberOfLines={1}>
                {deliveryAddressSummary(item)}
              </Text>
            </View>
          </TouchableOpacity>
          {canEdit ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => onEditAddress(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Editar endereço"
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          ) : null}
        </View>
      );
    },
    [styles, onPressItem, onEditAddress, colors.primary]
  );

  return (
    <FlatList
      style={styles.list}
      data={items}
      keyExtractor={(item) => String(item.id_saida)}
      renderItem={renderItem}
      getItemLayout={(_, index) => ({
        length: ROW_HEIGHT,
        offset: ROW_HEIGHT * index,
        index,
      })}
      initialNumToRender={20}
      maxToRenderPerBatch={25}
      windowSize={11}
      removeClippedSubviews
    />
  );
}
