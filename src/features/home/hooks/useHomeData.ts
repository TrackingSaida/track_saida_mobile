import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { getResumoEntregas, getTodayISO, getEntregas } from "../../entregas/api";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import { useHomeRouteStore } from "../../../store/homeRouteStore";
import { getNetworkState } from "../../../services/outbox/networkStatus";
import type { HomeResumo } from "../utils/homeOperationalState";

const EMPTY_RESUMO: HomeResumo = {
  pendentes: 0,
  finalizadas_hoje: 0,
  ausentes: 0,
  atraso_d1: 0,
};

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

export function useHomeData() {
  const [resumo, setResumo] = useState<HomeResumo>(EMPTY_RESUMO);
  const [loading, setLoading] = useState(true);
  const [rotaAtivaValid, setRotaAtivaValid] = useState(false);
  const [iniciandoRota, setIniciandoRota] = useState(false);

  const somenteHojePendentes = useMotoboyPrefsStore((s) => s.somenteHojePendentes);
  const roteirizacaoHabilitada = useMotoboyPrefsStore((s) => s.roteirizacaoHabilitada);
  const activeRouteId = useDeliveryStore((s) => s.activeRouteId);
  const routeOrder = useDeliveryStore((s) => s.routeOrder);
  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const activeStopIndex = useDeliveryStore((s) => s.activeStopIndex);
  const routeDeliveryStatus = useDeliveryStore((s) => s.routeDeliveryStatus);
  const deliveriesWithAddress = useDeliveryStore((s) => s.deliveriesWithAddress);
  const deliveriesWithoutAddress = useDeliveryStore((s) => s.deliveriesWithoutAddress);
  const loadDeliveries = useDeliveryStore((s) => s.loadDeliveries);
  const reconcileActiveRoute = useDeliveryStore((s) => s.reconcileActiveRoute);
  const ephemeralCompleted = useHomeRouteStore((s) => s.ephemeralCompleted);
  const hydrateHomeRoute = useHomeRouteStore((s) => s.hydrate);
  const clearEphemeral = useHomeRouteStore((s) => s.clearEphemeral);

  const applyLocalRouteValidity = useCallback(() => {
    const store = useDeliveryStore.getState();
    setRotaAtivaValid(store.activeRouteId != null && store.routeOrder.length > 0);
  }, []);

  const loadResumo = useCallback(async () => {
    if (!hasLocalOperationalData()) setLoading(true);

    try {
      const { online } = await getNetworkState();
      if (!online) {
        setResumo((prev) => buildLocalResumo(prev));
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
    } catch {
      setResumo((prev) => buildLocalResumo(prev));
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

    const { online } = await getNetworkState();
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
    } catch {
      applyLocalRouteValidity();
    }
  }, [roteirizacaoHabilitada, reconcileActiveRoute, applyLocalRouteValidity]);

  useFocusEffect(
    useCallback(() => {
      void hydrateHomeRoute();
      void loadResumo();
      void syncActiveRoute();
      if (roteirizacaoHabilitada) {
        void loadDeliveries({ onlyToday: somenteHojePendentes });
      }
      return () => {
        clearEphemeral();
      };
    }, [
      hydrateHomeRoute,
      loadResumo,
      syncActiveRoute,
      clearEphemeral,
      roteirizacaoHabilitada,
      loadDeliveries,
      somenteHojePendentes,
    ])
  );

  const startRoute = useCallback(async () => {
    setIniciandoRota(true);
    try {
      await useDeliveryStore.getState().startActiveRoute();
      await loadResumo();
      await syncActiveRoute();
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
    loadResumo,
    startRoute,
  };
}
