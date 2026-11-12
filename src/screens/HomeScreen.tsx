import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import GradientScreenHeader from "../components/ui/GradientScreenHeader";
import AppBrandTitleLogo from "../components/AppBrandTitleLogo";
import NotificationBellButton from "../components/NotificationBellButton";
import { navigateToAvisos } from "../navigation/navigateToAvisos";
import { useAuthStore } from "../store/authStore";
import { useAvisosUnreadStore } from "../store/avisosUnreadStore";
import { useDeliveryStore } from "../store/deliveryStore";
import { useThemeColors } from "../theme/colors";
import { space } from "../theme/spacing";
import { decodeJwtPayload } from "../utils/jwt";
import { effectivePodeLerColeta } from "../utils/role";
import { useHomeData } from "../features/home/hooks/useHomeData";
import { ROUTE_LOCATION_REQUIRED_MESSAGE } from "../services/location/locationService";
import {
  countPendingOnActiveRoute,
  deriveHomeCtas,
  deriveHomeOperationalView,
  shouldOfferPrepareRouteWhileActive,
  type HomeCtaAction,
} from "../features/home/utils/homeOperationalState";
import { mapHomeCtasToPresentation } from "../features/home/utils/mapHomeCtasToPresentation";
import HomeOperationalCard from "../features/home/components/HomeOperationalCard";
import HomeNextAction from "../features/home/components/HomeNextAction";
import HomeDailySummary from "../features/home/components/HomeDailySummary";
import HomeCompletedState from "../features/home/components/HomeCompletedState";
import {
  confirmarSaidaSessoes,
  getRotaResumo,
  getSaidaSessoesPendentes,
  type SaidaSessoesPendentesResponse,
} from "../features/entregas/api";
import {
  useDiaRotaConcluidaStore,
  VALOR_ROTA_LABEL,
} from "../store/diaRotaConcluidaStore";
import type { MotoboyRootStackParamList, MotoboyTabParamList } from "../navigation/motoboyStackTypes";

type HomeNav = CompositeNavigationProp<
  BottomTabNavigationProp<MotoboyTabParamList, "Inicio">,
  NativeStackNavigationProp<MotoboyRootStackParamList>
>;

async function openRouteResumo(rotaId: string): Promise<void> {
  const resumo = await getRotaResumo(rotaId);
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
}

export default function HomeScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<HomeNav>();
  const data = useHomeData();
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.currentUser);
  const claims = token ? decodeJwtPayload(token) : {};
  const nome = claims.username || "Motoboy";
  const subBase = claims.sub_base || "";
  const showColeta = effectivePodeLerColeta(currentUser);
  const unreadCount = useAvisosUnreadStore((s) => s.unreadCount);
  const refreshUnread = useAvisosUnreadStore((s) => s.refresh);
  const [saidaPendente, setSaidaPendente] = useState<SaidaSessoesPendentesResponse | null>(null);
  const [idsRemovidos, setIdsRemovidos] = useState<number[]>([]);
  const [revisandoSaida, setRevisandoSaida] = useState(false);
  const [confirmandoSaida, setConfirmandoSaida] = useState(false);
  const saidaPendenteTotal = Math.max(0, (saidaPendente?.total ?? 0) - idsRemovidos.length);

  const carregarConfirmacaoSaida = useCallback(async () => {
    try {
      const result = await getSaidaSessoesPendentes();
      setSaidaPendente(result.fluxo_confirmacao_ativo ? result : null);
      setIdsRemovidos([]);
    } catch {
      // Mantém a home utilizável offline; o gate do backend protege a operação.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshUnread();
      void carregarConfirmacaoSaida();
    }, [refreshUnread, carregarConfirmacaoSaida])
  );

  const confirmarSaidaPendente = useCallback(async () => {
    setConfirmandoSaida(true);
    try {
      await confirmarSaidaSessoes({
        sessao_ids: saidaPendente?.sessao_ids ?? [],
        ids_removidos: idsRemovidos,
      });
      setSaidaPendente(null);
      setIdsRemovidos([]);
      setRevisandoSaida(false);
      await useDeliveryStore.getState().loadDeliveries();
      navigation.navigate("Entregas", { initialTab: "pendente" });
    } catch {
      Alert.alert("Não foi possível confirmar", "Verifique sua conexão e tente novamente.");
    } finally {
      setConfirmandoSaida(false);
    }
  }, [idsRemovidos, navigation, saidaPendente?.sessao_ids]);

  const alternarRemocao = useCallback((idSaida: number) => {
    setIdsRemovidos((atuais) =>
      atuais.includes(idSaida)
        ? atuais.filter((id) => id !== idSaida)
        : [...atuais, idSaida]
    );
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: {
          paddingHorizontal: space.md,
          paddingTop: space.md,
          paddingBottom: space.xxl,
        },
        confirmacaoCard: {
          backgroundColor: colors.backgroundCard,
          borderColor: colors.primary,
          borderWidth: 1,
          borderRadius: 14,
          padding: space.md,
          marginBottom: space.md,
        },
        confirmacaoTitle: { color: colors.text, fontWeight: "700", fontSize: 17 },
        confirmacaoText: { color: colors.textSecondary, marginTop: 4, marginBottom: space.sm },
        confirmacaoButton: {
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 10,
          backgroundColor: colors.primary,
        },
        confirmacaoButtonText: { color: colors.primaryContrast, fontWeight: "700", fontSize: 16 },
        revisarButton: { alignItems: "center", paddingTop: space.sm },
        revisarButtonText: { color: colors.primary, fontWeight: "700" },
        modalOverlay: {
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: colors.overlay,
        },
        modalCard: {
          maxHeight: "82%",
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: space.md,
        },
        modalTitle: { color: colors.text, fontWeight: "700", fontSize: 20 },
        modalDescription: { color: colors.textSecondary, marginTop: 4, marginBottom: space.md },
        pacoteRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottomColor: colors.separator,
          borderBottomWidth: 1,
          paddingVertical: 12,
        },
        pacoteInfo: { flex: 1, paddingRight: space.sm },
        pacoteCodigo: { color: colors.text, fontWeight: "700", fontSize: 16 },
        pacoteServico: { color: colors.textSecondary, marginTop: 2 },
        removerButton: {
          borderColor: colors.danger,
          borderWidth: 1,
          borderRadius: 8,
          minWidth: 86,
          alignItems: "center",
          paddingHorizontal: 10,
          paddingVertical: 8,
        },
        removerButtonSelected: { backgroundColor: colors.danger },
        removerText: { color: colors.danger, fontWeight: "700" },
        removerTextSelected: { color: colors.primaryContrast },
        modalActions: { gap: space.sm, paddingTop: space.md },
        closeButton: { alignItems: "center", paddingVertical: 12 },
        closeButtonText: { color: colors.textSecondary, fontWeight: "700" },
      }),
    [colors]
  );

  const view = deriveHomeOperationalView({
    roteirizacaoHabilitada: data.roteirizacaoHabilitada,
    resumo: data.resumo,
    activeRouteId: data.activeRouteId,
    rotaAtivaValid: data.rotaAtivaValid,
    routeOrder: data.routeOrder,
    routeDeliveries: data.routeDeliveries,
    activeStopIndex: data.activeStopIndex,
    routeDeliveryStatus: data.routeDeliveryStatus,
    ephemeralCompleted: data.ephemeralCompleted,
  });

  const offerPrepareRoute = shouldOfferPrepareRouteWhileActive({
    semEndereco: data.deliveriesWithoutAddressCount,
    preparadosComEndereco: data.deliveriesWithAddressCount,
    pedidosPendentesNaRotaAtiva: countPendingOnActiveRoute(
      data.routeOrder,
      data.routeDeliveryStatus
    ),
  });

  const ctas = deriveHomeCtas(view, data.roteirizacaoHabilitada, {
    loadingStartRoute: data.iniciandoRota,
    offerPrepareRoute,
  });
  const presentation = mapHomeCtasToPresentation(view, ctas, { showColeta });

  const runAction = useCallback(
    (action: HomeCtaAction) => {
      switch (action) {
        case "scan":
        case "scan_insert":
          navigation.navigate("Scan");
          break;
        case "scan_deliver":
          navigation.navigate("DeliverScan");
          break;
        case "scan_coleta":
          navigation.navigate("LeituraColetas");
          break;
        case "prepare_route":
          navigation.navigate("PrepareDeliveries");
          break;
        case "view_pending":
          navigation.navigate("Entregas", { initialTab: "pendente" });
          break;
        case "start_route":
          void data.startRoute();
          break;
        case "continue_route":
          void (async () => {
            const store = useDeliveryStore.getState();
            if (store.backgroundTrackingNeedsResume) {
              const result = await store.resumeActiveRouteTracking();
              if (!result.ok) {
                Alert.alert("Localização", ROUTE_LOCATION_REQUIRED_MESSAGE);
                return;
              }
            }
            navigation.navigate("RouteBuilder");
          })();
          break;
        case "locate_package":
          navigation.navigate("RouteBuilder", { openLocatePackage: true });
          break;
        case "edit_route":
          navigation.navigate("RouteBuilder");
          break;
        case "view_summary":
          if (data.ephemeralCompleted?.rotaId) {
            void openRouteResumo(data.ephemeralCompleted.rotaId);
          }
          break;
        case "route_history":
          navigation.navigate("RotasHistorico");
          break;
        default:
          break;
      }
    },
    [navigation, data]
  );

  const headerGradient: readonly [string, string] = [
    colors.deliveryHeaderGradientStart,
    colors.deliveryHeaderGradientEnd,
  ];

  return (
    <View style={styles.container}>
      <GradientScreenHeader
        gradientColors={headerGradient}
        titleNode={<AppBrandTitleLogo size="home" />}
        subtitle={`Olá, ${nome}`}
        tertiary={subBase ? `Base: ${subBase}` : undefined}
        paddingBottom={space.md}
        rightElement={
          <NotificationBellButton unreadCount={unreadCount} onPress={navigateToAvisos} />
        }
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {(saidaPendente?.total ?? 0) > 0 ? (
          <View style={styles.confirmacaoCard}>
            <Text style={styles.confirmacaoTitle}>Saída aguardando confirmação</Text>
            <Text style={styles.confirmacaoText}>
              Confirme os {saidaPendenteTotal} pacotes lidos antes de preparar rota ou entregar.
            </Text>
            <TouchableOpacity
              style={styles.confirmacaoButton}
              disabled={confirmandoSaida}
              onPress={() => void confirmarSaidaPendente()}
            >
              {confirmandoSaida ? (
                <ActivityIndicator color={colors.primaryContrast} />
              ) : (
                <Text style={styles.confirmacaoButtonText}>
                  {saidaPendenteTotal > 0
                    ? `Começar entrega — ${saidaPendenteTotal} pacotes`
                    : "Confirmar remoção dos pacotes"}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.revisarButton} onPress={() => setRevisandoSaida(true)}>
              <Text style={styles.revisarButtonText}>
                Revisar pacotes{idsRemovidos.length ? ` · ${idsRemovidos.length} removido(s)` : ""}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {presentation.completedAction ? (
          <HomeCompletedState
            title={presentation.view.title}
            description={presentation.view.description}
            action={presentation.completedAction}
            onPress={() => runAction(presentation.completedAction!.action)}
          />
        ) : (
          <HomeOperationalCard
            state={presentation.view.heroState}
            title={presentation.view.title}
            description={presentation.view.description}
            extraLines={presentation.view.extraLines}
            viewPending={presentation.viewPending}
            onViewPending={
              presentation.viewPending
                ? () => runAction(presentation.viewPending!.action)
                : undefined
            }
            cardAction={presentation.cardAction}
            onCardAction={
              presentation.cardAction
                ? () => runAction(presentation.cardAction!.action)
                : undefined
            }
            coletaAction={presentation.coletaAction}
            onColetaAction={
              presentation.coletaAction
                ? () => runAction(presentation.coletaAction!.action)
                : undefined
            }
          />
        )}
        {presentation.nextAction ? (
          <HomeNextAction
            cta={presentation.nextAction}
            loading={presentation.nextAction.action === "start_route" && data.iniciandoRota}
            onPress={() => runAction(presentation.nextAction!.action)}
          />
        ) : null}
        <HomeDailySummary
          resumo={data.resumo}
          onPressDetails={() => navigation.navigate("ResumoDetalhe")}
        />
      </ScrollView>
      <Modal
        visible={revisandoSaida}
        transparent
        animationType="slide"
        onRequestClose={() => setRevisandoSaida(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pacotes para começar entrega</Text>
            <Text style={styles.modalDescription}>
              Remova somente os pacotes que não ficarão com você. As sessões são tratadas automaticamente.
            </Text>
            <ScrollView>
              {(saidaPendente?.itens ?? []).map((item) => {
                const removido = idsRemovidos.includes(item.id_saida);
                return (
                  <View key={item.id_saida} style={styles.pacoteRow}>
                    <View style={styles.pacoteInfo}>
                      <Text style={styles.pacoteCodigo}>{item.codigo || `Pedido ${item.id_saida}`}</Text>
                      <Text style={styles.pacoteServico}>{item.servico || "Avulso"}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.removerButton, removido && styles.removerButtonSelected]}
                      onPress={() => alternarRemocao(item.id_saida)}
                    >
                      <Text style={[styles.removerText, removido && styles.removerTextSelected]}>
                        {removido ? "Manter" : "Remover"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.confirmacaoButton}
                disabled={confirmandoSaida}
                onPress={() => void confirmarSaidaPendente()}
              >
                {confirmandoSaida ? (
                  <ActivityIndicator color={colors.primaryContrast} />
                ) : (
                  <Text style={styles.confirmacaoButtonText}>
                    {saidaPendenteTotal > 0
                      ? `Começar entrega — ${saidaPendenteTotal} pacotes`
                      : "Confirmar remoção dos pacotes"}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.closeButton} onPress={() => setRevisandoSaida(false)}>
                <Text style={styles.closeButtonText}>Voltar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
