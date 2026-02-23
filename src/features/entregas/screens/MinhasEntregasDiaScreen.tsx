import React, { useCallback, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeColors } from "../../../theme/colors";
import { getEntregas } from "../api";
import type { EntregaListItem } from "../types";
import { formatarDiaParaExibicao } from "../utils/quinzena";
import type { MaisStackParamList } from "../../../screens/MaisScreen";

type Props = NativeStackScreenProps<MaisStackParamList, "MinhasEntregasDia">;

function servicoTipo(serv?: string | null): "Shopee" | "Flex" | "Avulso" {
  const s = (serv || "").trim().toLowerCase();
  if (s.includes("shopee")) return "Shopee";
  if (s.includes("mercado") || s.includes("ml") || s.includes("flex")) return "Flex";
  return "Avulso";
}

const SERVICO_COLORS: Record<string, string> = {
  Shopee: "#ee4d2d",
  Flex: "#ffe066",
  Avulso: "#6366f1",
};

function getDayKey(item: EntregaListItem): string | null {
  const dataStr = item.data_hora_entrega || item.data;
  if (!dataStr) return null;
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return null;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return null;
  }
}

export default function MinhasEntregasDiaScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { justifyContent: "center", alignItems: "center" },
        backBtn: { paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8 },
        backText: { fontSize: 16, color: colors.primary },
        title: { fontSize: 22, fontWeight: "700", marginBottom: 12, paddingHorizontal: 16, color: colors.text },
        listContent: { padding: 16, paddingBottom: 48 },
        card: {
          backgroundColor: colors.backgroundCard,
          padding: 10,
          marginBottom: 8,
          borderRadius: 10,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        codigo: { fontSize: 14, fontWeight: "600", color: colors.text, marginBottom: 4 },
        endereco: { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
        rowMeta: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 4,
        },
        recebedor: { fontSize: 12, color: colors.text, flex: 1, minWidth: 0 },
        servicoBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4 },
        servicoBadgeText: { fontSize: 11, color: colors.text, fontWeight: "600" },
        badge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 4 },
        badgeOk: { backgroundColor: colors.success },
        badgeFail: { backgroundColor: colors.danger },
        badgeText: { fontSize: 11, color: colors.primaryContrast, fontWeight: "600" },
      }),
    [colors]
  );
  const { data: dataParam } = route.params;
  const [loading, setLoading] = useState(true);
  const [entregas, setEntregas] = useState<EntregaListItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fin, aus] = await Promise.all([getEntregas("finalizadas"), getEntregas("ausentes")]);
      const all = [...(fin ?? []), ...(aus ?? [])];
      const filtered = all.filter((item) => getDayKey(item) === dataParam);
      setEntregas(filtered);
    } catch {
      setEntregas([]);
    } finally {
      setLoading(false);
    }
  }, [dataParam]);

  React.useEffect(() => {
    load();
  }, [load]);

  const tituloDia = useMemo(() => formatarDiaParaExibicao(dataParam), [dataParam]);

  const handleItemPress = (idSaida: number) => {
    navigation.navigate("EntregaDetail", { idSaida });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Math.max(24, insets.top) }]}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{tituloDia}</Text>
      <FlatList
        data={entregas}
        keyExtractor={(item) => String(item.id_saida)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const tipo = servicoTipo(item.servico);
          const corServico = SERVICO_COLORS[tipo] ?? "#999";
          return (
            <TouchableOpacity style={styles.card} onPress={() => handleItemPress(item.id_saida)} activeOpacity={0.7}>
              <Text style={styles.codigo}>{item.codigo ?? "—"}</Text>
              <Text style={styles.endereco} numberOfLines={2}>{item.endereco_formatado || item.endereco || "—"}</Text>
              <View style={styles.rowMeta}>
                <Text style={styles.recebedor} numberOfLines={1}>Recebedor: {item.cliente ?? "—"}</Text>
                <View style={[styles.servicoBadge, { backgroundColor: corServico }]}>
                  <Text style={styles.servicoBadgeText}>{tipo}</Text>
                </View>
                <View style={[styles.badge, item.exibicao === "Entregue" ? styles.badgeOk : styles.badgeFail]}>
                  <Text style={styles.badgeText}>{item.exibicao}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
