import React, { useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { getRotaResumo } from "../../entregas/api";
import {
  useDiaRotaConcluidaStore,
  VALOR_ROTA_LABEL,
} from "../../../store/diaRotaConcluidaStore";
import { space, radius } from "../../../theme/spacing";
import { useThemeColors } from "../../../theme/colors";
import PressableMenuRow from "../../../components/ui/PressableMenuRow";
import HomeStateHero from "./HomeStateHero";
import HomeOperationalActions from "./HomeOperationalActions";
import {
  countPendingOnActiveRoute,
  deriveHomeCtas,
  deriveHomeOperationalView,
  shouldOfferPrepareRouteWhileActive,
  type HomeCtaAction,
} from "../utils/homeOperationalState";
import { ctaActionToIcon } from "../../../theme/operationalIcons";
import type { useHomeData } from "../hooks/useHomeData";

type HomeData = ReturnType<typeof useHomeData>;

export type HomeNavigationHandlers = {
  onScan: () => void;
  onScanForDeliver: () => void;
  onPrepareRoute: () => void;
  onViewPending: () => void;
  onContinueRoute: () => void;
  onLocatePackage: () => void;
  onEditRoute: () => void;
  onRouteHistory: () => void;
  onRegistrarColeta?: () => void;
  onConsultarColetas?: () => void;
};

type Props = {
  data: HomeData;
  navigation: HomeNavigationHandlers;
};

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

export default function HomeProximoPage({ data, navigation }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, paddingHorizontal: space.md, paddingTop: space.sm },
        coletaSection: {
          marginTop: space.md,
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: "hidden",
        },
      }),
    [colors]
  );

  const mostrarColeta = Boolean(navigation.onRegistrarColeta);

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

  const runAction = useCallback(
    (action: HomeCtaAction) => {
      switch (action) {
        case "scan":
        case "scan_insert":
          navigation.onScan();
          break;
        case "scan_deliver":
          navigation.onScanForDeliver();
          break;
        case "prepare_route":
          navigation.onPrepareRoute();
          break;
        case "view_pending":
          navigation.onViewPending();
          break;
        case "start_route":
          void data.startRoute();
          break;
        case "continue_route":
          navigation.onContinueRoute();
          break;
        case "locate_package":
          navigation.onLocatePackage();
          break;
        case "edit_route":
          navigation.onEditRoute();
          break;
        case "view_summary":
          if (data.ephemeralCompleted?.rotaId) {
            void openRouteResumo(data.ephemeralCompleted.rotaId);
          }
          break;
        case "route_history":
          navigation.onRouteHistory();
          break;
        default:
          break;
      }
    },
    [navigation, data]
  );

  const coletaBlock = mostrarColeta ? (
    <View style={styles.coletaSection}>
      <PressableMenuRow
        icon="layers-outline"
        title="Registrar coleta"
        subtitle="Pacotes coletados na base"
        onPress={() => navigation.onRegistrarColeta?.()}
        iconColor={colors.primary}
        iconSoftBg={colors.primarySoft}
        isLast={!navigation.onConsultarColetas}
      />
      {navigation.onConsultarColetas ? (
        <PressableMenuRow
          icon="list-outline"
          title="Consultar coletas"
          subtitle="Pendentes e andamento"
          onPress={() => navigation.onConsultarColetas?.()}
          iconColor={colors.primary}
          iconSoftBg={colors.primarySoft}
          isLast
        />
      ) : null}
    </View>
  ) : null;

  if (ctas.layout === "operational") {
    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: space.xl }}
        keyboardShouldPersistTaps="handled"
      >
        <HomeStateHero
          state={view.heroState}
          title={view.title}
          description={view.description}
          extraLines={view.extraLines}
          footer={
            <HomeOperationalActions
              viewPending={ctas.viewPending}
              scanInsert={ctas.scanInsert}
              scanDeliver={ctas.scanDeliver}
              tertiary={ctas.tertiary}
              onAction={runAction}
            />
          }
        />
        {coletaBlock}
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: space.xl }}
      keyboardShouldPersistTaps="handled"
    >
      <HomeStateHero
        state={view.heroState}
        title={view.title}
        description={view.description}
        extraLines={view.extraLines}
        primaryCta={{
          label: ctas.primary.label,
          onPress: () => runAction(ctas.primary.action),
          loading: ctas.primary.action === "start_route" && data.iniciandoRota,
          iconKey: ctaActionToIcon(ctas.primary.action) ?? undefined,
        }}
        secondaryCtas={ctas.secondary.map((cta) => ({
          label: cta.label,
          onPress: () => runAction(cta.action),
          iconKey: ctaActionToIcon(cta.action) ?? undefined,
        }))}
      />
      {coletaBlock}
    </ScrollView>
  );
}
