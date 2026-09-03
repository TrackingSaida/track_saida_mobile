import React, { useCallback, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import GradientScreenHeader from "../components/ui/GradientScreenHeader";
import AppBrandTitleLogo from "../components/AppBrandTitleLogo";
import NotificationBellButton from "../components/NotificationBellButton";
import { navigateToAvisos } from "../navigation/navigateToAvisos";
import { useAuthStore } from "../store/authStore";
import { useAvisosUnreadStore } from "../store/avisosUnreadStore";
import { useThemeColors } from "../theme/colors";
import { space } from "../theme/spacing";
import { decodeJwtPayload } from "../utils/jwt";
import { effectivePodeLerColeta } from "../utils/role";
import type { EntregasListInitialTab } from "../features/entregas/types";
import HomePager, { type HomePagerCallbacks } from "../features/home/components/HomePager";
import { useHomeData } from "../features/home/hooks/useHomeData";

type Props = {
  onNavigateEntregas: (
    tab?: EntregasListInitialTab,
    opts?: { todosPendentes?: boolean; initialMapMode?: "map" }
  ) => void;
  onNavigateScan: () => void;
  onNavigateDeliverScan: () => void;
  onNavigatePrepareRoute: () => void;
  onNavigateRouteBuilder: (opts?: {
    openLocatePackage?: boolean;
    openSeparation?: boolean;
    highlightLocatePackage?: boolean;
  }) => void;
  onNavigateRotasHistorico: () => void;
  onNavigateMinhasEntregas: () => void;
  onNavigatePreferencias: () => void;
  onNavigateAvisos: () => void;
  onNavigateDevolverPacotes?: () => void;
  onNavigateLeituraColetas?: () => void;
  onNavigateConsultarColetas?: () => void;
};

export default function HomeScreen({
  onNavigateEntregas,
  onNavigateScan,
  onNavigateDeliverScan,
  onNavigatePrepareRoute,
  onNavigateRouteBuilder,
  onNavigateRotasHistorico,
  onNavigateMinhasEntregas,
  onNavigatePreferencias,
  onNavigateAvisos,
  onNavigateDevolverPacotes,
  onNavigateLeituraColetas,
  onNavigateConsultarColetas,
}: Props) {
  const colors = useThemeColors();
  const data = useHomeData();
  const token = useAuthStore((s) => s.token);
  const currentUser = useAuthStore((s) => s.currentUser);
  const claims = token ? decodeJwtPayload(token) : {};
  const nome = claims.username || "Motoboy";
  const subBase = claims.sub_base || "";
  const devolucaoHabilitada = claims.devolucao_sub_base_habilitada === true;
  const podeRegistrarColeta = effectivePodeLerColeta(currentUser);
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
      }),
    [colors]
  );

  const callbacks: HomePagerCallbacks = {
    onScan: onNavigateScan,
    onScanForDeliver: onNavigateDeliverScan,
    onPrepareRoute: onNavigatePrepareRoute,
    onViewPending: () => onNavigateEntregas("pendente"),
    onContinueRoute: () => onNavigateRouteBuilder(),
    onLocatePackage: () => onNavigateRouteBuilder({ openLocatePackage: true }),
    onEditRoute: () => onNavigateRouteBuilder(),
    onRouteHistory: onNavigateRotasHistorico,
    onPendentes: () => onNavigateEntregas("pendente"),
    onFinalizadas: () => onNavigateEntregas("finalizadas"),
    onAusentes: () => onNavigateEntregas("ausentes"),
    onAtrasadas: () => onNavigateEntregas("pendente", { todosPendentes: true }),
    onMinhasEntregas: onNavigateMinhasEntregas,
    onMapaPendentes: () => onNavigateEntregas("pendente", { initialMapMode: "map" }),
    onPreferencias: onNavigatePreferencias,
    onDevolverPacotes:
      devolucaoHabilitada && onNavigateDevolverPacotes
        ? onNavigateDevolverPacotes
        : undefined,
    onRegistrarColeta:
      podeRegistrarColeta && onNavigateLeituraColetas ? onNavigateLeituraColetas : undefined,
    onConsultarColetas:
      podeRegistrarColeta && onNavigateConsultarColetas ? onNavigateConsultarColetas : undefined,
  };

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
          <NotificationBellButton unreadCount={unreadCount} onPress={onNavigateAvisos} />
        }
      />
      <HomePager data={data} callbacks={callbacks} />
    </View>
  );
}
