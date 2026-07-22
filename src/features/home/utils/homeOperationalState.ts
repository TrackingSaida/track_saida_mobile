import type { CompletedRouteSummary } from "../../../store/homeRouteStore";
import type { HomeHeroState } from "./homeStateAssets";
import {
  formatStopAddress,
  getActiveGroupIndex,
  getFirstPendingInGroup,
  getOrderedRouteDeliveries,
  groupOrderedByAddress,
  routeHasPendingDeliveries,
} from "../../entregas/utils/routeUtils";
import type { EntregaListItem } from "../../entregas/types";

export type HomeResumo = {
  pendentes: number;
  finalizadas_hoje: number;
  ausentes: number;
  atraso_d1: number;
};

export type HomeOperationalInput = {
  roteirizacaoHabilitada: boolean;
  resumo: HomeResumo;
  activeRouteId: string | null;
  rotaAtivaValid: boolean;
  routeOrder: number[];
  routeDeliveries: EntregaListItem[];
  activeStopIndex: number;
  routeDeliveryStatus: Record<number, "pendente" | "entregue" | "ausente">;
  ephemeralCompleted: CompletedRouteSummary | null;
};

export type HomeOperationalView = {
  heroState: HomeHeroState;
  title: string;
  description: string;
  extraLines: string[];
};

function buildRouteStats(routeDeliveries: EntregaListItem[], routeOrder: number[]) {
  const ordered = getOrderedRouteDeliveries(routeDeliveries, routeOrder);
  const groups = groupOrderedByAddress(ordered);
  return {
    paradas: groups.length,
    pedidos: ordered.length,
    groups,
    ordered,
  };
}

function buildActiveRouteLines(
  groups: ReturnType<typeof groupOrderedByAddress>,
  activeStopIndex: number,
  routeDeliveryStatus: Record<number, "pendente" | "entregue" | "ausente">
): { stopNumber: number; totalStops: number; address: string; pedidos: number; extraLines: string[] } {
  const totalStops = groups.length;
  const activeGroupIdx = getActiveGroupIndex(groups, activeStopIndex);
  const group = groups[activeGroupIdx >= 0 ? activeGroupIdx : 0];
  const stopNumber = activeGroupIdx >= 0 ? activeGroupIdx + 1 : 1;
  const target = group ? getFirstPendingInGroup(group, routeDeliveryStatus) ?? group.deliveries[0] : null;
  const address = target ? formatStopAddress(target) : "—";
  const pedidos = group?.deliveries.length ?? 0;
  return {
    stopNumber,
    totalStops,
    address,
    pedidos,
    extraLines: [
      `Parada atual ${stopNumber} de ${totalStops}`,
      `Próxima: ${address}`,
      `${pedidos} pedido${pedidos !== 1 ? "s" : ""}`,
    ],
  };
}

export function deriveHomeOperationalView(input: HomeOperationalInput): HomeOperationalView {
  const {
    roteirizacaoHabilitada,
    resumo,
    activeRouteId,
    rotaAtivaValid,
    routeOrder,
    routeDeliveries,
    activeStopIndex,
    routeDeliveryStatus,
    ephemeralCompleted,
  } = input;

  if (roteirizacaoHabilitada && ephemeralCompleted) {
    return {
      heroState: "route_completed",
      title: "Rota concluída",
      description: `${ephemeralCompleted.paradas} paradas · ${ephemeralCompleted.pedidos} pedidos`,
      extraLines: [],
    };
  }

  if (
    roteirizacaoHabilitada &&
    activeRouteId != null &&
    rotaAtivaValid &&
    routeOrder.length > 0 &&
    routeHasPendingDeliveries(routeOrder, routeDeliveryStatus)
  ) {
    const { groups } = buildRouteStats(routeDeliveries, routeOrder);
    const active = buildActiveRouteLines(groups, activeStopIndex, routeDeliveryStatus);
    return {
      heroState: "route_active",
      title: "Rota em andamento",
      description: active.extraLines[0] ?? "",
      extraLines: active.extraLines.slice(1),
    };
  }

  if (roteirizacaoHabilitada && routeOrder.length > 0 && activeRouteId == null) {
    const { paradas, pedidos } = buildRouteStats(routeDeliveries, routeOrder);
    return {
      heroState: "route_ready",
      title: "Rota pronta",
      description: `${paradas} paradas · ${pedidos} pedidos`,
      extraLines: [],
    };
  }

  if (resumo.pendentes > 0) {
    const countLabel = `${resumo.pendentes} entrega${resumo.pendentes !== 1 ? "s" : ""} aguardando ação`;
    if (roteirizacaoHabilitada) {
      return {
        heroState: "pending",
        title: "Pacotes aguardando organização",
        description: countLabel,
        extraLines: [],
      };
    }
    return {
      heroState: "pending",
      title: "Entregas pendentes",
      description: countLabel,
      extraLines: [],
    };
  }

  return {
    heroState: "idle",
    title: "Pronto para começar?",
    description: "Escaneie os pacotes para iniciar suas entregas.",
    extraLines: [],
  };
}

export type HomeCtaAction =
  | "scan"
  | "scan_insert"
  | "scan_deliver"
  | "prepare_route"
  | "view_pending"
  | "start_route"
  | "continue_route"
  | "locate_package"
  | "edit_route"
  | "view_summary"
  | "route_history";

export type HomeCta = {
  label: string;
  action: HomeCtaAction;
  subtitle?: string;
  primary?: boolean;
  layout?: "full" | "half";
};

const SCAN_INSERT_CTA: HomeCta = {
  label: "Inserir novos pacotes",
  subtitle: "Ler pacotes da carga",
  action: "scan_insert",
  layout: "half",
};

const SCAN_DELIVER_CTA: HomeCta = {
  label: "Escanear para entregar",
  subtitle: "Finalizar uma entrega",
  action: "scan_deliver",
  layout: "half",
};

const VIEW_PENDING_CTA: HomeCta = {
  label: "Ver pendentes",
  action: "view_pending",
  layout: "full",
};

/** Conta pedidos ainda pendentes na ordem da rota ativa. */
export function countPendingOnActiveRoute(
  routeOrder: number[],
  routeDeliveryStatus: Record<number, "pendente" | "entregue" | "ausente">
): number {
  return routeOrder.filter(
    (id) => (routeDeliveryStatus[id] ?? "pendente") === "pendente"
  ).length;
}

/** Quando a rota já está ativa, oferece Preparar rota se faltam endereços ou há pacotes preparados fora da rota. */
export function shouldOfferPrepareRouteWhileActive(input: {
  semEndereco: number;
  preparadosComEndereco: number;
  /** Pedidos ainda pendentes na rota (não o tamanho total da ordem). */
  pedidosPendentesNaRotaAtiva: number;
}): boolean {
  if (input.semEndereco > 0) return true;
  if (input.preparadosComEndereco <= 0) return false;
  return input.preparadosComEndereco !== input.pedidosPendentesNaRotaAtiva;
}

export type HomeRouteCtas = {
  layout: "route";
  primary: HomeCta;
  secondary: HomeCta[];
};

export type HomeOperationalActionsCtas = {
  layout: "operational";
  viewPending?: HomeCta;
  scanInsert: HomeCta;
  scanDeliver?: HomeCta;
  tertiary?: HomeCta[];
};

export type HomeCtasResult = HomeRouteCtas | HomeOperationalActionsCtas;

export type DeriveHomeCtasOptions = {
  loadingStartRoute?: boolean;
  offerPrepareRoute?: boolean;
};

export function deriveHomeCtas(
  view: HomeOperationalView,
  roteirizacaoHabilitada: boolean,
  loadingStartRouteOrOpts?: boolean | DeriveHomeCtasOptions,
  maybeOpts?: DeriveHomeCtasOptions
): HomeCtasResult {
  const opts: DeriveHomeCtasOptions =
    typeof loadingStartRouteOrOpts === "object" && loadingStartRouteOrOpts != null
      ? loadingStartRouteOrOpts
      : { loadingStartRoute: Boolean(loadingStartRouteOrOpts), ...maybeOpts };
  const loadingStartRoute = opts.loadingStartRoute === true;
  const offerPrepareRoute = opts.offerPrepareRoute === true;
  const { heroState } = view;

  if (heroState === "route_completed") {
    return {
      layout: "route",
      primary: { label: "Ver resumo", action: "view_summary", primary: true },
      secondary: [
        { label: "Minhas rotas", action: "route_history" },
        SCAN_INSERT_CTA,
      ],
    };
  }

  if (heroState === "route_active") {
    const secondary: HomeCta[] = [
      { label: "Localizar pacote", action: "locate_package" },
      SCAN_INSERT_CTA,
    ];
    if (roteirizacaoHabilitada && offerPrepareRoute) {
      secondary.push({ label: "Preparar rota", action: "prepare_route" });
    }
    return {
      layout: "route",
      primary: { label: "Continuar rota", action: "continue_route", primary: true },
      secondary,
    };
  }

  if (heroState === "route_ready") {
    return {
      layout: "route",
      primary: {
        label: loadingStartRoute ? "Iniciando…" : "Iniciar rota",
        action: "start_route",
        primary: true,
      },
      secondary: [
        { label: "Localizar pacote", action: "locate_package" },
        { label: "Editar rota", action: "edit_route" },
        SCAN_INSERT_CTA,
      ],
    };
  }

  if (heroState === "pending") {
    const tertiary = roteirizacaoHabilitada
      ? [{ label: "Preparar rota", action: "prepare_route" as const, layout: "full" as const }]
      : undefined;
    return {
      layout: "operational",
      viewPending: VIEW_PENDING_CTA,
      scanInsert: SCAN_INSERT_CTA,
      scanDeliver: SCAN_DELIVER_CTA,
      tertiary,
    };
  }

  return {
    layout: "operational",
    scanInsert: { ...SCAN_INSERT_CTA, layout: "full" },
  };
}
