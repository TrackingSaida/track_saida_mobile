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
    if (roteirizacaoHabilitada) {
      return {
        heroState: "pending",
        title: "Pacotes aguardando organização",
        description: `${resumo.pendentes} entrega${resumo.pendentes !== 1 ? "s" : ""} pendente${resumo.pendentes !== 1 ? "s" : ""}`,
        extraLines: [],
      };
    }
    return {
      heroState: "pending",
      title: "Entregas pendentes",
      description: `${resumo.pendentes} entrega${resumo.pendentes !== 1 ? "s" : ""} aguardando ação`,
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
  primary?: boolean;
};

export function deriveHomeCtas(
  view: HomeOperationalView,
  roteirizacaoHabilitada: boolean,
  loadingStartRoute?: boolean
): { primary: HomeCta; secondary: HomeCta[] } {
  const { heroState } = view;

  if (heroState === "route_completed") {
    return {
      primary: { label: "Ver resumo", action: "view_summary", primary: true },
      secondary: [{ label: "Histórico de rotas", action: "route_history" }],
    };
  }

  if (heroState === "route_active") {
    return {
      primary: { label: "Continuar rota", action: "continue_route", primary: true },
      secondary: [{ label: "Localizar pacote", action: "locate_package" }],
    };
  }

  if (heroState === "route_ready") {
    return {
      primary: {
        label: loadingStartRoute ? "Iniciando…" : "Iniciar rota",
        action: "start_route",
        primary: true,
      },
      secondary: [
        { label: "Localizar pacote", action: "locate_package" },
        { label: "Editar rota", action: "edit_route" },
      ],
    };
  }

  if (heroState === "pending") {
    if (roteirizacaoHabilitada) {
      return {
        primary: { label: "Preparar rota", action: "prepare_route", primary: true },
        secondary: [{ label: "Ver pendentes", action: "view_pending" }],
      };
    }
    return {
      primary: { label: "Ver pendentes", action: "view_pending", primary: true },
      secondary: [{ label: "Escanear pacotes", action: "scan" }],
    };
  }

  return {
    primary: { label: "Escanear pacotes", action: "scan", primary: true },
    secondary: [],
  };
}
