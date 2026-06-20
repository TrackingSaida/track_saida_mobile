import type { HomeCtaAction } from "../features/home/utils/homeOperationalState";

export const operationalIcons = {
  routeActive: "navigate-circle-outline",
  packagesWaiting: "file-tray-stacked-outline",
  readyToScan: "scan-circle-outline",
  continueRoute: "navigate-outline",
  prepareRoute: "map-outline",
  scanPackages: "scan-outline",
  scanInsert: "cube-outline",
  scanDeliver: "checkmark-circle-outline",
  locatePackage: "search-outline",
  pendingList: "list-outline",
  delivered: "checkmark-circle-outline",
  absent: "alert-circle-outline",
  addressWarning: "warning-outline",
  summaryPending: "cube-outline",
  summaryFinished: "checkmark-circle-outline",
  summaryAbsent: "alert-circle-outline",
  summaryDelayed: "timer-outline",
  prepScan: "scan-outline",
  prepAddAddress: "location-outline",
  prepGenerateRoute: "map-outline",
  prepSeparate: "file-tray-stacked-outline",
  prepStartRoute: "navigate-outline",
  prepEditOrder: "list-outline",
} as const;

export type OperationalIconKey = keyof typeof operationalIcons;

export function ctaActionToIcon(action: HomeCtaAction): OperationalIconKey | null {
  switch (action) {
    case "continue_route":
      return "continueRoute";
    case "prepare_route":
    case "edit_route":
      return "prepareRoute";
    case "start_route":
      return "continueRoute";
    case "scan":
    case "scan_insert":
      return "scanInsert";
    case "scan_deliver":
      return "scanDeliver";
    case "locate_package":
      return "locatePackage";
    case "view_pending":
      return "pendingList";
    case "view_summary":
      return "delivered";
    case "route_history":
      return "pendingList";
    default:
      return null;
  }
}
