/**
 * OSRM (Open Source Routing Machine) - obtém geometria da rota por ruas entre pontos.
 * Usado quando a rota é iniciada para desenhar a linha no mapa seguindo vias.
 */

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

/**
 * Retorna array de coordenadas da rota por ruas entre os pontos, em ordem.
 * Em caso de erro (rede, OSRM indisponível, rota inválida), retorna null.
 */
export async function fetchOsrmRoutePolyline(points: RoutePoint[]): Promise<RoutePoint[] | null> {
  if (points.length < 2) return null;
  const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=geojson`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "TrackSaidaMobile/1.0" } });
    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{ geometry?: { coordinates?: [number, number][] } }>;
    };
    if (data.code !== "Ok" || !data.routes?.[0]?.geometry?.coordinates?.length) return null;
    const coordinates = data.routes[0].geometry!.coordinates!;
    return coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
  } catch {
    return null;
  }
}
