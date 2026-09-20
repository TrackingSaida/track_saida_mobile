import {
  SCAN_COLETA_CTA,
  type HomeCta,
  type HomeCtasResult,
  type HomeOperationalView,
} from "./homeOperationalState";

export type HomePresentation = {
  view: HomeOperationalView;
  viewPending?: HomeCta;
  nextAction?: HomeCta;
  completedAction?: HomeCta;
  /** CTA no próprio card (idle → scan_insert já calculado por deriveHomeCtas). */
  cardAction?: HomeCta;
  /** Atalho de coleta no idle, só se o token já libera leitura de coleta. */
  coletaAction?: HomeCta;
};

export type MapHomeCtasOptions = {
  showColeta?: boolean;
};

const IDLE_INSERT_LABEL = "Inserir pacotes";
const IDLE_COLETA_DESCRIPTION = "Leia a carga ou registre uma coleta para começar.";

/**
 * Posiciona CTAs já calculados por deriveHomeCtas na Home nova.
 * Não reimplementa estados operacionais — só filtra o que sai da Home
 * (scan vai para Escanear) e trata route_completed como estado, não próxima ação.
 */
export function mapHomeCtasToPresentation(
  view: HomeOperationalView,
  ctas: HomeCtasResult,
  opts?: MapHomeCtasOptions
): HomePresentation {
  if (view.heroState === "route_completed") {
    return {
      view,
      completedAction: ctas.layout === "route" ? ctas.primary : undefined,
    };
  }

  if (ctas.layout === "route") {
    return {
      view,
      nextAction: ctas.primary,
    };
  }

  const idle = !ctas.viewPending && !ctas.tertiary?.[0];
  const showColeta = idle && opts?.showColeta === true;
  return {
    view: showColeta ? { ...view, description: IDLE_COLETA_DESCRIPTION } : view,
    viewPending: ctas.viewPending,
    nextAction: ctas.tertiary?.[0],
    cardAction: idle ? { ...ctas.scanInsert, label: IDLE_INSERT_LABEL } : undefined,
    coletaAction: showColeta ? SCAN_COLETA_CTA : undefined,
  };
}
