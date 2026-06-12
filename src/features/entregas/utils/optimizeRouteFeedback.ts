import { Alert } from "react-native";
import * as Location from "expo-location";
import type { OptimizeRouteOptions, OptimizeRouteResult } from "../../../store/deliveryStore";
import { formatApiError } from "../../../utils/formatApiError";

type OptimizeFn = (opts?: OptimizeRouteOptions) => Promise<OptimizeRouteResult>;

const GPS_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} expirou após ${Math.round(ms / 1000)}s`)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function showOptimizeAlert(result: OptimizeRouteResult): void {
  if (!result.ok || result.message === "noop") return;
  if (result.mode === "priority_soft") {
    Alert.alert(
      "Rota otimizada",
      "Ordem atualizada com prioridade suave por proximidade."
    );
    return;
  }
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
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    let result: OptimizeRouteResult;
    if (status !== "granted") {
      result = await optimizeRoute(opts);
    } else {
      try {
        const pos = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          GPS_TIMEOUT_MS,
          "Localização GPS"
        );
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
  } catch (e: unknown) {
    const msg = formatApiError(e, "Não foi possível otimizar a rota. Tente novamente.");
    Alert.alert("Erro ao otimizar", msg);
    return null;
  }
}
