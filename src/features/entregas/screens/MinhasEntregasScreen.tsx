import React, { useCallback, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeColors } from "../../../theme/colors";
import { getEntregas } from "../api";
import type { EntregaListItem } from "../types";
import { getDiasQuinzenaAtualEAnterior, formatarDiaParaExibicao } from "../utils/quinzena";
import type { MaisStackParamList } from "../../../screens/MaisScreen";

type Props = NativeStackScreenProps<MaisStackParamList, "MinhasEntregas">;

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

export default function MinhasEntregasScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        centered: { justifyContent: "center", alignItems: "center" },
        backBtn: { paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8 },
        backText: { fontSize: 16, color: colors.primary },
        title: { fontSize: 22, fontWeight: "700", marginBottom: 16, paddingHorizontal: 16, color: colors.text },
        listContent: { padding: 16, paddingBottom: 48 },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.backgroundCard,
          padding: 16,
          marginBottom: 8,
          borderRadius: 12,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
        },
        rowLeft: { flex: 1 },
        rowDate: { fontSize: 16, fontWeight: "600", color: colors.text, marginBottom: 4 },
        rowResumo: { fontSize: 14, color: colors.textSecondary },
        chevron: { fontSize: 24, color: colors.placeholder, marginLeft: 8 },
      }),
    [colors]
  );
  const [loading, setLoading] = useState(true);
  const [finalizadas, setFinalizadas] = useState<EntregaListItem[]>([]);
  const [ausentes, setAusentes] = useState<EntregaListItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fin, aus] = await Promise.all([getEntregas("finalizadas"), getEntregas("ausentes")]);
      setFinalizadas(fin ?? []);
      setAusentes(aus ?? []);
    } catch {
      setFinalizadas([]);
      setAusentes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const diasQuinzena = useMemo(() => getDiasQuinzenaAtualEAnterior(), []);

  const porDia = useMemo(() => {
    const all = [...(finalizadas ?? []), ...(ausentes ?? [])];
    const map: Record<string, { entregues: number; falhas: number; total: number }> = {};
    diasQuinzena.forEach((d) => {
      map[d] = { entregues: 0, falhas: 0, total: 0 };
    });
    all.forEach((item) => {
      const key = getDayKey(item);
      if (!key || !map[key]) return;
      if (item.exibicao === "Entregue" || item.status === "ENTREGUE") {
        map[key].entregues += 1;
      } else {
        map[key].falhas += 1;
      }
      map[key].total += 1;
    });
    return diasQuinzena
      .filter((d) => map[d].total > 0)
      .map((data) => ({
        data,
        label: formatarDiaParaExibicao(data),
        ...map[data],
      }))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [finalizadas, ausentes, diasQuinzena]);

  const handleDiaPress = (data: string) => {
    navigation.navigate("MinhasEntregasDia", { data });
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
      <Text style={styles.title}>Minhas Entregas</Text>
      <FlatList
        data={porDia}
        keyExtractor={(item) => item.data}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const resumo =
            item.falhas === 0
              ? `${item.total} entregues (${item.entregues} bem-sucedidas)`
              : `${item.total} entregues (${item.entregues} bem-sucedidas, ${item.falhas} falhas)`;
          return (
            <TouchableOpacity style={styles.row} onPress={() => handleDiaPress(item.data)} activeOpacity={0.7}>
              <View style={styles.rowLeft}>
                <Text style={styles.rowDate}>{item.label}</Text>
                <Text style={styles.rowResumo}>{resumo}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
