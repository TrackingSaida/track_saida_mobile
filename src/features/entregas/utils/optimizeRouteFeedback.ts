import { Alert } from "react-native";
import * as Location from "expo-location";
import type { OptimizeRouteOptions, OptimizeRouteResult } from "../../../store/deliveryStore";

type OptimizeFn = (opts?: OptimizeRouteOptions) => Promise<OptimizeRouteResult>;

function showOptimizeAlert(result: OptimizeRouteResult): void {
  if (!result.ok || result.message === "noop") return;
  if (result.message === "success") {
    Alert.alert("Rota otimizada", "A ordem das paradas foi atualizada com sucesso.");
  } else if (result.message === "partial") {
    Alert.alert(
      "Rota otimizada parcialmente",
      "Alguns endereços sem coordenadas ficaram ao final da rota."
    );
  } else if (result.message === "local_fallback") {
    Alert.alert(
      "Ordenação local",
      "Não foi possível otimizar online; usamos a ordenação local por proximidade."
    );
  }
}

export async function runOptimizeRouteWithFeedback(
  optimizeRoute: OptimizeFn,
  opts?: OptimizeRouteOptions
): Promise<OptimizeRouteResult | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  let result: OptimizeRouteResult;
  if (status !== "granted") {
    result = await optimizeRoute(opts);
  } else {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      result = await optimizeRoute({
        ...opts,
        fromLat: pos.coords.latitude,
        fromLon: pos.coords.longitude,
      });
    } catch {
      result = await optimizeRoute(opts);
    }
  }
  if (!result || result.message === "noop") return result;
  showOptimizeAlert(result);
  return result;
}
