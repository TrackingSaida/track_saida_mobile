import type { SituacaoBaseColeta } from "../coletasApi";

/** Status visíveis no seletor de coleta (PRD-003: Sem volume é próprio). */
export type ColetaStatusFiltro = "pendente" | "em_coleta" | "sem_volume" | "coletado";

export type SituacaoStatusRef = Pick<SituacaoBaseColeta, "status"> | null | undefined;

export type BaseSeletorItem<T extends { id_base: number; base: string }> = T & {
  statusSeletor: ColetaStatusFiltro;
};

export function hojeOperacaoLocal(): string {
  const data = new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

/** Ontem no fuso local do aparelho (YYYY-MM-DD). */
export function ontemOperacaoLocal(): string {
  const data = new Date();
  data.setDate(data.getDate() - 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function statusColetaNormalizado(status: SituacaoBaseColeta["status"]): ColetaStatusFiltro {
  if (status === "em_coleta") return "em_coleta";
  if (status === "sem_volume") return "sem_volume";
  if (status === "coletado") return "coletado";
  return "pendente";
}

export function statusColetaLabel(status: SituacaoBaseColeta["status"]): string {
  const normal = statusColetaNormalizado(status);
  if (normal === "em_coleta") return "Em coleta";
  if (normal === "sem_volume") return "Sem volume";
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
  if (normal === "sem_volume") {
    return { bg: "rgba(108,117,125,0.18)", fg: "#adb5bd", border: "rgba(108,117,125,0.45)" };
  }
  if (normal === "coletado") {
    return { bg: "rgba(25,135,84,0.14)", fg: "#198754", border: "rgba(25,135,84,0.35)" };
  }
  return { bg: "rgba(255,193,7,0.18)", fg: "#856404", border: "rgba(218,165,32,0.45)" };
}

/** Sem situação carregada = ainda pendente no seletor operacional. */
export function statusSeletorDeSituacao(situacao?: SituacaoStatusRef): ColetaStatusFiltro {
  if (!situacao?.status) return "pendente";
  return statusColetaNormalizado(situacao.status);
}

/**
 * Lista do seletor de coleta (estilo web): todas as bases/sellers,
 * pendentes → em coleta → sem volume → coletadas; A–Z dentro de cada grupo.
 */
export function basesParaSeletorColeta<T extends { id_base: number; base: string }>(
  bases: T[],
  situacaoPorBaseId: Record<number, SituacaoStatusRef>,
  situacaoPorNome: Record<string, SituacaoStatusRef>,
  _selecionadaNome?: string | null
): BaseSeletorItem<T>[] {
  const rank = (status: ColetaStatusFiltro) => {
    if (status === "pendente") return 0;
    if (status === "em_coleta") return 1;
    if (status === "sem_volume") return 2;
    return 3;
  };

  return bases
    .map((item) => {
      const situacao = situacaoPorBaseId[item.id_base] || situacaoPorNome[item.base];
      const statusSeletor = statusSeletorDeSituacao(situacao);
      return { ...item, statusSeletor };
    })
    .sort((a, b) => {
      const byStatus = rank(a.statusSeletor) - rank(b.statusSeletor);
      if (byStatus !== 0) return byStatus;
      return a.base.localeCompare(b.base, "pt-BR", { sensitivity: "base" });
    });
}

export function labelGrupoSeletorColeta(status: ColetaStatusFiltro): string {
  if (status === "em_coleta") return "Em coleta";
  if (status === "sem_volume") return "Sem volume";
  if (status === "coletado") return "Coletadas";
  return "Pendentes";
}
