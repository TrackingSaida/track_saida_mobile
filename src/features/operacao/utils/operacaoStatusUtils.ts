export function coresBadgeServico(servico?: string | null): { bg: string; fg: string } {
  const s = (servico || "").trim().toLowerCase();
  if (s.includes("shopee")) return { bg: "rgba(238,77,45,0.15)", fg: "#ee4d2d" };
  if (s.includes("mercado") || s.includes("livre")) return { bg: "rgba(255,230,0,0.35)", fg: "#2d3277" };
  return { bg: "rgba(13,110,253,0.12)", fg: "#0d6efd" };
}

/** Formata status para exibição (igual à web: `_` → espaço, UPPERCASE). */
export function formatStatusSaidaLabel(status?: string | null): string {
  if (status == null || status === "") return "—";
  const s = String(status).replace(/_/g, " ").trim();
  const lower = s.toLowerCase();
  if (lower === "encerrado sistema" || lower === "encerrado pelo sistema" || lower === "encerrado") {
    return "Encerrado";
  }
  if (lower === "saiu" || lower === "saiu para entrega") return "SAIU PARA ENTREGA";
  return s.toUpperCase();
}

/** Rótulo curto para avisos operacionais (sem termos internos). */
export function labelStatusOperacional(status?: string | null): string {
  const lower = String(status || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .trim();
  if (!lower) return "status anterior";
  if (lower.includes("cancelad")) return "Cancelado";
  if (lower.includes("entregue")) return "Entregue";
  if (lower.includes("ausente")) return "Ausente";
  if (lower.includes("nao coletado") || lower.includes("não coletado")) return "Não coletado";
  if (lower.includes("coletado")) return "Coletado";
  if (lower.includes("em rota") || lower.includes("saiu")) return "Saiu para entrega";
  if (lower.includes("encerrado")) return "Encerrado";
  if (lower.includes("na base")) return "Na base";
  return formatStatusSaidaLabel(status);
}

export function statusVisualSaida(s?: string | null): { label: string; bg: string; fg: string } {
  const u = (s || "").toLowerCase().replace(/\s+/g, "_");
  if (u === "encerrado_sistema" || u === "encerrado" || (u.includes("encerrado") && u.includes("sistema"))) {
    return {
      label: "Encerrado",
      bg: "rgba(108,117,125,0.2)",
      fg: "#6c757d",
    };
  }
  if (u.includes("cancelad")) {
    return { label: formatStatusSaidaLabel(s || "Cancelado"), bg: "rgba(220,53,69,0.14)", fg: "#dc3545" };
  }
  if (u.includes("entregue")) {
    return { label: formatStatusSaidaLabel(s || "Entregue"), bg: "rgba(25,135,84,0.15)", fg: "#198754" };
  }
  if (u.includes("rota") || u.includes("saiu") || u === "em_rota") {
    return { label: formatStatusSaidaLabel(s || "Em rota"), bg: "rgba(13,110,253,0.12)", fg: "#0d6efd" };
  }
  if (u.includes("nao_coletado") || u.includes("não_coletado")) {
    return { label: formatStatusSaidaLabel(s || "Não coletado"), bg: "rgba(108,117,125,0.2)", fg: "#6c757d" };
  }
  if (u.includes("ausente") || u.includes("erro")) {
    // Ausente alinhado à web (warning/laranja); erro permanece vermelho
    if (u.includes("ausente")) {
      return { label: formatStatusSaidaLabel(s || "Ausente"), bg: "rgba(255,152,0,0.18)", fg: "#ff9800" };
    }
    return { label: formatStatusSaidaLabel(s || "—"), bg: "rgba(220,53,69,0.12)", fg: "#dc3545" };
  }
  return { label: formatStatusSaidaLabel(s || "—"), bg: "rgba(13,110,253,0.10)", fg: "#0d6efd" };
}
