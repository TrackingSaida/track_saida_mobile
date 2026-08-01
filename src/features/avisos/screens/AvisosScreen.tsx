import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import type { MaisStackParamList } from "../../../screens/MaisScreen";
import { listAvisos, type AvisoItem } from "../api";

type Props = NativeStackScreenProps<MaisStackParamList, "Avisos">;

export default function AvisosScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const [items, setItems] = useState<AvisoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      setItems(await listAvisos());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: space.md,
          marginHorizontal: space.md,
          marginBottom: space.sm,
          borderWidth: 1,
          borderColor: colors.border,
        },
        unread: { borderColor: colors.primary, borderWidth: 2 },
        title: { fontSize: 16, fontWeight: "800", color: colors.text },
        badge: {
          alignSelf: "flex-start",
          marginTop: 6,
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 8,
          backgroundColor: "#FEE2E2",
        },
        badgeText: { fontSize: 11, fontWeight: "800", color: "#B91C1C" },
        preview: { marginTop: 8, color: colors.textSecondary, fontSize: 14 },
        empty: { textAlign: "center", color: colors.textSecondary, marginTop: 40 },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Avisos" onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum aviso por enquanto.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.card, !item.lido && styles.unread]}
              onPress={() => navigation.navigate("AvisoDetail", { avisoId: item.id })}
            >
              <Text style={styles.title}>{item.titulo}</Text>
              {item.prioridade === "urgente" ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>URGENTE</Text>
                </View>
              ) : null}
              <Text style={styles.preview} numberOfLines={2}>
                {item.mensagem}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
