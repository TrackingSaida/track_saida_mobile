import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { getEntregas } from "../api";
import type { EntregaListItem } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "EntregasList">;

type Tab = "pendente" | "finalizadas" | "ausentes";

const TAB_LABELS: Record<Tab, string> = {
  pendente: "Pendentes",
  finalizadas: "Finalizadas",
  ausentes: "Ausentes",
};

export default function EntregasListScreen({ navigation }: Props) {
  const [tab, setTab] = useState<Tab>("pendente");
  const [list, setList] = useState<EntregaListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEntregas(tab);
      setList(data);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const badgeColor = (exibicao: string) => {
    if (exibicao === "Pendente") return "#ffc107";
    if (exibicao === "Entregue") return "#198754";
    if (exibicao === "Ausente") return "#dc3545";
    return "#6c757d";
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Entregas</Text>
      </View>

      <View style={styles.tabs}>
        {(["pendente", "finalizadas", "ausentes"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {TAB_LABELS[t]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={styles.loader} />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => String(item.id_saida)}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.item}
              onPress={() => navigation.navigate("EntregaDetail", { idSaida: item.id_saida })}
            >
              <View style={styles.itemRow}>
                <Text style={styles.itemCodigo}>{item.codigo || "—"}</Text>
                <View style={[styles.badge, { backgroundColor: badgeColor(item.exibicao) }]}>
                  <Text style={styles.badgeText}>{item.exibicao}</Text>
                </View>
              </View>
              <Text style={styles.itemCliente} numberOfLines={1}>
                {item.cliente || "—"}
              </Text>
              <Text style={styles.itemBairro}>{item.bairro || "—"}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  header: { padding: 16, paddingTop: 48, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  backText: { fontSize: 16, color: "#0d6efd", marginBottom: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: "#0d6efd" },
  tabText: { fontSize: 14, color: "#666" },
  tabTextActive: { color: "#fff", fontWeight: "600" },
  loader: { marginTop: 48 },
  listContent: { padding: 16, paddingBottom: 32 },
  item: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemCodigo: { fontSize: 16, fontWeight: "600" },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  itemCliente: { fontSize: 14, color: "#333" },
  itemBairro: { fontSize: 13, color: "#666", marginTop: 4 },
});
