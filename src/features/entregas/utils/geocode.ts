/**
 * Geocoding via Nominatim (OpenStreetMap) para obter lat/long a partir do endereço.
 * Usado ao salvar endereço sem coordenadas, para o pedido aparecer no mapa.
 */
export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

export async function geocodeAddress(
  address: string,
  options?: { cidade?: string; estado?: string; bairro?: string; numero?: string }
): Promise<GeocodeResult | null> {
  const baseParts = [address, options?.numero, options?.bairro, options?.cidade, options?.estado, "Brasil"].filter(
    Boolean
  );
  const query = baseParts.join(", ");
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "TrackSaidaMobile/1.0" },
    });
    const data = (await res.json()) as { lat?: string; lon?: string }[];
    const first = data?.[0];
    if (first?.lat != null && first?.lon != null) {
      return {
        latitude: parseFloat(first.lat),
        longitude: parseFloat(first.lon),
      };
    }
    return null;
  } catch {
    return null;
  }
}
