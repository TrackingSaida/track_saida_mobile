import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import GradientScreenHeader from "../components/ui/GradientScreenHeader";
import AppBrandTitleLogo from "../components/AppBrandTitleLogo";
import { useAuthStore } from "../store/authStore";
import { useThemeColors } from "../theme/colors";
import { space } from "../theme/spacing";
import { decodeJwtPayload } from "../utils/jwt";
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
  onNavigateDevolverPacotes?: () => void;
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
  onNavigateDevolverPacotes,
}: Props) {
  const colors = useThemeColors();
  const data = useHomeData();
  const token = useAuthStore((s) => s.token);
  const claims = token ? decodeJwtPayload(token) : {};
  const nome = claims.username || "Motoboy";
  const subBase = claims.sub_base || "";
  const devolucaoHabilitada = claims.devolucao_sub_base_habilitada === true;

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
      />
      <HomePager data={data} callbacks={callbacks} />
    </View>
  );
}
