import type { HomeResumo } from "./homeOperationalState";

export type HomeResumoMetrics = {
  totalDia: number;
  percentualConcluido: number;
  taxaSucesso: number | null;
};

export function computeHomeResumoMetrics(resumo: HomeResumo): HomeResumoMetrics {
  const totalDia = resumo.pendentes + resumo.finalizadas_hoje + resumo.ausentes;
  const percentualConcluido =
    totalDia > 0 ? Math.round((resumo.finalizadas_hoje / totalDia) * 100) : 0;

  const tentativasFinalizadas = resumo.finalizadas_hoje + resumo.ausentes;
  const taxaSucesso =
    tentativasFinalizadas > 0
      ? Math.round((resumo.finalizadas_hoje / tentativasFinalizadas) * 100)
      : null;

  return { totalDia, percentualConcluido, taxaSucesso };
}
