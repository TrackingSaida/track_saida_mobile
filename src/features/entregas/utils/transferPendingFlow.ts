import { Alert } from "react-native";
import {
  getRotasAtiva,
  getTodayISO,
  listarTransferenciasPendentes,
  type TransferenciaPendenteResumo,
} from "../api";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { useTransferPendingStore } from "../../../store/transferPendingStore";

export async function syncRouteOrderFromServer(): Promise<{
  removedIds: number[];
  geometryStale: boolean;
  status: string | null;
  pendencias: TransferenciaPendenteResumo[];
}> {
  const before = new Set(useDeliveryStore.getState().routeOrder);
  const ativa = await getRotasAtiva(getTodayISO());
  const pendencias = ativa?.transferencias_pendentes ?? [];

  if (!ativa || ativa.status === "sem_rota" || !ativa.rota_id) {
    if (before.size > 0 && useDeliveryStore.getState().activeRouteId == null) {
      // Rota pronta cancelada no servidor
      const removed = [...before];
      useDeliveryStore.getState().clearActiveRouteState();
      return {
        removedIds: removed,
        geometryStale: false,
        status: "sem_rota",
        pendencias,
      };
    }
    if (ativa?.status === "sem_rota") {
      await useDeliveryStore.getState().reconcileActiveRoute();
    }
    return {
      removedIds: [],
      geometryStale: false,
      status: ativa?.status ?? null,
      pendencias,
    };
  }

  await useDeliveryStore.getState().restoreActiveRoute(ativa);
  const after = new Set(useDeliveryStore.getState().routeOrder);
  const removedIds = [...before].filter((id) => !after.has(id));
  const geometryStale = String(ativa.geometry_status || "") === "stale";
  return {
    removedIds,
    geometryStale,
    status: ativa.status ?? null,
    pendencias,
  };
}

export function promptRemovedFromRoute(opts: {
  removedCount: number;
  geometryStale: boolean;
  isActive: boolean;
  onReoptimize?: () => void;
  onRefreshGeometry?: () => void;
}): void {
  if (opts.removedCount <= 0) return;
  const title = "Pedido removido da sua rota";
  const body =
    opts.removedCount === 1
      ? "Um pedido saiu da sua carga. As paradas podem ter mudado."
      : `${opts.removedCount} pedidos saíram da sua carga. As paradas podem ter mudado.`;

  const buttons: {
    text: string;
    style?: "cancel" | "default" | "destructive";
    onPress?: () => void;
  }[] = [{ text: "OK", style: "cancel" }];

  if (opts.isActive && opts.geometryStale && opts.onRefreshGeometry) {
    buttons.push({
      text: "Atualizar trajeto",
      onPress: opts.onRefreshGeometry,
    });
  }
  if (opts.onReoptimize) {
    buttons.push({
      text: opts.isActive ? "Reorganizar restantes" : "Reotimizar rota",
      onPress: opts.onReoptimize,
    });
  }
  Alert.alert(title, body, buttons);
}

/**
 * Enfileira pendências para o TransferPendingGate (Modal global).
 * Não usa Alert.alert — evita falha sob Modals do RouteBuilder no Android.
 * Retorna true se algo novo entrou na fila.
 */
export async function promptTransferenciasPendentes(
  items?: TransferenciaPendenteResumo[]
): Promise<boolean> {
  let list = items;
  if (!list) {
    try {
      list = await listarTransferenciasPendentes();
    } catch {
      return false;
    }
  }
  if (!list.length) return false;
  const added = useTransferPendingStore.getState().enqueue(list);
  return added > 0;
}

/** Enfileira a partir do payload de push; enriquece/fallback via GET pendentes. */
export async function promptTransferenciasFromPush(
  data?: Record<string, unknown> | null
): Promise<boolean> {
  let fromPayload = false;
  if (data) {
    fromPayload = useTransferPendingStore.getState().enqueueFromPushData(data);
  }
  // Sempre tenta o GET para código/rota e outras pendências; se payload já enfileirou, não falha se GET cair.
  const fromApi = await promptTransferenciasPendentes();
  return fromPayload || fromApi;
}
