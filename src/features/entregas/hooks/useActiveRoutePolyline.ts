import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeocodedMetaMap, LegacyValidationCache } from "../utils/deliveryDestination";
import {
  buildPendingRoutePoints,
  buildPlanningRoutePoints,
  type GroupedStop,
  type RouteDeliveryStatus,
  type RoutePoint,
} from "../utils/routeUtils";
import { fetchOsrmRoutePolyline, waypointsHash } from "../utils/osrm";

const DEBOUNCE_MS = 400;

export function useActiveRoutePolyline(params: {
  isRouteActive: boolean;
  groupedStops: GroupedStop[];
  activeGroupIndex: number;
  routeDeliveryStatus: Record<number, RouteDeliveryStatus>;
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>;
  geocodedMeta?: GeocodedMetaMap;
  legacyValidationCache?: LegacyValidationCache;
  currentLocation?: { latitude: number; longitude: number } | null;
  /** Geometria persistida pelo backend (Google). Se provider=google e válida, não chama OSRM. */
  backendPolylineCoords?: RoutePoint[] | null;
  geometryProvider?: "google" | "osrm" | null;
  geometryStatus?: "valid" | "stale" | "missing" | "failed" | null;
}) {
  const {
    isRouteActive,
    groupedStops,
    activeGroupIndex,
    routeDeliveryStatus,
    geocodedCoords,
    geocodedMeta,
    legacyValidationCache,
    currentLocation,
    backendPolylineCoords,
    geometryProvider,
    geometryStatus,
  } = params;

  const useBackendGoogle =
    geometryProvider === "google" &&
    geometryStatus === "valid" &&
    !!backendPolylineCoords &&
    backendPolylineCoords.length >= 2;

  const [polyline, setPolyline] = useState<RoutePoint[] | null>(null);
  const [lastValidPolyline, setLastValidPolyline] = useState<RoutePoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastHashRef = useRef<string | null>(null);
  const lastValidRef = useRef<RoutePoint[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const routePoints = useMemo(() => {
    if (isRouteActive) {
      return buildPendingRoutePoints({
        groupedStops,
        activeGroupIndex,
        routeDeliveryStatus,
        geocodedCoords,
        geocodedMeta,
        legacyCache: legacyValidationCache,
        currentLocation,
      });
    }
    return buildPlanningRoutePoints({
      groupedStops,
      geocodedCoords,
      geocodedMeta,
      legacyCache: legacyValidationCache,
    });
  }, [
    isRouteActive,
    groupedStops,
    activeGroupIndex,
    routeDeliveryStatus,
    geocodedCoords,
    geocodedMeta,
    legacyValidationCache,
    currentLocation,
  ]);

  // Backend Google geometry: usa coordenadas salvas; não chama OSRM.
  useEffect(() => {
    if (!useBackendGoogle || !backendPolylineCoords) return;
    setPolyline(backendPolylineCoords);
    setLastValidPolyline(backendPolylineCoords);
    lastValidRef.current = backendPolylineCoords;
    setError(null);
    setLoading(false);
    lastHashRef.current = waypointsHash(backendPolylineCoords);
  }, [useBackendGoogle, backendPolylineCoords]);

  const runFetch = useCallback(async (points: RoutePoint[], force = false) => {
    if (useBackendGoogle) return;
    if (points.length < 2) {
      setPolyline(null);
      setError(null);
      return;
    }

    const hash = waypointsHash(points);
    if (!force && hash === lastHashRef.current) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchOsrmRoutePolyline(points, controller.signal);
      if (controller.signal.aborted) return;

      if (result && result.length >= 2) {
        lastHashRef.current = hash;
        setPolyline(result);
        setLastValidPolyline(result);
        lastValidRef.current = result;
      } else {
        setError("Não foi possível calcular a rota por ruas.");
        const fallback = lastValidRef.current;
        setPolyline(fallback);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError("Não foi possível calcular a rota por ruas.");
      const fallback = lastValidRef.current;
      setPolyline(fallback);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [useBackendGoogle]);

  useEffect(() => {
    if (useBackendGoogle) return;
    if (geometryProvider === "google" && geometryStatus && geometryStatus !== "valid") {
      // stale/failed/missing com provider google: não desenhar OSRM enganoso
      setPolyline(null);
      setError(
        geometryStatus === "stale"
          ? "Linha da rota desatualizada. Reotimize ou aguarde o recálculo."
          : geometryStatus === "failed"
            ? "Não foi possível atualizar a linha da rota."
            : null
      );
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runFetch(routePoints);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [routePoints, runFetch, useBackendGoogle, geometryProvider, geometryStatus]);

  const recalcPolyline = useCallback(() => {
    if (useBackendGoogle) return;
    lastHashRef.current = null;
    void runFetch(routePoints, true);
  }, [routePoints, runFetch, useBackendGoogle]);

  const polylineWarning = error && !polyline ? error : error ? error : null;

  return {
    polyline: useBackendGoogle ? backendPolylineCoords : polyline,
    lastValidPolyline,
    loading: useBackendGoogle ? false : loading,
    error,
    polylineWarning,
    recalcPolyline,
    pendingPoints: routePoints,
  };
}
