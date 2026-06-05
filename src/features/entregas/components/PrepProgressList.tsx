import React, { useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import type { EntregaListItem } from "../types";

const ROW_HEIGHT = 64;

interface PrepProgressListProps {
  items: EntregaListItem[];
  onPressItem: (item: EntregaListItem) => void;
}

function addressSummary(d: EntregaListItem): string {
  if (!d.possui_endereco) return "sem endereço";
  const parts = [d.endereco, d.numero].filter(Boolean);
  if (parts.length === 0) return d.endereco_formatado || "com endereço";
  return parts.join(", ");
}

function hasCoords(d: EntregaListItem): boolean {
  return d.latitude != null && d.longitude != null;
}

export default function PrepProgressList({ items, onPressItem }: PrepProgressListProps) {
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
        icon: { fontSize: 16, width: 28 },
        body: { flex: 1, minWidth: 0 },
        codigo: { fontSize: 14, fontWeight: "700", color: colors.text },
        address: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
      }),
    [colors]
  );

  const renderItem = useCallback(
    ({ item }: { item: EntregaListItem }) => {
      const ok = item.possui_endereco && hasCoords(item);
      const partial = item.possui_endereco && !hasCoords(item);
      const icon = ok ? "✓" : partial ? "◐" : "⚠";
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => onPressItem(item)}
          activeOpacity={0.7}
        >
          <Text style={styles.icon}>{icon}</Text>
          <View style={styles.body}>
            <Text style={styles.codigo} numberOfLines={1}>
              {item.codigo || `Pedido ${item.id_saida}`}
            </Text>
            <Text style={styles.address} numberOfLines={1}>
              {addressSummary(item)}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [styles, onPressItem]
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
