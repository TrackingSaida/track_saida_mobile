export const CLUSTER_THRESHOLD = 15;
export const CLUSTER_DISTANCE_DEG = 0.012;
export const ROUTE_CLUSTER_MAX_STOPS = 50;

export type MapClusterDisplayItem<T extends { latitude: number; longitude: number }> =
  | { type: "single"; point: T }
  | { type: "cluster"; latitude: number; longitude: number; count: number; points: T[] };

export function clusterMapPoints<T extends { latitude: number; longitude: number }>(
  points: T[],
  options: { routeMode?: boolean; clusterThreshold?: number } = {}
): MapClusterDisplayItem<T>[] {
  const { routeMode = false, clusterThreshold = CLUSTER_THRESHOLD } = options;
  if (routeMode && points.length <= ROUTE_CLUSTER_MAX_STOPS) {
    return points.map((point) => ({ type: "single", point }));
  }
  if (points.length <= clusterThreshold) {
    return points.map((point) => ({ type: "single", point }));
  }
  const used = new Set<number>();
  const items: MapClusterDisplayItem<T>[] = [];
  for (let i = 0; i < points.length; i++) {
    if (used.has(i)) continue;
    const cluster = [points[i]];
    used.add(i);
    for (let j = i + 1; j < points.length; j++) {
      if (used.has(j)) continue;
      const dlat = Math.abs(points[i].latitude - points[j].latitude);
      const dlon = Math.abs(points[i].longitude - points[j].longitude);
      if (dlat < CLUSTER_DISTANCE_DEG && dlon < CLUSTER_DISTANCE_DEG) {
        cluster.push(points[j]);
        used.add(j);
      }
    }
    if (cluster.length === 1) {
      items.push({ type: "single", point: cluster[0] });
    } else {
      const avgLat = cluster.reduce((s, p) => s + p.latitude, 0) / cluster.length;
      const avgLon = cluster.reduce((s, p) => s + p.longitude, 0) / cluster.length;
      items.push({
        type: "cluster",
        latitude: avgLat,
        longitude: avgLon,
        count: cluster.length,
        points: cluster,
      });
    }
  }
  return items;
}
