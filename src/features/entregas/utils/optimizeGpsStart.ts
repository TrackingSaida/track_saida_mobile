export const GPS_START_REQUIRED_MESSAGE =
  "Ainda não conseguimos sua localização. Toque em Gerar rota de novo.";

export const GPS_PERMISSION_REQUIRED_MESSAGE =
  "Permita o acesso à localização e tente gerar a rota de novo.";

export type OptimizeGpsStartDecision =
  | { action: "use"; fromLat: number; fromLon: number }
  | { action: "skip" }
  | { action: "block"; message: string };

export function decideOptimizeGpsStart(params: {
  destinationMode: boolean;
  gps: { fromLat: number; fromLon: number } | null;
  permissionGranted?: boolean;
}): OptimizeGpsStartDecision {
  if (params.gps) {
    return { action: "use", fromLat: params.gps.fromLat, fromLon: params.gps.fromLon };
  }
  if (params.destinationMode) {
    const message =
      params.permissionGranted === false
        ? GPS_PERMISSION_REQUIRED_MESSAGE
        : GPS_START_REQUIRED_MESSAGE;
    return { action: "block", message };
  }
  return { action: "skip" };
}
