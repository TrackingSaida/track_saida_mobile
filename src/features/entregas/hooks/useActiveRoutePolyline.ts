import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeocodedMetaMap, LegacyValidationCache } from "../utils/deliveryDestination";
import {
  buildPendingRoutePoints,
  buildPlanningRoutePoints,
  haversineDistanceKm,
  type GroupedStop,
  type RouteDeliveryStatus,
  type RoutePoint,
} from "../utils/routeUtils";
import { fetchOsrmRoutePolyline, waypointsHash } from "../utils/osrm";

const DEBOUNCE_MS = 400;
const APPROACH_MOVE_M = 40;

function concatPolylines(head: RoutePoint[] | null, tail: RoutePoint[] | null): RoutePoint[] | null {
  if (!head?.length && !tail?.length) return null;
  if (!head?.length) return tail;
  if (!tail?.length) return head;
  const last = head[head.length - 1];
  const first = tail[0];
  const same =
    Math.abs(last.latitude - first.latitude) < 1e-5 &&
    Math.abs(last.longitude - first.longitude) < 1e-5;
  return same ? [...head, ...tail.slice(1)] : [...head, ...tail];
}

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

  const [restPolyline, setRestPolyline] = useState<RoutePoint[] | null>(null);
  const [approachPolyline, setApproachPolyline] = useState<RoutePoint[] | null>(null);
  const [lastValidPolyline, setLastValidPolyline] = useState<RoutePoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastHashRef = useRef<string | null>(null);
  const lastValidRef = useRef<RoutePoint[] | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const approachAbortRef = useRef<AbortController | null>(null);
  const approachDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastApproachOriginRef = useRef<RoutePoint | null>(null);
  const lastApproachDestHashRef = useRef<string | null>(null);

  const stopPoints = useMemo(() => {
    if (isRouteActive) {
      return buildPendingRoutePoints({
        groupedStops,
        activeGroupIndex,
        routeDeliveryStatus,
        geocodedCoords,
        geocodedMeta,
        legacyCache: legacyValidationCache,
        currentLocation: null,
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
  ]);

  const nextStop = stopPoints[0] ?? null;

  // Backend Google geometry: usa coordenadas salvas para o trecho entre paradas.
  useEffect(() => {
    if (!useBackendGoogle || !backendPolylineCoords) return;
    setRestPolyline(backendPolylineCoords);
    setLastValidPolyline(backendPolylineCoords);
    lastValidRef.current = backendPolylineCoords;
    setError(null);
    setLoading(false);
    lastHashRef.current = waypointsHash(backendPolylineCoords);
  }, [useBackendGoogle, backendPolylineCoords]);

  const runFetch = useCallback(async (points: RoutePoint[], force = false) => {
    if (useBackendGoogle) return;
    if (points.length < 2) {
      setRestPolyline(null);
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
        setRestPolyline(result);
        setLastValidPolyline(result);
        lastValidRef.current = result;
      } else {
        setError("Não foi possível calcular a rota por ruas.");
        const fallback = lastValidRef.current;
        setRestPolyline(fallback);
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError("Não foi possível calcular a rota por ruas.");
      const fallback = lastValidRef.current;
      setRestPolyline(fallback);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [useBackendGoogle]);

  useEffect(() => {
    if (useBackendGoogle) return;
    if (geometryProvider === "google" && geometryStatus && geometryStatus !== "valid") {
      // stale/failed/missing com provider google: não desenhar OSRM enganoso
      setRestPolyline(null);
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
      void runFetch(stopPoints);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [stopPoints, runFetch, useBackendGoogle, geometryProvider, geometryStatus]);

  useEffect(() => {
    if (!isRouteActive || !currentLocation || !nextStop) {
      setApproachPolyline(null);
      lastApproachOriginRef.current = null;
      lastApproachDestHashRef.current = null;
      return;
    }

    const destHash = waypointsHash([nextStop]);
    const origin = lastApproachOriginRef.current;
    const movedM = origin
      ? haversineDistanceKm(
          origin.latitude,
          origin.longitude,
          currentLocation.latitude,
          currentLocation.longitude
        ) * 1000
      : Infinity;
    const destChanged = lastApproachDestHashRef.current !== destHash;
    if (!destChanged && movedM < APPROACH_MOVE_M) return;

    const originPoint = {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
    };
    if (destChanged || !lastApproachOriginRef.current) {
      setApproachPolyline([originPoint, nextStop]);
    }

    if (approachDebounceRef.current) clearTimeout(approachDebounceRef.current);
    approachDebounceRef.current = setTimeout(() => {
      approachAbortRef.current?.abort();
      const controller = new AbortController();
      approachAbortRef.current = controller;
      const originPoint = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      };
      void fetchOsrmRoutePolyline([originPoint, nextStop], controller.signal)
        .then((result) => {
          if (controller.signal.aborted) return;
          lastApproachOriginRef.current = originPoint;
          lastApproachDestHashRef.current = destHash;
          if (result && result.length >= 2) {
            setApproachPolyline(result);
          } else {
            setApproachPolyline([originPoint, nextStop]);
          }
        })
        .catch((e) => {
          if (e instanceof Error && e.name === "AbortError") return;
          lastApproachOriginRef.current = originPoint;
          lastApproachDestHashRef.current = destHash;
          setApproachPolyline([originPoint, nextStop]);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (approachDebounceRef.current) clearTimeout(approachDebounceRef.current);
    };
  }, [isRouteActive, currentLocation, nextStop]);

  useEffect(() => {
    return () => {
      approachAbortRef.current?.abort();
    };
  }, []);

  const recalcPolyline = useCallback(() => {
    if (useBackendGoogle) return;
    lastHashRef.current = null;
    void runFetch(stopPoints, true);
  }, [stopPoints, runFetch, useBackendGoogle]);

  const polyline = useMemo(
    () => concatPolylines(isRouteActive ? approachPolyline : null, restPolyline),
    [isRouteActive, approachPolyline, restPolyline]
  );

  const polylineWarning = error && !polyline ? error : error ? error : null;

  return {
    polyline: polyline,
    lastValidPolyline,
    loading: useBackendGoogle ? false : loading,
    error,
    polylineWarning,
    recalcPolyline,
    pendingPoints: stopPoints,
  };
}
