import React, { useMemo, useRef, useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useDeliveryStore } from "../store/deliveryStore";
import { useThemeColors } from "../theme/colors";
import {
  getOrderedRouteDeliveries,
  groupOrderedByAddress,
  servicoTipo,
  ROUTE_MARKER_COLORS,
} from "../features/entregas/utils/routeUtils";
import type { EntregaListItem } from "../features/entregas/types";

const DEFAULT_REGION = {
  latitude: -23.55,
  longitude: -46.63,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const MARKER_STATUS_COLORS = {
  entregue: "#198754",
  ausente: "#dc3545",
} as const;

export interface DeliveryMapProps {
  onMarkerPress?: (delivery: EntregaListItem, index: number) => void;
  selectedId?: number | null;
  centerOnStopId?: number | null;
  /** Coordenadas geocodificadas no app para entregas sem lat/long da API. */
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>;
  /** Quando definido (ex.: após iniciar rota), desenha a polilinha por ruas em vez de retas. */
  routePolyline?: Array<{ latitude: number; longitude: number }>;
}

export default function DeliveryMap({ onMarkerPress, selectedId, centerOnStopId, geocodedCoords = {}, routePolyline }: DeliveryMapProps) {
  const mapRef = useRef<MapView>(null);
  const colors = useThemeColors();
  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const routeOrder = useDeliveryStore((s) => s.routeOrder);
  const routeDeliveryStatus = useDeliveryStore((s) => s.routeDeliveryStatus);
  const activeRouteId = useDeliveryStore((s) => s.activeRouteId);
  const activeStopIndex = useDeliveryStore((s) => s.activeStopIndex);
  const currentLocation = useDeliveryStore((s) => s.currentLocation);

  const ordered = useMemo(
    () => getOrderedRouteDeliveries(routeDeliveries, routeOrder),
    [routeDeliveries, routeOrder]
  );

  const groupedStops = useMemo(() => groupOrderedByAddress(ordered), [ordered]);

  /** Um ponto por parada (grupo), com coords da primeira entrega que tiver lat/long ou geocoded. */
  const groupedPointsWithCoords = useMemo(() => {
    const result: Array<{
      paradaIndex: number;
      latitude: number;
      longitude: number;
      firstDelivery: EntregaListItem;
      status: "pendente" | "entregue" | "ausente";
    }> = [];
    const statusMap = routeDeliveryStatus;
    for (let i = 0; i < groupedStops.length; i++) {
      const group = groupedStops[i];
      const withCoords = group.deliveries.find(
        (d) =>
          (d.latitude != null && d.longitude != null) ||
          (geocodedCoords[d.id_saida]?.latitude != null && geocodedCoords[d.id_saida]?.longitude != null)
      );
      if (!withCoords) continue;
      const lat = withCoords.latitude ?? geocodedCoords[withCoords.id_saida]?.latitude;
      const lon = withCoords.longitude ?? geocodedCoords[withCoords.id_saida]?.longitude;
      if (lat == null || lon == null) continue;
      const statuses = group.deliveries.map((d) => statusMap[d.id_saida] ?? "pendente");
      const status = statuses.every((s) => s === "entregue")
        ? "entregue"
        : statuses.some((s) => s === "ausente")
          ? "ausente"
          : "pendente";
      result.push({
        paradaIndex: i + 1,
        latitude: lat,
        longitude: lon,
        firstDelivery: group.deliveries[0],
        status,
      });
    }
    return result;
  }, [groupedStops, routeDeliveryStatus, geocodedCoords]);

  const withCoords = groupedPointsWithCoords;

  const [markersReady, setMarkersReady] = useState(false);
  useEffect(() => {
    if (groupedPointsWithCoords.length === 0) return;
    setMarkersReady(false);
    const t = setTimeout(() => setMarkersReady(true), Platform.OS === "android" ? 500 : 1500);
    return () => clearTimeout(t);
  }, [groupedPointsWithCoords.length]);

  /** No Android, manter tracksViewChanges=true para o número do marcador aparecer. */
  const tracksMarkerChanges = Platform.OS === "android" ? true : !markersReady;

  const region = useMemo(() => {
    if (withCoords.length === 0) return DEFAULT_REGION;
    const lats = withCoords.map((p) => p.latitude);
    const lons = withCoords.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const pad = 0.005;
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(0.02, maxLat - minLat + pad * 2),
      longitudeDelta: Math.max(0.02, maxLon - minLon + pad * 2),
    };
  }, [withCoords]);

  const prevCountRef = useRef(0);
  useEffect(() => {
    if (withCoords.length === 0) return;
    if (withCoords.length !== prevCountRef.current) {
      prevCountRef.current = withCoords.length;
      mapRef.current?.fitToCoordinates(
        withCoords.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
        { edgePadding: { top: 48, right: 24, bottom: 24, left: 24 }, animated: true }
      );
    }
  }, [withCoords]);

  const prevCenterIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (centerOnStopId == null) return;
    if (prevCenterIdRef.current === centerOnStopId) return;
    prevCenterIdRef.current = centerOnStopId;
    const groupIndex = groupedStops.findIndex((g) => g.deliveries.some((d) => d.id_saida === centerOnStopId));
    if (groupIndex >= 0) {
      const point = groupedPointsWithCoords.find((p) => p.paradaIndex === groupIndex + 1);
      if (point) {
        mapRef.current?.animateToRegion(
          {
            latitude: point.latitude,
            longitude: point.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          400
        );
      }
    }
  }, [centerOnStopId, groupedPointsWithCoords, groupedStops]);

  const prevActiveRouteIdRef = useRef<string | null>(null);
  const prevActiveStopIndexRef = useRef<number>(0);
  useEffect(() => {
    if (!currentLocation || !activeRouteId) return;
    const routeJustActivated = prevActiveRouteIdRef.current !== activeRouteId;
    const stopIndexChanged = prevActiveStopIndexRef.current !== activeStopIndex;
    prevActiveRouteIdRef.current = activeRouteId;
    prevActiveStopIndexRef.current = activeStopIndex;
    if (routeJustActivated || stopIndexChanged) {
      mapRef.current?.animateToRegion(
        {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        400
      );
    }
  }, [activeRouteId, activeStopIndex, currentLocation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        map: { flex: 1, width: "100%", ...(Platform.OS === "android" ? { minHeight: 200 } : {}) },
        markerWrap: {
          width: 36,
          height: 36,
          minWidth: 36,
          minHeight: 36,
          borderRadius: 18,
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 2,
          borderColor: "#fff",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.25,
          shadowRadius: 2,
          elevation: 3,
        },
        markerWrapFirst: {
          borderWidth: 3,
          borderColor: "#fff",
        },
        markerText: { fontSize: 14, fontWeight: "700", color: "#fff" },
        markerIcon: { fontSize: 18, fontWeight: "700", color: "#fff" },
        emptyOverlay: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.92)",
          padding: 24,
        },
        emptyText: { fontSize: 16, textAlign: "center", color: "#333", lineHeight: 24 },
        motoboyMarker: {
          width: 14,
          height: 14,
          borderRadius: 7,
          backgroundColor: "#2196F3",
          borderWidth: 2,
          borderColor: "#fff",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.3,
          shadowRadius: 2,
          elevation: 3,
        },
      }),
    []
  );

  const polylineCoordinates = useMemo(
    () => {
      if (routePolyline && routePolyline.length >= 2) {
        return routePolyline;
      }
      return withCoords.length >= 2
        ? withCoords.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
        : [];
    },
    [withCoords, routePolyline]
  );

  const showEmptyMessage = ordered.length > 0 && withCoords.length === 0;

  return (
    <View style={styles.map}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton
      >
        {polylineCoordinates.length >= 2 && (
          <Polyline
            coordinates={polylineCoordinates}
            strokeWidth={5}
            strokeColor={colors.primary}
            lineCap="round"
            lineJoin="round"
            geodesic
          />
        )}
        {currentLocation && (
          <Marker
            coordinate={{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            title="Você"
          >
            <View style={styles.motoboyMarker} />
          </Marker>
        )}
      {groupedPointsWithCoords.map((point) => {
        const paradaNumber = point.paradaIndex;
        const status = point.status;
        const group = groupedStops[point.paradaIndex - 1];
        const isSelected = group?.deliveries.some((d) => d.id_saida === selectedId) ?? false;
        const isFirst = paradaNumber === 1;
        let backgroundColor: string;
        let content: React.ReactNode;
        if (status === "entregue") {
          backgroundColor = MARKER_STATUS_COLORS.entregue;
          content = <Text style={styles.markerIcon}>✓</Text>;
        } else if (status === "ausente") {
          backgroundColor = MARKER_STATUS_COLORS.ausente;
          content = <Text style={styles.markerIcon}>✕</Text>;
        } else {
          const tipo = servicoTipo(point.firstDelivery.servico);
          backgroundColor = ROUTE_MARKER_COLORS[tipo];
          const isLight = tipo === "Flex";
          content = (
            <Text style={[styles.markerText, { color: isLight ? "#333" : "#fff" }]}>
              {paradaNumber}
            </Text>
          );
        }
        return (
          <Marker
            key={`parada-${point.paradaIndex}-${point.firstDelivery.id_saida}`}
            coordinate={{ latitude: point.latitude, longitude: point.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={tracksMarkerChanges}
            title={String(paradaNumber)}
            onPress={() => onMarkerPress?.(point.firstDelivery, point.paradaIndex - 1)}
          >
            <View
              style={[
                styles.markerWrap,
                { backgroundColor },
                isFirst && styles.markerWrapFirst,
                isSelected && { borderColor: "#000", borderWidth: 3 },
              ]}
            >
              {content}
            </View>
          </Marker>
        );
      })}
    </MapView>
      {showEmptyMessage && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyText}>
            Nenhuma entrega com endereço válido.{"\n"}Adicione endereços para montar sua rota.
          </Text>
        </View>
      )}
    </View>
  );
}
