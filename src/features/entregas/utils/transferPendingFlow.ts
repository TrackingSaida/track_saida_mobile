import { Alert } from "react-native";
import {
  aceitarTransferencia,
  getRotasAtiva,
  getTodayISO,
  listarTransferenciasPendentes,
  recusarTransferencia,
  type TransferenciaPendenteResumo,
} from "../api";
import { useDeliveryStore } from "../../../store/deliveryStore";

let promptOpen = false;

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

export async function promptTransferenciasPendentes(
  items?: TransferenciaPendenteResumo[]
): Promise<boolean> {
  if (promptOpen) return false;
  let list = items;
  if (!list) {
    try {
      list = await listarTransferenciasPendentes();
    } catch {
      return false;
    }
  }
  if (!list.length) return false;

  const first = list[0];
  const codigo = first.codigo || String(first.id_saida);
  promptOpen = true;
  return new Promise((resolve) => {
    Alert.alert(
      "Transferência de pedido",
      `O pedido ${codigo} pode sair da sua rota. Se você aceitar, as paradas restantes podem mudar. Aceitar transferência?`,
      [
        {
          text: "Recusar",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await recusarTransferencia(first.transferencia_id);
              } catch {
                Alert.alert("Erro", "Não foi possível recusar a transferência.");
              } finally {
                promptOpen = false;
                resolve(false);
              }
            })();
          },
        },
        {
          text: "Aceitar",
          onPress: () => {
            void (async () => {
              try {
                await aceitarTransferencia(first.transferencia_id);
                const sync = await syncRouteOrderFromServer();
                promptRemovedFromRoute({
                  removedCount: Math.max(sync.removedIds.length, 1),
                  geometryStale: sync.geometryStale,
                  isActive: sync.status === "em_entrega",
                  onReoptimize: () => {
                    void useDeliveryStore.getState().reoptimizeFullRoute();
                  },
                  onRefreshGeometry: () => {
                    const routeId =
                      useDeliveryStore.getState().activeRouteId ??
                      useDeliveryStore.getState().persistedRouteId;
                    if (!routeId) return;
                    void import("../api").then(({ postRotasGeometryRefresh }) =>
                      postRotasGeometryRefresh(routeId)
                    );
                  },
                });
                resolve(true);
              } catch {
                Alert.alert("Erro", "Não foi possível aceitar a transferência.");
                resolve(false);
              } finally {
                promptOpen = false;
              }
            })();
          },
        },
      ],
      { cancelable: false }
    );
  });
}
