import React, { useCallback, useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useThemeColors } from "../../../theme/colors";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import EntregaCodigoHeader from "../components/EntregaCodigoHeader";
import { getEntregas } from "../api";
import type { EntregaListItem } from "../types";
import { formatarDiaParaExibicao } from "../utils/quinzena";
import type { MaisStackParamList } from "../../../screens/MaisScreen";

type Props = NativeStackScreenProps<MaisStackParamList, "MinhasEntregasDia">;

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
        endereco: { fontSize: 12, color: colors.textSecondary, marginBottom: 6 },
        recebedor: { fontSize: 12, color: colors.text, marginTop: 4 },
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
    <View style={styles.container}>
      <ScreenHeaderBar
        title={tituloDia}
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />
      <FlatList
        data={entregas}
        keyExtractor={(item) => String(item.id_saida)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => handleItemPress(item.id_saida)} activeOpacity={0.7}>
            <EntregaCodigoHeader
              codigo={item.codigo}
              servico={item.servico}
              exibicao={item.exibicao}
              data={item.data}
              style={{ marginBottom: 8 }}
            />
            <Text style={styles.endereco} numberOfLines={2}>
              {item.endereco_formatado || item.endereco || "—"}
            </Text>
            <Text style={styles.recebedor} numberOfLines={1}>
              Recebedor: {item.cliente ?? "—"}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
