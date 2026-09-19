import { Alert } from "react-native";
import * as Location from "expo-location";
import type { OptimizeRouteOptions, OptimizeRouteResult } from "../../../store/deliveryStore";
import { useRouteDestinationStore } from "../../../store/routeDestinationStore";
import { formatApiError } from "../../../utils/formatApiError";
import {
  beginOptimizeIdempotencyKey,
  endOptimizeIdempotencyKey,
  isOptimizeInFlight,
} from "./optimizeIdempotency";
import { decideOptimizeGpsStart } from "./optimizeGpsStart";
import { resolveGpsPositionCascade } from "./optimizeGpsCascade";

type OptimizeFn = (opts?: OptimizeRouteOptions) => Promise<OptimizeRouteResult>;

export type OptimizeRouteFeedbackOptions = OptimizeRouteOptions & {
  /** Não exibe Alert automático (ex.: recálculo parcial na revisão). */
  silent?: boolean;
};

function resolveEndOpts(opts?: OptimizeRouteFeedbackOptions): OptimizeRouteOptions {
  if (opts?.toLat != null && opts?.toLon != null) {
    return { toLat: opts.toLat, toLon: opts.toLon };
  }
  const dest = useRouteDestinationStore.getState();
  if (dest.useDestination && dest.end) {
    return { toLat: dest.end.latitude, toLon: dest.end.longitude };
  }
  return {};
}

function showOptimizeAlert(result: OptimizeRouteResult): void {
  if (!result.ok || result.message === "noop") return;
  if (result.mode === "priority_soft") {
    Alert.alert(
      "Rota otimizada",
      "Ordem atualizada com prioridade por proximidade."
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
  opts?: OptimizeRouteFeedbackOptions
): Promise<OptimizeRouteResult | null> {
  const silent = opts?.silent === true;
  if (isOptimizeInFlight()) {
    if (!silent) {
      Alert.alert("Aguarde", "Já existe uma otimização em andamento.");
    }
    return null;
  }
  // Garante key criada no início do gesto (antes de retries internos).
  beginOptimizeIdempotencyKey();
  const dest = useRouteDestinationStore.getState();
  const endOpts = resolveEndOpts(opts);
  const destinationMode =
    dest.useDestination && endOpts.toLat != null && endOpts.toLon != null;
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (destinationMode && status !== "granted") {
      const asked = await Location.requestForegroundPermissionsAsync();
      status = asked.status;
    }
    let gps: { fromLat: number; fromLon: number } | null = null;
    if (status === "granted") {
      const pos = await resolveGpsPositionCascade(Location);
      if (pos) {
        gps = { fromLat: pos.latitude, fromLon: pos.longitude };
      }
    }
    const decision = decideOptimizeGpsStart({
      destinationMode,
      gps,
      permissionGranted: status === "granted",
    });
    if (decision.action === "block") {
      if (!silent) {
        Alert.alert("Localização necessária", decision.message);
      }
      return null;
    }
    const startOpts =
      decision.action === "use"
        ? { fromLat: decision.fromLat, fromLon: decision.fromLon }
        : {};
    const result = await optimizeRoute({ ...opts, ...endOpts, ...startOpts });
    if (!result || result.message === "noop") return result;
    if (!silent) showOptimizeAlert(result);
    return result;
  } catch (e: unknown) {
    const msg = formatApiError(e, "Não foi possível otimizar a rota. Tente novamente.");
    if (!silent) Alert.alert("Erro ao otimizar", msg);
    return null;
  } finally {
    endOptimizeIdempotencyKey();
  }
}
