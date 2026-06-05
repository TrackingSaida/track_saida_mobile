import { getExtratoFinanceiro, getResumoEntregas, getTodayISO } from "../api";
import { alertAusenciaRegistrada, alertEntregaFinalizada } from "./deliveryAlerts";
import { useAuthStore } from "../../../store/authStore";
import {
  useDiaRotaConcluidaStore,
  VALOR_DIA_LABEL_PREVISTO,
} from "../../../store/diaRotaConcluidaStore";
import { useDeliveryStore } from "../../../store/deliveryStore";

export interface PostFinalizeFeedbackOptions {
  tipo: "entregue" | "ausente";
  codigo?: string | null;
  onAfterIndividualAlert?: () => void;
}

async function checkAndOpenDiaConcluido(): Promise<boolean> {
  await useDeliveryStore.getState().loadDeliveries({ onlyToday: true });
  const hoje = getTodayISO();
  const [resumo, extrato] = await Promise.all([
    getResumoEntregas(),
    getExtratoFinanceiro({
      data_inicio: hoje,
      data_fim: hoje,
      status_filtro: "grupo_entregue",
    }),
  ]);
  if (resumo.pendentes > 0) return false;

  const entregues = resumo.finalizadas_hoje ?? 0;
  const ausentes = resumo.ausentes_hoje ?? resumo.ausentes ?? 0;
  const total = resumo.total_finalizado_hoje ?? entregues + ausentes;
  const nome = useAuthStore.getState().currentUser?.username?.trim();

  useDiaRotaConcluidaStore.getState().open({
    entregues,
    ausentes,
    total,
    pendentes: 0,
    valorDia: extrato.valor_a_receber ?? "0",
    valorLabel: VALOR_DIA_LABEL_PREVISTO,
    motoboyNome: nome || undefined,
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
