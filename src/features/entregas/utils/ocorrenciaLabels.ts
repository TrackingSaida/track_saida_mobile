/** Rótulos de produto para status AUSENTE (interno) → Ocorrência (UI). */

export const LABEL_OCORRENCIA = "Ocorrência";
export const LABEL_OCORRENCIAS = "Ocorrências";
export const LABEL_OCORRENCIA_UPPER = "OCORRÊNCIA";

/** Aceita rótulo novo e legado durante deploy escalonado. */
export function isOcorrenciaExibicao(exibicao?: string | null): boolean {
  const s = String(exibicao || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return s === "ocorrencia" || s === "ausente";
}

export function labelOcorrenciaExibicao(): string {
  return LABEL_OCORRENCIA;
}
