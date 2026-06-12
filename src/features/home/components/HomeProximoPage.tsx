import React, { useCallback, useMemo } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { getRotaResumo } from "../../entregas/api";
import {
  useDiaRotaConcluidaStore,
  VALOR_ROTA_LABEL,
} from "../../../store/diaRotaConcluidaStore";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import HomeStateHero from "./HomeStateHero";
import HomeOperationalActions from "./HomeOperationalActions";
import {
  deriveHomeCtas,
  deriveHomeOperationalView,
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
        loader: { flex: 1, justifyContent: "center", alignItems: "center" },
      }),
    []
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

  const ctas = deriveHomeCtas(view, data.roteirizacaoHabilitada, data.iniciandoRota);

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

  if (data.loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.deliveryAccent} />
      </View>
    );
  }

  if (ctas.layout === "operational") {
    return (
      <View style={styles.container}>
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
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
    </View>
  );
}
