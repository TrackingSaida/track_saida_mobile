import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { formatApiError } from "../../../utils/formatApiError";
import { consultarSituacaoColetas, type SituacaoBaseColeta } from "../coletasApi";

type Filtro = "todos" | "pendente" | "em_coleta" | "coletado";

function hojeLocal() {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function statusNormalizado(status: SituacaoBaseColeta["status"]): Exclude<Filtro, "todos"> {
  return status === "sem_volume" ? "coletado" : status;
}

function statusLabel(status: SituacaoBaseColeta["status"]) {
  const normal = statusNormalizado(status);
  if (normal === "em_coleta") return "Em coleta";
  if (normal === "coletado") return "Coletada";
  return "Pendente";
}

export default function ConsultarColetasScreen() {
  const navigation = useNavigation();
  const colors = useThemeColors();
  const [itens, setItens] = useState<SituacaoBaseColeta[]>([]);
  const [resumo, setResumo] = useState({ pendentes: 0, em_coleta: 0, coletadas: 0 });
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  const styles = useMemo(() => StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 40, gap: 12 },
    resumo: { flexDirection: "row", gap: 8 },
    kpi: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundCard },
    kpiValue: { color: colors.text, fontSize: 23, fontWeight: "900" },
    kpiLabel: { color: colors.textSecondary, fontSize: 11, marginTop: 3 },
    filtros: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    filtro: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
    filtroAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
    filtroText: { color: colors.text, fontWeight: "700", fontSize: 12 },
    filtroTextAtivo: { color: colors.primaryContrast },
    card: { padding: 15, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundCard },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
    title: { color: colors.text, fontWeight: "800", fontSize: 16, flex: 1 },
    badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.chipBackground },
    badgeText: { color: colors.primary, fontWeight: "800", fontSize: 11 },
    muted: { color: colors.textSecondary, fontSize: 12, marginTop: 7, lineHeight: 17 },
    volumes: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
    volume: { color: colors.text, backgroundColor: colors.chipBackground, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7, fontSize: 12, fontWeight: "700" },
    center: { alignItems: "center", paddingVertical: 40 },
    error: { color: colors.danger, textAlign: "center" },
  }), [colors]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const payload = await consultarSituacaoColetas(hojeLocal());
      setItens(payload.itens || []);
      setResumo(payload.resumo || { pendentes: 0, em_coleta: 0, coletadas: 0 });
    } catch (error) {
      setErro(formatApiError(error, "Não foi possível consultar as coletas."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void carregar(); }, [carregar]));

  const visiveis = filtro === "todos" ? itens : itens.filter((item) => statusNormalizado(item.status) === filtro);

  return (
    <View style={styles.screen}>
      <ScreenHeaderBar title="Consultar coletas" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={carregar} />}>
        <View style={styles.resumo}>
          <View style={styles.kpi}><Text style={styles.kpiValue}>{resumo.pendentes}</Text><Text style={styles.kpiLabel}>Pendentes</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiValue}>{resumo.em_coleta}</Text><Text style={styles.kpiLabel}>Em coleta</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiValue}>{resumo.coletadas}</Text><Text style={styles.kpiLabel}>Coletadas</Text></View>
        </View>
        <View style={styles.filtros}>
          {([['todos', 'Todas'], ['pendente', 'Pendentes'], ['em_coleta', 'Em coleta'], ['coletado', 'Coletadas']] as const).map(([valor, label]) => (
            <Pressable key={valor} style={[styles.filtro, filtro === valor && styles.filtroAtivo]} onPress={() => setFiltro(valor)}>
              <Text style={[styles.filtroText, filtro === valor && styles.filtroTextAtivo]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {loading && itens.length === 0 ? <View style={styles.center}><ActivityIndicator color={colors.primary} /></View> : null}
        {erro ? <Text style={styles.error}>{erro}</Text> : null}
        {!loading && !erro && visiveis.length === 0 ? <View style={styles.center}><Text style={styles.muted}>Nenhuma base neste status.</Text></View> : null}
        {visiveis.map((item) => (
          <View key={item.base_id} style={styles.card}>
            <View style={styles.row}><Text style={styles.title}>{item.base}</Text><View style={styles.badge}><Text style={styles.badgeText}>{statusLabel(item.status)}</Text></View></View>
            <Text style={styles.muted}>{item.participantes.length ? item.participantes.map((p) => `${p.username}${p.status === "em_coleta" ? " (em coleta)" : ""}`).join(" • ") : "Ninguém iniciou esta coleta"}</Text>
            <View style={styles.volumes}><Text style={styles.volume}>Flex {item.mercado_livre}</Text><Text style={styles.volume}>Shopee {item.shopee}</Text><Text style={styles.volume}>Avulso {item.avulso}</Text><Text style={styles.volume}>Total {item.total}</Text></View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
