export function coresBadgeServico(servico?: string | null): { bg: string; fg: string } {
  const s = (servico || "").trim().toLowerCase();
  if (s.includes("shopee")) return { bg: "rgba(238,77,45,0.15)", fg: "#ee4d2d" };
  if (s.includes("mercado") || s.includes("livre")) return { bg: "rgba(255,230,0,0.35)", fg: "#2d3277" };
  return { bg: "rgba(13,110,253,0.12)", fg: "#0d6efd" };
}

export function statusVisualSaida(s?: string | null): { label: string; bg: string; fg: string } {
  const u = (s || "").toLowerCase().replace(/\s+/g, "_");
  if (u.includes("cancelad")) {
    return { label: s || "Cancelado", bg: "rgba(220,53,69,0.14)", fg: "#dc3545" };
  }
  if (u.includes("entregue")) {
    return { label: s || "Entregue", bg: "rgba(25,135,84,0.15)", fg: "#198754" };
  }
  if (u.includes("rota") || u.includes("saiu") || u === "em_rota") {
    return { label: (s || "Em rota").toUpperCase(), bg: "rgba(13,110,253,0.12)", fg: "#0d6efd" };
  }
  if (u.includes("nao_coletado") || u.includes("não_coletado")) {
    return { label: s || "Não coletado", bg: "rgba(108,117,125,0.2)", fg: "#6c757d" };
  }
  if (u.includes("ausente") || u.includes("erro")) {
    return { label: s || "—", bg: "rgba(220,53,69,0.12)", fg: "#dc3545" };
  }
  return { label: (s || "—").toUpperCase(), bg: "rgba(13,110,253,0.10)", fg: "#0d6efd" };
}
