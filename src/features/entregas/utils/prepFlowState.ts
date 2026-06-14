import type { OperationalIconKey } from "../../../theme/operationalIcons";

export type PrepPrimaryAction =
  | "scan"
  | "add_address"
  | "generate_route"
  | "separate_packages"
  | "start_route";

export type PrepSecondaryAction =
  | "scan_more"
  | "edit_ordering"
  | "locate_package"
  | "open_route_builder"
  | "generate_partial_route";

export type PrepStatusChip = "empty" | "missing_addresses" | "ready" | "route_ready" | "route_active";

export type PrepFlowInput = {
  totalPedidos: number;
  comEndereco: number;
  semEndereco: number;
  withCoordsCount: number;
  routeOrderLength: number;
  activeRouteId: string | null;
  separationViewed: boolean;
};

export type PrepSecondaryItem = {
  action: PrepSecondaryAction;
  label: string;
  subtitle?: string;
  iconKey: OperationalIconKey;
};

export type PrepFlowView = {
  primaryAction: PrepPrimaryAction;
  primaryLabel: string;
  primaryIconKey: OperationalIconKey;
  secondaryActions: PrepSecondaryItem[];
  statusChip: PrepStatusChip;
  statusChipLabel: string;
  statusHint: string | null;
  prontosParaRota: number;
  precisamEndereco: number;
  hideAddAddressButton: boolean;
  addressCompleteMessage: string | null;
  canGenerateRoute: boolean;
  canGeneratePartialRoute: boolean;
};

const SCAN_ADDRESS_BY_QR_LABEL = "Adicionar endereço por QR Code";
const SCAN_ADDRESS_BY_QR_SUBTITLE = "Leia o QR Code do pacote para preencher o endereço";

function scanLabel(totalPedidos: number): string {
  return totalPedidos === 0 ? "Escanear pacote" : "+ Escanear mais pacote";
}

function missingAddressChipLabel(count: number): string {
  return `${count} pacote${count !== 1 ? "s" : ""} sem endereço`;
}

function buildSecondaries(
  input: PrepFlowInput,
  primary: PrepPrimaryAction,
  canGeneratePartialRoute: boolean
): PrepSecondaryItem[] {
  const items: PrepSecondaryItem[] = [];

  if (
    canGeneratePartialRoute &&
    primary !== "generate_route" &&
    input.activeRouteId == null &&
    input.routeOrderLength === 0
  ) {
    items.push({
      action: "generate_partial_route",
      label: `Gerar rota parcial (${input.withCoordsCount} pacotes)`,
      iconKey: "prepGenerateRoute",
    });
  }

  if (primary !== "scan" && input.totalPedidos > 0 && input.semEndereco > 0) {
    items.push({
      action: "scan_more",
      label: SCAN_ADDRESS_BY_QR_LABEL,
      subtitle: SCAN_ADDRESS_BY_QR_SUBTITLE,
      iconKey: "prepScan",
    });
  }

  if (
    input.semEndereco === 0 &&
    input.routeOrderLength === 0 &&
    input.activeRouteId == null &&
    input.totalPedidos > 0
  ) {
    items.push({
      action: "edit_ordering",
      label: "Editar ordenação",
      iconKey: "prepEditOrder",
    });
  }

  if (input.routeOrderLength > 0 && input.activeRouteId == null && primary !== "separate_packages") {
    items.push({
      action: "open_route_builder",
      label: "Ver rota no mapa",
      iconKey: "prepGenerateRoute",
    });
  }

  return items.slice(0, 3);
}

export function derivePrepFlowView(input: PrepFlowInput): PrepFlowView {
  const {
    totalPedidos,
    comEndereco,
    semEndereco,
    withCoordsCount,
    routeOrderLength,
    activeRouteId,
    separationViewed,
  } = input;

  const hideAddAddressButton = semEndereco === 0;
  const addressCompleteMessage =
    semEndereco === 0 && totalPedidos > 0 ? "Todos os endereços foram informados" : null;
  const canGenerateRoute = withCoordsCount >= 2 && semEndereco === 0 && routeOrderLength === 0;
  const canGeneratePartialRoute =
    withCoordsCount >= 2 && semEndereco > 0 && routeOrderLength === 0 && activeRouteId == null;

  let statusChip: PrepStatusChip = "empty";
  let statusChipLabel = "";
  let statusHint: string | null = null;

  if (activeRouteId != null) {
    statusChip = "route_active";
    statusChipLabel = "Rota em andamento";
  } else if (routeOrderLength > 0) {
    statusChip = "route_ready";
    statusChipLabel = separationViewed ? "Pronto para iniciar" : "Rota gerada — separe os pacotes";
  } else if (totalPedidos === 0) {
    statusChip = "empty";
    statusChipLabel = "Escaneie o primeiro pacote";
  } else if (semEndereco > 0) {
    statusChip = "missing_addresses";
    statusChipLabel = missingAddressChipLabel(semEndereco);
    statusHint = canGeneratePartialRoute
      ? `${semEndereco} pacote${semEndereco !== 1 ? "s" : ""} sem endereço ficarão de fora se gerar rota parcial.`
      : null;
  } else {
    statusChip = "ready";
    statusChipLabel = "Pronto para gerar rota";
  }

  let primaryAction: PrepPrimaryAction;
  let primaryLabel: string;
  let primaryIconKey: OperationalIconKey;

  if (activeRouteId != null) {
    primaryAction = "start_route";
    primaryLabel = "Continuar rota";
    primaryIconKey = "prepStartRoute";
  } else if (totalPedidos === 0) {
    primaryAction = "scan";
    primaryLabel = "Escanear pacote";
    primaryIconKey = "prepScan";
  } else if (semEndereco > 0) {
    primaryAction = "add_address";
    primaryLabel = "Adicionar endereço pendente";
    primaryIconKey = "prepAddAddress";
  } else if (routeOrderLength > 0 && !separationViewed) {
    primaryAction = "separate_packages";
    primaryLabel = "Separar pacotes";
    primaryIconKey = "prepSeparate";
  } else if (routeOrderLength > 0 && separationViewed) {
    primaryAction = "start_route";
    primaryLabel = "Iniciar rota";
    primaryIconKey = "prepStartRoute";
  } else if (canGenerateRoute) {
    primaryAction = "generate_route";
    primaryLabel = "Gerar rota otimizada";
    primaryIconKey = "prepGenerateRoute";
  } else if (semEndereco > 0) {
    primaryAction = "add_address";
    primaryLabel = "Adicionar endereço pendente";
    primaryIconKey = "prepAddAddress";
  } else {
    primaryAction = "scan";
    primaryLabel = scanLabel(totalPedidos);
    primaryIconKey = "prepScan";
  }

  const secondaryActions = buildSecondaries(input, primaryAction, canGeneratePartialRoute);

  return {
    primaryAction,
    primaryLabel,
    primaryIconKey,
    secondaryActions,
    statusChip,
    statusChipLabel,
    statusHint,
    prontosParaRota: comEndereco,
    precisamEndereco: semEndereco,
    hideAddAddressButton,
    addressCompleteMessage,
    canGenerateRoute,
    canGeneratePartialRoute,
  };
}
