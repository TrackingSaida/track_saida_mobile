import { CommonActions } from "@react-navigation/native";
import { rootNavigationRef } from "../navigation/rootNavigation";
import type { PhotoResumeItem } from "./photoFlowUtils";

function navigateWhenReady(action: () => void, attempt = 0): void {
  if (rootNavigationRef.isReady()) {
    try {
      action();
    } catch (e) {
      console.warn("[photoDraftResume] navegação falhou", e);
    }
    return;
  }
  if (attempt >= 8) return;
  setTimeout(() => navigateWhenReady(action, attempt + 1), 250);
}

/** Reabre o fluxo da foto pendente após o app ter voltado da Home. */
export function navigateToPhotoDraftResume(item: PhotoResumeItem): void {
  navigateWhenReady(() => {
    if (item.kind === "entregue" || item.kind === "ausente") {
      const idSaida = item.idSaida;
      if (!idSaida) return;
      rootNavigationRef.dispatch(
        CommonActions.navigate({
          name: "Home",
          params: {
            screen: "EntregaDetail",
            params: { idSaida, resumeKind: item.kind },
          },
        })
      );
      return;
    }

    if (item.kind === "devolucao") {
      rootNavigationRef.dispatch(
        CommonActions.navigate({
          name: "Home",
          params: {
            screen: "DevolverPacotes",
            params: { resume: true },
          },
        })
      );
      return;
    }

    if (item.source === "saidas") {
      rootNavigationRef.dispatch(
        CommonActions.navigate({
          name: "Operacao",
          params: {
            screen: "LeituraSaidas",
            params: { resumeAvulso: true },
          },
        })
      );
      return;
    }

    rootNavigationRef.dispatch(
      CommonActions.navigate({
        name: "Home",
        params: {
          screen: "Scan",
          params: { resumeAvulso: true },
        },
      })
    );
  });
}
