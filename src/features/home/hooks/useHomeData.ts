import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getResumoEntregas, getTodayISO, getEntregas } from "../../entregas/api";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import { useHomeRouteStore } from "../../../store/homeRouteStore";
import {
  getNetworkState,
  subscribeNetworkStatus,
} from "../../../services/outbox/networkStatus";
import { reloadPendingDeliveriesForSession } from "../../../services/sessionPendingReload";
import { withTimeout } from "../../../utils/withTimeout";
import type { HomeResumo } from "../utils/homeOperationalState";
import { ROUTE_LOCATION_REQUIRED_MESSAGE } from "../../../services/location/locationService";

const EMPTY_RESUMO: HomeResumo = {
  pendentes: 0,
  finalizadas_hoje: 0,
  ausentes: 0,
  atraso_d1: 0,
};

const NETWORK_CHECK_TIMEOUT_MS = 3_000;

function buildLocalResumo(prev: HomeResumo): HomeResumo {
  const store = useDeliveryStore.getState();
  const routePending = store.routeOrder.filter(
    (id) => (store.routeDeliveryStatus[id] ?? "pendente") === "pendente"
  ).length;
  const pendentes =
    store.pendingDeliveries.length > 0
      ? store.pendingDeliveries.length
      : routePending > 0
        ? routePending
        : prev.pendentes;
  return { ...prev, pendentes };
}

function hasLocalOperationalData(): boolean {
  const store = useDeliveryStore.getState();
  return (
    store.pendingDeliveries.length > 0 ||
    store.activeRouteId != null ||
    store.routeOrder.length > 0
  );
}

function hasSessionPendingList(): boolean {
  const store = useDeliveryStore.getState();
  return (
    (store.pendingDeliveries?.length ?? 0) > 0 ||
    (store.routeDeliveries?.length ?? 0) > 0
  );
}

async function resolveOnlineFast(): Promise<boolean> {
  try {
    const state = await withTimeout(
      getNetworkState(),
      NETWORK_CHECK_TIMEOUT_MS,
      "network_check"
    );
    return state.online;
  } catch {
    return false;
  }
}

export function useHomeData() {
  const [resumo, setResumo] = useState<HomeResumo>(EMPTY_RESUMO);
  const [loading, setLoading] = useState(true);
  const [rotaAtivaValid, setRotaAtivaValid] = useState(false);
  const [iniciandoRota, setIniciandoRota] = useState(false);
  /** Sessão sem lista e sem rede (ou checagem travada): aviso na home. */
  const [sessionListUnavailable, setSessionListUnavailable] = useState(false);

  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const activeRouteId = useDeliveryStore((s) => s.activeRouteId);
  const routeOrder = useDeliveryStore((s) => s.routeOrder);
  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const pendingDeliveries = useDeliveryStore((s) => s.pendingDeliveries);
  const activeStopIndex = useDeliveryStore((s) => s.activeStopIndex);
  const routeDeliveryStatus = useDeliveryStore((s) => s.routeDeliveryStatus);
  const deliveriesWithAddress = useDeliveryStore((s) => s.deliveriesWithAddress);
  const deliveriesWithoutAddress = useDeliveryStore((s) => s.deliveriesWithoutAddress);
  const reconcileActiveRoute = useDeliveryStore((s) => s.reconcileActiveRoute);
  const ephemeralCompleted = useHomeRouteStore((s) => s.ephemeralCompleted);
  const hydrateHomeRoute = useHomeRouteStore((s) => s.hydrate);
  const clearEphemeral = useHomeRouteStore((s) => s.clearEphemeral);

  const applyLocalRouteValidity = useCallback(() => {
    const store = useDeliveryStore.getState();
    setRotaAtivaValid(store.activeRouteId != null && store.routeOrder.length > 0);
  }, []);

  const refreshSessionAvailability = useCallback(async () => {
    if (hasSessionPendingList()) {
      setSessionListUnavailable(false);
      return;
    }
    const online = await resolveOnlineFast();
    if (!online) {
      setSessionListUnavailable(true);
      return;
    }
    setSessionListUnavailable(false);
  }, []);

  const loadResumo = useCallback(async () => {
    if (!hasLocalOperationalData()) setLoading(true);

    try {
      const online = await resolveOnlineFast();
      if (!online) {
        setResumo((prev) => buildLocalResumo(prev));
        setSessionListUnavailable(!hasSessionPendingList());
        return;
      }

      const r = await getResumoEntregas();
      if (somenteHojePendentes) {
        const hoje = getTodayISO();
        const [pendentesHoje, ausentesHoje] = await Promise.all([
          getEntregas("pendente", { dia: "hoje", data: hoje }),
          getEntregas("ausentes", { dia: "hoje", data: hoje }),
        ]);
        setResumo({
          pendentes: pendentesHoje.length,
          finalizadas_hoje: r.finalizadas_hoje ?? 0,
          ausentes: ausentesHoje.length,
          atraso_d1: r.atraso_d1 ?? 0,
        });
      } else {
        setResumo({
          pendentes: r.pendentes ?? 0,
          finalizadas_hoje: r.finalizadas_hoje ?? 0,
          ausentes: r.ausentes ?? 0,
          atraso_d1: r.atraso_d1 ?? 0,
        });
      }
      setSessionListUnavailable(false);
    } catch {
      setResumo((prev) => buildLocalResumo(prev));
      setSessionListUnavailable(!hasSessionPendingList());
    } finally {
      setLoading(false);
    }
  }, [somenteHojePendentes]);

  const syncActiveRoute = useCallback(async () => {
    if (!roteirizacaoHabilitada) {
      useDeliveryStore.getState().clearActiveRouteState();
      setRotaAtivaValid(false);
      return;
    }

    const online = await resolveOnlineFast();
    if (!online) {
      applyLocalRouteValidity();
      return;
    }

    try {
      const result = await reconcileActiveRoute();
      const store = useDeliveryStore.getState();
      setRotaAtivaValid(
        result.stillActive && store.activeRouteId != null && store.routeOrder.length > 0
      );
      try {
        const { promptTransferenciasPendentes } = await import(
          "../../entregas/utils/transferPendingFlow"
        );
        await promptTransferenciasPendentes();
      } catch {
        /* pendência best-effort */
      }
    } catch {
      applyLocalRouteValidity();
    }
  }, [roteirizacaoHabilitada, reconcileActiveRoute, applyLocalRouteValidity]);

  useFocusEffect(
    useCallback(() => {
      void hydrateHomeRoute();
      void loadResumo();
      void syncActiveRoute();
      // Sempre tenta preencher a sessão (não só com roteirização ligada).
      void reloadPendingDeliveriesForSession().finally(() => {
        void refreshSessionAvailability();
      });
      return () => {
        clearEphemeral();
      };
    }, [
      hydrateHomeRoute,
      loadResumo,
      syncActiveRoute,
      clearEphemeral,
      refreshSessionAvailability,
    ])
  );

  // Ao voltar o sinal (ou se a lista chegar via syncEngine), some o aviso.
  useEffect(() => {
    if (pendingDeliveries.length > 0 || routeDeliveries.length > 0) {
      setSessionListUnavailable(false);
    }
  }, [pendingDeliveries.length, routeDeliveries.length]);

  useEffect(() => {
    return subscribeNetworkStatus((online) => {
      if (!online) {
        if (!hasSessionPendingList()) setSessionListUnavailable(true);
        return;
      }
      void reloadPendingDeliveriesForSession().finally(() => {
        void refreshSessionAvailability();
        void loadResumo();
      });
    });
  }, [loadResumo, refreshSessionAvailability]);

  const startRoute = useCallback(async () => {
    setIniciandoRota(true);
    try {
      await useDeliveryStore.getState().startActiveRoute();
      await loadResumo();
      await syncActiveRoute();
    } catch (e: unknown) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : ROUTE_LOCATION_REQUIRED_MESSAGE;
      Alert.alert("Localização", msg);
    } finally {
      setIniciandoRota(false);
    }
  }, [loadResumo, syncActiveRoute]);

  return {
    resumo,
    loading,
    rotaAtivaValid,
    iniciandoRota,
    roteirizacaoHabilitada,
    activeRouteId,
    routeOrder,
    routeDeliveries,
    activeStopIndex,
    routeDeliveryStatus,
    deliveriesWithAddressCount: deliveriesWithAddress.length,
    deliveriesWithoutAddressCount: deliveriesWithoutAddress.length,
    ephemeralCompleted,
    sessionListUnavailable,
    loadResumo,
    startRoute,
  };
}
