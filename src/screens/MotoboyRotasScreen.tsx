import React, { useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, Alert, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { CompositeNavigationProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import CompactStaffHeader from "../components/ui/CompactStaffHeader";
import MenuSection from "../components/ui/MenuSection";
import PressableMenuRow from "../components/ui/PressableMenuRow";
import { useThemeColors } from "../theme/colors";
import { space } from "../theme/spacing";
import { useHomeData } from "../features/home/hooks/useHomeData";
import {
  countPendingOnActiveRoute,
  deriveHomeCtas,
  deriveHomeOperationalView,
  shouldOfferPrepareRouteWhileActive,
} from "../features/home/utils/homeOperationalState";
import { useDeliveryStore } from "../store/deliveryStore";
import { ROUTE_LOCATION_REQUIRED_MESSAGE } from "../services/location/locationService";
import type { MotoboyRootStackParamList, MotoboyTabParamList } from "../navigation/motoboyStackTypes";

type RotasNav = CompositeNavigationProp<
  BottomTabNavigationProp<MotoboyTabParamList, "Rotas">,
  NativeStackNavigationProp<MotoboyRootStackParamList>
>;

export default function MotoboyRotasScreen() {
  const colors = useThemeColors();
  const navigation = useNavigation<RotasNav>();
  const data = useHomeData();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { paddingBottom: space.xxl },
        body: { paddingHorizontal: space.md, marginTop: space.sm },
        hint: {
          fontSize: 13,
          color: colors.textSecondary,
          marginBottom: space.md,
          lineHeight: 18,
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

  const hasStartOrContinue =
    ctas.layout === "route" &&
    (ctas.primary.action === "start_route" || ctas.primary.action === "continue_route");

  const continueRoute = useCallback(() => {
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
  }, [navigation]);

  const onRotaAtual = useCallback(() => {
    if (ctas.layout === "route" && ctas.primary.action === "start_route") {
      void data.startRoute();
      return;
    }
    continueRoute();
  }, [ctas, continueRoute, data]);

  const headerGradient: readonly [string, string] = [
    colors.deliveryHeaderGradientStart,
    colors.deliveryHeaderGradientEnd,
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <CompactStaffHeader gradientColors={headerGradient} title="Rotas" />
      <View style={styles.body}>
        {!data.roteirizacaoHabilitada ? (
          <Text style={styles.hint}>Roteirização não está habilitada nas preferências.</Text>
        ) : null}

        <MenuSection label="Operação">
          {data.roteirizacaoHabilitada ? (
            <PressableMenuRow
              icon="map-outline"
              title="Preparar rota"
              subtitle="Monte a sequência das entregas"
              onPress={() => navigation.navigate("PrepareDeliveries")}
              iconColor={colors.deliveryAccent}
              iconSoftBg={colors.deliveryAccentSoft}
            />
          ) : null}
          {data.roteirizacaoHabilitada && hasStartOrContinue && ctas.layout === "route" ? (
            <PressableMenuRow
              icon="navigate-outline"
              title={ctas.primary.label}
              subtitle={view.description || undefined}
              onPress={onRotaAtual}
              iconColor={colors.deliveryAccent}
              iconSoftBg={colors.deliveryAccentSoft}
            />
          ) : null}
          <PressableMenuRow
            icon="map-outline"
            title="Mapa de pendentes"
            subtitle="Ver pendências no mapa"
            onPress={() =>
              navigation.navigate("Entregas", { initialTab: "pendente", initialMapMode: "map" })
            }
            iconColor={colors.deliveryAccent}
            iconSoftBg={colors.deliveryAccentSoft}
            isLast={!data.roteirizacaoHabilitada}
          />
          {data.roteirizacaoHabilitada ? (
            <PressableMenuRow
              icon="time-outline"
              title="Minhas rotas"
              subtitle="Histórico de rotas"
              onPress={() => navigation.navigate("RotasHistorico")}
              iconColor={colors.deliveryAccent}
              iconSoftBg={colors.deliveryAccentSoft}
              isLast
            />
          ) : null}
        </MenuSection>
      </View>
    </ScrollView>
  );
}
