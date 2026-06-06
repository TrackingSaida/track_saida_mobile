import React, { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Platform, Alert } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { useDeliveryStore } from "../store/deliveryStore";
import { useThemeColors } from "../theme/colors";
import MapLocateButton from "./MapLocateButton";
import {
  getOrderedRouteDeliveries,
  groupOrderedByAddress,
  getGroupStatus,
  getStopMarkerOperationalState,
  spreadOverlappingStopCoords,
} from "../features/entregas/utils/routeUtils";
import type { EntregaListItem } from "../features/entregas/types";
import RouteStopMarker from "./RouteStopMarker";
import { clusterMapPoints } from "../features/entregas/utils/mapClusterUtils";

const DEFAULT_REGION = {
  latitude: -23.55,
  longitude: -46.63,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const LOCATE_ZOOM_DELTA = 0.008;

type GroupedMapPoint = {
  paradaIndex: number;
  groupIndex: number;
  packageCount: number;
  latitude: number;
  longitude: number;
  firstDelivery: EntregaListItem;
  status: "pendente" | "entregue" | "ausente";
};

export interface DeliveryMapProps {
  onMarkerPress?: (delivery: EntregaListItem, index: number) => void;
  selectedId?: number | null;
  centerOnStopId?: number | null;
  geocodedCoords?: Record<number, { latitude: number; longitude: number }>;
  routePolyline?: Array<{ latitude: number; longitude: number }>;
  routeMode?: boolean;
  isRouteActive?: boolean;
  polylineWarning?: string | null;
  activeGroupIndex?: number;
  selectedStopNumber?: number | null;
  controlsBottomInset?: number;
  showLocateButton?: boolean;
}

export default function DeliveryMap({
  onMarkerPress,
  selectedId,
  centerOnStopId,
  geocodedCoords = {},
  routePolyline,
  routeMode = true,
  isRouteActive: isRouteActiveProp,
  polylineWarning,
  activeGroupIndex = -1,
  selectedStopNumber = null,
  controlsBottomInset = 16,
  showLocateButton = true,
}: DeliveryMapProps) {
  const mapRef = useRef<MapView>(null);
  const colors = useThemeColors();
  const routeDeliveries = useDeliveryStore((s) => s.routeDeliveries);
  const routeOrder = useDeliveryStore((s) => s.routeOrder);
  const routeDeliveryStatus = useDeliveryStore((s) => s.routeDeliveryStatus);
  const activeRouteId = useDeliveryStore((s) => s.activeRouteId);
  const activeStopIndex = useDeliveryStore((s) => s.activeStopIndex);
  const currentLocation = useDeliveryStore((s) => s.currentLocation);
  const setCurrentLocation = useDeliveryStore((s) => s.setCurrentLocation);
  const [locating, setLocating] = useState(false);

  const isRouteActive = activeRouteId != null;

  const ordered = useMemo(
    () => getOrderedRouteDeliveries(routeDeliveries, routeOrder),
    [routeDeliveries, routeOrder]
  );

  const groupedStops = useMemo(() => groupOrderedByAddress(ordered), [ordered]);

  const groupedPointsWithCoords = useMemo(() => {
    const result: GroupedMapPoint[] = [];
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
      result.push({
        paradaIndex: i + 1,
        groupIndex: i,
        packageCount: group.deliveries.length,
        latitude: lat,
        longitude: lon,
        firstDelivery: withCoords,
        status: getGroupStatus(group.deliveries, statusMap),
      });
    }
    return result;
  }, [groupedStops, routeDeliveryStatus, geocodedCoords]);

  const withCoords = groupedPointsWithCoords;

  const displayCoordByParada = useMemo(() => {
    const spread = spreadOverlappingStopCoords(
      withCoords.map((p) => ({
        paradaIndex: p.paradaIndex,
        latitude: p.latitude,
        longitude: p.longitude,
      }))
    );
    const map = new Map<number, { latitude: number; longitude: number }>();
    for (const p of spread) {
      map.set(p.paradaIndex, { latitude: p.latitude, longitude: p.longitude });
    }
    return map;
  }, [withCoords]);

  const mapDisplayItems = useMemo(
    () => clusterMapPoints(groupedPointsWithCoords, { routeMode }),
    [groupedPointsWithCoords, routeMode]
  );

  const highlightStopIndex = useMemo(() => {
    if (selectedStopNumber != null) {
      const idx = withCoords.findIndex((p) => p.paradaIndex === selectedStopNumber);
      if (idx >= 0) return idx;
    }
    if (isRouteActive && activeGroupIndex >= 0) {
      const idx = withCoords.findIndex((p) => p.groupIndex === activeGroupIndex);
      if (idx >= 0) return idx;
    }
    return -1;
  }, [selectedStopNumber, withCoords, isRouteActive, activeGroupIndex]);

  const [markersReady, setMarkersReady] = useState(false);
  const [markerResnapshotActive, setMarkerResnapshotActive] = useState(false);
  const hadSelectionRef = useRef(false);

  const routeOrderSig = useMemo(() => routeOrder.join(","), [routeOrder]);

  useEffect(() => {
    if (groupedPointsWithCoords.length === 0) return;
    setMarkersReady(false);
    const t = setTimeout(() => setMarkersReady(true), Platform.OS === "android" ? 500 : 1500);
    return () => clearTimeout(t);
  }, [groupedPointsWithCoords.length, routeOrderSig]);

  useEffect(() => {
    if (!routeOrderSig) return;
    setMarkerResnapshotActive(true);
    const t = setTimeout(() => setMarkerResnapshotActive(false), 1200);
    return () => clearTimeout(t);
  }, [routeOrderSig]);

  useEffect(() => {
    const hasSelection = selectedStopNumber != null || selectedId != null;
    const hadSelection = hadSelectionRef.current;
    if (hadSelection && !hasSelection) {
      setMarkerResnapshotActive(true);
      const t = setTimeout(() => setMarkerResnapshotActive(false), 1200);
      hadSelectionRef.current = hasSelection;
      return () => clearTimeout(t);
    }
    hadSelectionRef.current = hasSelection;
  }, [selectedStopNumber, selectedId]);

  const tracksMarkerChanges = !markersReady || markerResnapshotActive;

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
        emptyOverlay: {
          ...StyleSheet.absoluteFillObject,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "rgba(255,255,255,0.92)",
          padding: 24,
        },
        emptyText: { fontSize: 16, textAlign: "center", color: "#333", lineHeight: 24 },
        polylineWarning: {
          position: "absolute",
          top: 8,
          left: 12,
          right: 12,
          backgroundColor: "rgba(255,255,255,0.92)",
          borderRadius: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: "rgba(0,0,0,0.08)",
        },
        polylineWarningText: { fontSize: 12, color: "#555", textAlign: "center" },
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

  const stopPolylineCoords = useMemo(
    () => withCoords.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    [withCoords]
  );

  const routeActive = isRouteActiveProp ?? isRouteActive;

  const polylineCoordinates = useMemo(() => {
    if (routeActive) {
      return routePolyline && routePolyline.length >= 2 ? routePolyline : [];
    }
    if (routePolyline && routePolyline.length >= 2) return routePolyline;
    return stopPolylineCoords.length >= 2 ? stopPolylineCoords : [];
  }, [stopPolylineCoords, routePolyline, routeActive]);

  const highlightedPolyline = useMemo(() => {
    if (routeActive || highlightStopIndex < 0) return [];
    return stopPolylineCoords.slice(0, highlightStopIndex + 1);
  }, [stopPolylineCoords, highlightStopIndex, routeActive]);

  const fadedPolylineColor = useMemo(() => {
    const hex = colors.primary.replace("#", "");
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    const value = Number.parseInt(full, 16);
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, 0.35)`;
  }, [colors.primary]);

  const totalStops = withCoords.length;
  const showEmptyMessage = ordered.length > 0 && withCoords.length === 0;

  const centerOnCoords = useCallback((latitude: number, longitude: number) => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: LOCATE_ZOOM_DELTA,
        longitudeDelta: LOCATE_ZOOM_DELTA,
      },
      400
    );
  }, []);

  const handleLocateMe = useCallback(async () => {
    if (locating) return;
    if (currentLocation) {
      centerOnCoords(currentLocation.latitude, currentLocation.longitude);
      return;
    }
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Localização",
          "Permita o acesso à localização para centralizar o mapa na sua posição."
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude, heading } = pos.coords;
      setCurrentLocation({
        latitude,
        longitude,
        heading: typeof heading === "number" && !Number.isNaN(heading) ? heading : undefined,
      });
      centerOnCoords(latitude, longitude);
    } catch {
      Alert.alert("Localização", "Não foi possível obter sua posição atual.");
    } finally {
      setLocating(false);
    }
  }, [locating, currentLocation, centerOnCoords, setCurrentLocation]);

  return (
    <View style={styles.map}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {polylineCoordinates.length >= 2 && (
          <Polyline
            coordinates={polylineCoordinates}
            strokeWidth={routeActive ? 6 : 4}
            strokeColor={routeActive ? colors.primary : fadedPolylineColor}
            lineCap="round"
            lineJoin="round"
            geodesic
          />
        )}
        {!routeActive && highlightedPolyline.length >= 2 && (
          <Polyline
            coordinates={highlightedPolyline}
            strokeWidth={6}
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
        {mapDisplayItems.map((item, idx) => {
          if (item.type === "cluster") {
            const first = item.points[0];
            if (!first) return null;
            const clusterSelected = selectedStopNumber === first.paradaIndex;
            const clusterOpState = getStopMarkerOperationalState(
              first.groupIndex,
              groupedStops,
              routeDeliveryStatus,
              activeGroupIndex,
              isRouteActive
            );
            return (
            <Marker
              key={`cluster-${item.points.map((p) => p.firstDelivery.id_saida).join("-")}`}
              coordinate={{ latitude: item.latitude, longitude: item.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={first.paradaIndex}
              tracksViewChanges={tracksMarkerChanges || clusterSelected}
              onPress={() => onMarkerPress?.(first.firstDelivery, first.paradaIndex - 1)}
              >
                <RouteStopMarker
                  stopNumber={first.paradaIndex}
                  status={first.status}
                  isCurrent={clusterOpState.isCurrent}
                  isNext={clusterOpState.isNext}
                  isCompleted={clusterOpState.isCompleted}
                  isSelected={clusterSelected}
                />
              </Marker>
            );
          }
          const point = item.point;
          const paradaNumber = point.paradaIndex;
          const displayCoord = displayCoordByParada.get(paradaNumber) ?? {
            latitude: point.latitude,
            longitude: point.longitude,
          };
          const opState = getStopMarkerOperationalState(
            point.groupIndex,
            groupedStops,
            routeDeliveryStatus,
            activeGroupIndex,
            isRouteActive
          );
          const isSelected =
            selectedStopNumber === paradaNumber ||
            (selectedId != null && groupedStops[point.groupIndex]?.deliveries.some((d) => d.id_saida === selectedId));

          return (
            <Marker
              key={`parada-${point.firstDelivery.id_saida}`}
              coordinate={displayCoord}
              anchor={{ x: 0.5, y: 0.5 }}
              zIndex={paradaNumber}
              tracksViewChanges={tracksMarkerChanges || isSelected}
              onPress={() => onMarkerPress?.(point.firstDelivery, point.paradaIndex - 1)}
            >
              <RouteStopMarker
                stopNumber={paradaNumber}
                status={point.status}
                isCurrent={opState.isCurrent}
                isNext={opState.isNext}
                isCompleted={opState.isCompleted}
                isSelected={isSelected}
              />
            </Marker>
          );
        })}
      </MapView>
      {polylineWarning && routeActive && (
        <View style={styles.polylineWarning} pointerEvents="none">
          <Text style={styles.polylineWarningText}>{polylineWarning}</Text>
        </View>
      )}
      {showEmptyMessage && (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <Text style={styles.emptyText}>
            Nenhuma entrega com endereço válido.{"\n"}Adicione endereços para montar sua rota.
          </Text>
        </View>
      )}
      {showLocateButton && (
        <MapLocateButton
          bottomInset={controlsBottomInset}
          onPress={handleLocateMe}
          loading={locating}
          disabled={locating}
        />
      )}
    </View>
  );
}
