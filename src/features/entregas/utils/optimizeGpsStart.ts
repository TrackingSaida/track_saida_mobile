export const GPS_START_REQUIRED_MESSAGE =
  "Não foi possível obter sua localização. Ative o GPS e tente gerar a rota de novo.";

export type OptimizeGpsStartDecision =
  | { action: "use"; fromLat: number; fromLon: number }
  | { action: "skip" }
  | { action: "block"; message: string };

export function decideOptimizeGpsStart(params: {
  destinationMode: boolean;
  gps: { fromLat: number; fromLon: number } | null;
}): OptimizeGpsStartDecision {
  if (params.gps) {
    return { action: "use", fromLat: params.gps.fromLat, fromLon: params.gps.fromLon };
  }
  if (params.destinationMode) {
    return { action: "block", message: GPS_START_REQUIRED_MESSAGE };
  }
  return { action: "skip" };
}
