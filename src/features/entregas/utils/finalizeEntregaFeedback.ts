import { getResumoEntregas, getRotaResumo } from "../api";
import {
  alertAusenciaRegistrada,
  alertEntregaAtrasadaConcluida,
  alertEntregaFinalizada,
} from "./deliveryAlerts";
import {
  determineSyncCompletionContext,
  resolveCompletionContextAfterFinalize,
} from "./determineCompletionContext";
import {
  useDiaRotaConcluidaStore,
  VALOR_DIA_LABEL,
  VALOR_ROTA_LABEL,
} from "../../../store/diaRotaConcluidaStore";
import { useDeliveryStore } from "../../../store/deliveryStore";
import { recordHomeRouteCompleted } from "../../../store/homeRouteStore";
import { playSound } from "../../../utils/sound";

export interface PostFinalizeFeedbackOptions {
  tipo: "entregue" | "ausente";
  codigo?: string | null;
  entregaAtrasada?: boolean;
  routeJustCompleted?: boolean;
  rotaIdForResumo?: string | number | null;
  isRouteFlow?: boolean;
  queued?: boolean;
  onAfterIndividualAlert?: () => void;
}

async function openDayCompletedModal(): Promise<boolean> {
  await useDeliveryStore.getState().loadDeliveries({ onlyToday: true });
  const resumo = await getResumoEntregas();
  const entregues = resumo.finalizadas_hoje ?? 0;
  const ausentes = resumo.ausentes_hoje ?? resumo.ausentes ?? 0;
  const total = resumo.total_finalizado_hoje ?? entregues + ausentes;
  const valorRaw = resumo.valor_finalizado_hoje;
  const valorDia =
    valorRaw != null && String(valorRaw).trim() !== ""
      ? String(valorRaw)
      : "0";

  useDiaRotaConcluidaStore.getState().open({
    variant: "day",
    entregues,
    ausentes,
    total,
    pendentes: 0,
    valorDia,
    valorLabel: VALOR_DIA_LABEL,
  });
  return true;
}

async function openRouteCompletedModal(rotaId: string | number): Promise<boolean> {
  const resumo = await getRotaResumo(rotaId);
  await recordHomeRouteCompleted(rotaId, resumo.paradas, resumo.pedidos).catch(() => undefined);
  useDiaRotaConcluidaStore.getState().open({
    variant: "route",
    paradas: resumo.paradas,
    pedidos: resumo.pedidos,
    entregues: resumo.entregues,
    ausentes: resumo.ausentes,
    pendentes: resumo.pendentes,
    valorRota: String(resumo.valor_total ?? "0"),
    valorLabel: VALOR_ROTA_LABEL,
  });
  return true;
}

function showIndividualToast(
  tipo: "entregue" | "ausente",
  codigo: string | null | undefined,
  entregaAtrasada: boolean,
  pendingSync?: boolean
): void {
  if (entregaAtrasada) {
    alertEntregaAtrasadaConcluida(codigo, tipo, undefined, pendingSync);
    return;
  }
  if (tipo === "entregue") {
    alertEntregaFinalizada(codigo, undefined, pendingSync);
  } else {
    alertAusenciaRegistrada(codigo, undefined, pendingSync);
  }
}

/**
 * Feedback pós-finalização sem Alert bloqueante:
 * libera navegação na hora + toast curto; modais de rota/dia seguem em background.
 */
export function runPostFinalizeFeedback(opts: PostFinalizeFeedbackOptions): void {
  const {
    tipo,
    codigo,
    entregaAtrasada = false,
    routeJustCompleted = false,
    rotaIdForResumo = null,
    isRouteFlow = false,
    queued = false,
    onAfterIndividualAlert,
  } = opts;

  const activeRouteId = useDeliveryStore.getState().activeRouteId;

  const syncContext = determineSyncCompletionContext({
    activeRouteId,
    routeJustCompleted,
    entregaAtrasada,
    isRouteFlow,
  });

  // Navegação imediatamente (sem esperar OK).
  onAfterIndividualAlert?.();

  if (syncContext !== "ROUTE_COMPLETED") {
    void playSound(tipo === "entregue" ? "success" : "warn");
    showIndividualToast(tipo, codigo, syncContext === "LATE_DELIVERY" || entregaAtrasada, queued);
  }

  void (async () => {
    try {
      if (routeJustCompleted && rotaIdForResumo != null) {
        await openRouteCompletedModal(rotaIdForResumo);
        return;
      }

      if (syncContext === "ROUTE_COMPLETED") {
        return;
      }

      const context = await resolveCompletionContextAfterFinalize(
        {
          activeRouteId,
          routeJustCompleted,
          entregaAtrasada,
          isRouteFlow,
        },
        getResumoEntregas
      );

      if (context === "DAY_COMPLETED") {
        await openDayCompletedModal();
      }
    } catch {
      /* feedback secundário não deve bloquear o fluxo operacional */
    }
  })();
}
