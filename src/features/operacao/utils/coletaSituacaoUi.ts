import type { SituacaoBaseColeta } from "../coletasApi";

export type ColetaStatusFiltro = "pendente" | "em_coleta" | "coletado";

export function hojeOperacaoLocal(): string {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function statusColetaNormalizado(status: SituacaoBaseColeta["status"]): ColetaStatusFiltro {
  return status === "sem_volume" ? "coletado" : status;
}

export function statusColetaLabel(status: SituacaoBaseColeta["status"]): string {
  const normal = statusColetaNormalizado(status);
  if (normal === "em_coleta") return "Em coleta";
  if (normal === "coletado") return "Coletada";
  return "Pendente";
}

export function isColetaPendente(status: SituacaoBaseColeta["status"]): boolean {
  return statusColetaNormalizado(status) === "pendente";
}

export function situacaoColetaBadgeColors(status: SituacaoBaseColeta["status"]): {
  bg: string;
  fg: string;
  border: string;
} {
  const normal = statusColetaNormalizado(status);
  if (normal === "em_coleta") {
    return { bg: "rgba(13,110,253,0.14)", fg: "#0d6efd", border: "rgba(13,110,253,0.35)" };
  }
  if (normal === "coletado") {
    return { bg: "rgba(25,135,84,0.14)", fg: "#198754", border: "rgba(25,135,84,0.35)" };
  }
  return { bg: "rgba(255,193,7,0.18)", fg: "#856404", border: "rgba(218,165,32,0.45)" };
}
