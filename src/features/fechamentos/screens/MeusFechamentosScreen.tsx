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
import { listFechamentos, type FechamentoItem } from "../api";

type Props = NativeStackScreenProps<MaisStackParamList, "MeusFechamentos">;

function fmtBrl(v: number | string): string {
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(ymd?: string): string {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-");
  return d && m && y ? `${d}/${m}/${y}` : ymd;
}

export default function MeusFechamentosScreen({ navigation }: Props) {
  const colors = useThemeColors();
  const [items, setItems] = useState<FechamentoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    try {
      setItems(await listFechamentos());
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
        code: { fontSize: 13, fontWeight: "700", color: colors.textSecondary },
        period: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: 4 },
        row: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
        value: { fontSize: 18, fontWeight: "800", color: colors.primary },
        status: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
        empty: { textAlign: "center", color: colors.textSecondary, marginTop: 40, paddingHorizontal: 24 },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Meus fechamentos" onBack={() => navigation.goBack()} />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id_fechamento)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
          ListEmptyComponent={<Text style={styles.empty}>Nenhum fechamento disponível ainda.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate("FechamentoDetail", { idFechamento: item.id_fechamento })}
            >
              <Text style={styles.code}>{item.codigo}</Text>
              <Text style={styles.period}>
                {fmtDate(item.periodo_inicio)} a {fmtDate(item.periodo_fim)}
              </Text>
              <View style={styles.row}>
                <Text style={styles.value}>{fmtBrl(item.valor_final)}</Text>
                <Text style={styles.status}>{(item.status || "").toUpperCase()}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
