import { getResumoEntregas } from "../api";
import { alertAusenciaRegistrada, alertEntregaFinalizada } from "./deliveryAlerts";
import { useDiaRotaConcluidaStore } from "../../../store/diaRotaConcluidaStore";
import { useDeliveryStore } from "../../../store/deliveryStore";

export interface PostFinalizeFeedbackOptions {
  tipo: "entregue" | "ausente";
  codigo?: string | null;
  onAfterIndividualAlert?: () => void;
}

async function checkAndOpenDiaConcluido(): Promise<boolean> {
  await useDeliveryStore.getState().loadDeliveries({ onlyToday: true });
  const resumo = await getResumoEntregas();
  if (resumo.pendentes > 0) return false;

  const entregues = resumo.finalizadas_hoje ?? 0;
  const ausentes = resumo.ausentes_hoje ?? resumo.ausentes ?? 0;
  const total = resumo.total_finalizado_hoje ?? entregues + ausentes;

  useDiaRotaConcluidaStore.getState().open({
    entregues,
    ausentes,
    total,
    pendentes: 0,
  });
  return true;
}

export function runPostFinalizeFeedback(opts: PostFinalizeFeedbackOptions): void {
  const { tipo, codigo, onAfterIndividualAlert } = opts;

  const afterAlert = async () => {
    try {
      const opened = await checkAndOpenDiaConcluido();
      if (!opened) onAfterIndividualAlert?.();
    } catch {
      onAfterIndividualAlert?.();
    }
  };

  if (tipo === "entregue") {
    alertEntregaFinalizada(codigo, () => void afterAlert());
  } else {
    alertAusenciaRegistrada(codigo, () => void afterAlert());
  }
}
