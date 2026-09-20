import React, { useCallback, useMemo } from "react";
import { View, StyleSheet, Alert, ScrollView } from "react-native";
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
import { getRotaResumo } from "../features/entregas/api";
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

  useFocusEffect(
    useCallback(() => {
      void refreshUnread();
    }, [refreshUnread])
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: {
          paddingHorizontal: space.md,
          paddingTop: space.md,
          paddingBottom: space.xxl,
        },
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
    </View>
  );
}
