import type { ResumoEntregas } from "../types";

export type CompletionContext =
  | "ROUTE_COMPLETED"
  | "DAY_COMPLETED"
  | "LATE_DELIVERY"
  | "NORMAL_DELIVERY";

export interface CompletionContextInput {
  activeRouteId: string | number | null;
  routeJustCompleted: boolean;
  entregaAtrasada: boolean;
  isRouteFlow: boolean;
}

function isLateDeliveryIsolated(input: CompletionContextInput): boolean {
  return (
    input.entregaAtrasada &&
    !input.routeJustCompleted &&
    !input.isRouteFlow &&
    input.activeRouteId == null
  );
}

export function determineSyncCompletionContext(
  input: CompletionContextInput
): CompletionContext {
  if (input.routeJustCompleted) return "ROUTE_COMPLETED";
  if (isLateDeliveryIsolated(input)) return "LATE_DELIVERY";
  return "NORMAL_DELIVERY";
}

export function resolveDayCompletedFromResumo(resumo: ResumoEntregas): boolean {
  const pendentes = resumo.pendentes ?? 0;
  const atraso = resumo.atraso_d1 ?? 0;
  return pendentes === 0 && atraso === 0;
}

export async function resolveCompletionContextAfterFinalize(
  input: CompletionContextInput,
  fetchResumo: () => Promise<ResumoEntregas>
): Promise<CompletionContext> {
  if (input.routeJustCompleted) return "ROUTE_COMPLETED";
  if (isLateDeliveryIsolated(input)) return "LATE_DELIVERY";
  if (input.activeRouteId != null || input.isRouteFlow) return "NORMAL_DELIVERY";

  const resumo = await fetchResumo();
  if (resolveDayCompletedFromResumo(resumo)) return "DAY_COMPLETED";
  return "NORMAL_DELIVERY";
}
