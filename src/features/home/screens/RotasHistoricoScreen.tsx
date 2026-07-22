import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import { space, radius } from "../../../theme/spacing";
import { type as typo } from "../../../theme/typography";
import { useHomeRouteStore, type CompletedRouteSummary } from "../../../store/homeRouteStore";
import { getRotaResumo, getRotasAtiva, getTodayISO, type RotasAtivaResponse } from "../../entregas/api";
import {
  useDiaRotaConcluidaStore,
  VALOR_ROTA_LABEL,
} from "../../../store/diaRotaConcluidaStore";
import { useDeliveryStore } from "../../../store/deliveryStore";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";

type Props = NativeStackScreenProps<RootStackParamList, "RotasHistorico">;

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function rotaHojeLabel(status?: RotasAtivaResponse["status"]): string {
  if (status === "em_entrega") return "Entrega em andamento";
  if (status === "rota_pronta") return "Rota pronta para sair";
  return "Rota de hoje";
}

export default function RotasHistoricoScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const history = useHomeRouteStore((s) => s.history);
  const hydrate = useHomeRouteStore((s) => s.hydrate);
  const cancelActiveRoute = useDeliveryStore((s) => s.cancelActiveRoute);
  const rebuildRouteFromPendentes = useDeliveryStore((s) => s.rebuildRouteFromPendentes);
  const restoreActiveRoute = useDeliveryStore((s) => s.restoreActiveRoute);

  const [rotaHoje, setRotaHoje] = useState<RotasAtivaResponse | null>(null);
  const [loadingRotaHoje, setLoadingRotaHoje] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        list: { padding: space.md },
        sectionTitle: {
          fontSize: typo.body,
          fontWeight: "800",
          color: colors.text,
          marginBottom: space.sm,
        },
        todayCard: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          padding: space.lg,
          marginBottom: space.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        todayTitle: { fontSize: typo.body, fontWeight: "800", color: colors.text },
        todayMeta: { marginTop: 4, color: colors.textSecondary, fontSize: typo.bodySmall },
        actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: space.md },
        btnPrimary: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: radius.md,
          backgroundColor: colors.primary,
        },
        btnPrimaryText: { color: colors.primaryContrast, fontWeight: "700", fontSize: typo.bodySmall },
        btnSecondary: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.inputBackground,
        },
        btnSecondaryText: { color: colors.text, fontWeight: "700", fontSize: typo.bodySmall },
        btnDanger: {
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.danger,
        },
        btnDangerText: { color: colors.danger, fontWeight: "700", fontSize: typo.bodySmall },
        empty: {
          padding: space.xl,
          alignItems: "center",
        },
        emptyText: { color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          padding: space.lg,
          marginBottom: space.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        cardTitle: { fontSize: typo.body, fontWeight: "700", color: colors.text },
        cardMeta: { marginTop: 4, color: colors.textSecondary, fontSize: typo.bodySmall },
        cardLink: { marginTop: space.sm, color: colors.primary, fontWeight: "700" },
        historyHeader: { marginTop: space.sm, marginBottom: space.sm },
      }),
    [colors]
  );

  const loadRotaHoje = useCallback(async () => {
    setLoadingRotaHoje(true);
    try {
      const ativa = await getRotasAtiva(getTodayISO());
      if (
        ativa &&
        ativa.rota_id &&
        (ativa.status === "rota_pronta" || ativa.status === "em_entrega")
      ) {
        setRotaHoje(ativa);
        await restoreActiveRoute(ativa);
      } else {
        setRotaHoje(null);
      }
    } catch {
      setRotaHoje(null);
    } finally {
      setLoadingRotaHoje(false);
    }
  }, [restoreActiveRoute]);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
      void loadRotaHoje();
    }, [hydrate, loadRotaHoje])
  );

  const openResumo = useCallback(async (item: CompletedRouteSummary) => {
    const resumo = await getRotaResumo(item.rotaId);
    useDiaRotaConcluidaStore.getState().open({
      variant: "route",
      paradas: resumo.paradas,
      pedidos: resumo.pedidos,
      entregues: resumo.entregues,
      ausentes: resumo.ausentes,
      pendentes: resumo.pendentes,
      valorRota: String(resumo.valor_total ?? "0"),
      valorLabel: VALOR_ROTA_LABEL,
    });
  }, []);

  const handleContinuar = useCallback(() => {
    navigation.navigate("RouteBuilder");
  }, [navigation]);

  const handleCancelar = useCallback(() => {
    Alert.alert(
      "Cancelar rota?",
      "A rota atual será cancelada. Os pedidos não entregues voltam para preparação.",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Cancelar rota",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setActionLoading(true);
              try {
                const result = await cancelActiveRoute();
                if (!result.ok) {
                  Alert.alert("Erro", result.error);
                  return;
                }
                setRotaHoje(null);
              } finally {
                setActionLoading(false);
              }
            })();
          },
        },
      ]
    );
  }, [cancelActiveRoute]);

  const handleRefazer = useCallback(() => {
    Alert.alert(
      "Refazer rota?",
      "Vamos cancelar esta rota e montar outra com todos os pedidos pendentes de agora.",
      [
        { text: "Voltar", style: "cancel" },
        {
          text: "Refazer rota",
          onPress: () => {
            void (async () => {
              setActionLoading(true);
              try {
                const result = await rebuildRouteFromPendentes();
                if (!result.ok) {
                  Alert.alert(
                    result.reason === "no_pending" ? "Sem pedidos" : "Erro",
                    result.message
                  );
                  if (result.reason === "no_pending") {
                    setRotaHoje(null);
                  }
                  return;
                }
                navigation.navigate("RouteBuilder", { highlightLocatePackage: true });
                await loadRotaHoje();
              } finally {
                setActionLoading(false);
              }
            })();
          },
        },
      ]
    );
  }, [rebuildRouteFromPendentes, navigation, loadRotaHoje]);

  const showRotaHoje =
    rotaHoje?.rota_id &&
    (rotaHoje.status === "rota_pronta" || rotaHoje.status === "em_entrega");

  return (
    <View style={styles.container}>
      <ScreenHeaderBar
        title="Minhas rotas"
        onBack={() => navigation.goBack()}
        paddingTop={Math.max(12, insets.top)}
      />

      <FlatList
        data={history}
        keyExtractor={(item) => item.rotaId}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            <Text style={styles.sectionTitle}>Rota de hoje</Text>
            {loadingRotaHoje ? (
              <ActivityIndicator color={colors.primary} style={{ marginBottom: space.md }} />
            ) : showRotaHoje ? (
              <View style={styles.todayCard}>
                <Text style={styles.todayTitle}>{rotaHojeLabel(rotaHoje?.status)}</Text>
                <Text style={styles.todayMeta}>
                  {rotaHoje?.ordem?.length ?? 0} pedido
                  {(rotaHoje?.ordem?.length ?? 0) !== 1 ? "s" : ""} na rota
                </Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.btnPrimary}
                    onPress={handleContinuar}
                    disabled={actionLoading}
                  >
                    <Text style={styles.btnPrimaryText}>Continuar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnSecondary}
                    onPress={handleRefazer}
                    disabled={actionLoading}
                  >
                    <Text style={styles.btnSecondaryText}>Refazer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.btnDanger}
                    onPress={handleCancelar}
                    disabled={actionLoading}
                  >
                    <Text style={styles.btnDangerText}>Cancelar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={[styles.todayCard, { marginBottom: space.md }]}>
                <Text style={styles.todayMeta}>Nenhuma rota em andamento hoje.</Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, styles.historyHeader]}>Rotas concluídas</Text>
            {history.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  Nenhuma rota concluída registrada neste dispositivo.
                </Text>
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => void openResumo(item)} activeOpacity={0.9}>
            <Text style={styles.cardTitle}>
              {item.paradas} paradas · {item.pedidos} pedidos
            </Text>
            <Text style={styles.cardMeta}>{formatDate(item.completedAt)}</Text>
            <Text style={styles.cardLink}>Ver resumo</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
