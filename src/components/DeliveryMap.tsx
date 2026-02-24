import React, { useMemo, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useDeliveryStore } from "../store/deliveryStore";
import { useThemeColors } from "../theme/colors";
import { getOrderedRouteDeliveries, servicoTipo, ROUTE_MARKER_COLORS } from "../features/entregas/utils/routeUtils";
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
}

export default function DeliveryMap({ onMarkerPress, selectedId, centerOnStopId, geocodedCoords = {} }: DeliveryMapProps) {
  const mapRef = useRef<MapView>(null);
  const colors = useThemeColors();
  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const routeOrder = useDeliveryStore((s) => s.routeOrder);
  const routeDeliveryStatus = useDeliveryStore((s) => s.routeDeliveryStatus);

  const ordered = useMemo(
    () => getOrderedRouteDeliveries(routeDeliveries, routeOrder),
    [routeDeliveries, routeOrder]
  );

  const withCoords = useMemo(() => {
    return ordered
      .map((d) => {
        const lat = d.latitude ?? geocodedCoords[d.id_saida]?.latitude;
        const lon = d.longitude ?? geocodedCoords[d.id_saida]?.longitude;
        return lat != null && lon != null ? { ...d, latitude: lat, longitude: lon } as EntregaListItem & { latitude: number; longitude: number } : null;
      })
      .filter((x): x is EntregaListItem & { latitude: number; longitude: number } => x != null);
  }, [ordered, geocodedCoords]);

  const region = useMemo(() => {
    if (withCoords.length === 0) return DEFAULT_REGION;
    const lats = withCoords.map((d) => d.latitude!);
    const lons = withCoords.map((d) => d.longitude!);
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
        withCoords.map((d) => ({ latitude: d.latitude!, longitude: d.longitude! })),
        { edgePadding: { top: 48, right: 24, bottom: 24, left: 24 }, animated: true }
      );
    }
  }, [withCoords]);

  const prevCenterIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (centerOnStopId == null) return;
    if (prevCenterIdRef.current === centerOnStopId) return;
    prevCenterIdRef.current = centerOnStopId;
    const d = ordered.find((x) => x.id_saida === centerOnStopId);
    const lat = d?.latitude ?? geocodedCoords[d?.id_saida ?? 0]?.latitude;
    const lon = d?.longitude ?? geocodedCoords[d?.id_saida ?? 0]?.longitude;
    if (lat != null && lon != null) {
      mapRef.current?.animateToRegion(
        {
          latitude: lat,
          longitude: lon,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        400
      );
    }
  }, [centerOnStopId, ordered, geocodedCoords]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        map: { flex: 1, width: "100%", ...(Platform.OS === "android" ? { minHeight: 200 } : {}) },
        markerWrap: {
          width: 36,
          height: 36,
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
      }),
    []
  );

  const polylineCoordinates = useMemo(
    () =>
      withCoords.length >= 2
        ? withCoords.map((d) => ({ latitude: d.latitude!, longitude: d.longitude! }))
        : [],
    [withCoords]
  );
  /* Polyline e marcadores usam apenas ordered (getOrderedRouteDeliveries); nunca routeDeliveries direto. */

  const showEmptyMessage = ordered.length > 0 && withCoords.length === 0;

  const markersData = useMemo(
    () =>
      ordered.map((d) => {
        const lat = d.latitude ?? geocodedCoords[d.id_saida]?.latitude;
        const lon = d.longitude ?? geocodedCoords[d.id_saida]?.longitude;
        return { d, lat, lon };
      }),
    [ordered, geocodedCoords]
  );

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
      {markersData.map(({ d, lat, lon }) => {
        if (lat == null || lon == null) return null;
        const idx = routeOrder.indexOf(d.id_saida);
        const routeNumber = idx >= 0 ? idx + 1 : 0;
        const status = routeDeliveryStatus[d.id_saida] ?? "pendente";
        const isSelected = selectedId === d.id_saida;
        const isFirst = routeNumber === 1;
        let backgroundColor: string;
        let content: React.ReactNode;
        if (status === "entregue") {
          backgroundColor = MARKER_STATUS_COLORS.entregue;
          content = <Text style={styles.markerIcon}>✓</Text>;
        } else if (status === "ausente") {
          backgroundColor = MARKER_STATUS_COLORS.ausente;
          content = <Text style={styles.markerIcon}>!</Text>;
        } else {
          const tipo = servicoTipo(d.servico);
          backgroundColor = ROUTE_MARKER_COLORS[tipo];
          const isLight = tipo === "Flex";
          content = (
            <Text style={[styles.markerText, { color: isLight ? "#333" : "#fff" }]}>
              {routeNumber >= 1 ? routeNumber : "—"}
            </Text>
          );
        }
        return (
          <Marker
            key={d.id_saida}
            coordinate={{ latitude: lat, longitude: lon }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => onMarkerPress?.(d, routeNumber >= 1 ? routeNumber - 1 : 0)}
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
