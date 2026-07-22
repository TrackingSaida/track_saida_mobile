import type { Ionicons } from "@expo/vector-icons";

export type EventoHistoricoKey =
  | "scan"
  | "lido"
  | "leitura"
  | "em_rota"
  | "saiu"
  | "entregue"
  | "entregue_lote"
  | "ausente"
  | "ausente_lote"
  | "cancelado"
  | "nova_tentativa"
  | "liberacao_ausencias"
  | "coleta"
  | "criado_coleta"
  | "reatribuido"
  | "reatribuicao"
  | "assumir"
  | "assumido"
  | "reatribuido_em_rota"
  | "lancar_avulso"
  | "nova_saida_mesmo_entregador"
  | "desatribuido"
  | "removido_sem_inicio"
  | "endereco_atualizado"
  | "rota_criada"
  | "rota_recalculada"
  | "encerrado_sistema"
  | "rota_cancelada"
  | "unknown";

const LABELS: Partial<Record<EventoHistoricoKey, string>> = {
  scan: "Pedido adicionado",
  lido: "Pedido adicionado",
  leitura: "Pedido adicionado",
  lancar_avulso: "Pedido adicionado",
  em_rota: "Saiu para entrega",
  saiu: "Saiu para entrega",
  entregue: "Entrega realizada",
  entregue_lote: "Entrega realizada",
  ausente: "Destinatário ausente",
  ausente_lote: "Destinatário ausente",
  cancelado: "Pedido cancelado",
  nova_tentativa: "Nova tentativa liberada",
  liberacao_ausencias: "Nova tentativa liberada pela operação",
  coleta: "Pacote coletado",
  criado_coleta: "Pacote coletado",
  reatribuido: "Entregador reatribuído",
  reatribuicao: "Entregador reatribuído",
  assumir: "Entregador reatribuído",
  assumido: "Entregador reatribuído",
  reatribuido_em_rota: "Entregador reatribuído em rota",
  nova_saida_mesmo_entregador: "Nova saída confirmada",
  desatribuido: "Pacote desatribuído",
  removido_sem_inicio: "Removido antes de iniciar rota",
  endereco_atualizado: "Endereço atualizado",
  rota_criada: "Inserido na rota",
  rota_recalculada: "Rota recalculada",
  encerrado_sistema: "Encerrado pelo sistema",
  rota_cancelada: "Rota cancelada",
};

const GREEN_KEYS = new Set<EventoHistoricoKey>([
  "entregue",
  "entregue_lote",
  "coleta",
  "criado_coleta",
]);

const BLUE_KEYS = new Set<EventoHistoricoKey>([
  "scan",
  "lido",
  "leitura",
  "em_rota",
  "lancar_avulso",
  "nova_saida_mesmo_entregador",
]);

const ORANGE_KEYS = new Set<EventoHistoricoKey>(["nova_tentativa", "liberacao_ausencias"]);

const RED_KEYS = new Set<EventoHistoricoKey>([
  "ausente",
  "ausente_lote",
  "cancelado",
]);

export function normalizeEventoKey(evento?: string | null): EventoHistoricoKey {
  const raw = String(evento ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!raw) return "unknown";
  if (raw in LABELS) return raw as EventoHistoricoKey;
  if (raw.includes("encerrado")) return "encerrado_sistema";
  if (raw.includes("entregue")) return "entregue";
  if (raw.includes("ausente")) return "ausente";
  if (raw.includes("cancel")) return "cancelado";
  if (raw.includes("endereco")) return "endereco_atualizado";
  if (raw.includes("recalcul")) return "rota_recalculada";
  if (raw.includes("rota_criada") || raw === "rota_criada") return "rota_criada";
  if (raw === "rota_cancelada" || raw.includes("rota_cancel")) return "rota_cancelada";
  if (raw.includes("rota") || raw === "saiu") return raw === "saiu" ? "saiu" : "em_rota";
  if (raw.includes("scan") || raw.includes("escane")) return "scan";
  if (raw.includes("lido") || raw.includes("leitura")) return "lido";
  if (raw.includes("coleta")) return "coleta";
  if (raw.includes("reatrib")) return "reatribuido";
  return "unknown";
}

export function labelEventoHistorico(evento?: string | null, acaoLabel?: string | null): string {
  const key = normalizeEventoKey(evento);
  const mapped = LABELS[key];
  if (mapped) return mapped;
  const fallback = String(acaoLabel ?? "").trim();
  if (fallback) return fallback;
  const raw = String(evento ?? "").trim();
  if (!raw) return "Movimentação registrada";
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function coresEventoHistorico(evento?: string | null): {
  dot: string;
  text: string;
  tier: "green" | "blue" | "orange" | "red" | "gray";
} {
  const key = normalizeEventoKey(evento);
  if (GREEN_KEYS.has(key)) {
    return { dot: "#198754", text: "#198754", tier: "green" };
  }
  if (BLUE_KEYS.has(key)) {
    return { dot: "#0d6efd", text: "#0d6efd", tier: "blue" };
  }
  if (ORANGE_KEYS.has(key)) {
    return { dot: "#fd7e14", text: "#c45a00", tier: "orange" };
  }
  if (RED_KEYS.has(key)) {
    return { dot: "#dc3545", text: "#dc3545", tier: "red" };
  }
  if (key === "reatribuido" || key === "reatribuicao" || key === "assumir" || key === "reatribuido_em_rota") {
    return { dot: "#6f42c1", text: "#6f42c1", tier: "blue" };
  }
  return { dot: "#6c757d", text: "#495057", tier: "gray" };
}

export function iconEventoHistorico(evento?: string | null): keyof typeof Ionicons.glyphMap {
  const key = normalizeEventoKey(evento);
  switch (key) {
    case "entregue":
    case "entregue_lote":
      return "checkmark-done";
    case "ausente":
    case "ausente_lote":
      return "person-remove-outline";
    case "cancelado":
      return "close-circle";
    case "em_rota":
      return "bicycle";
    case "nova_tentativa":
      return "refresh";
    case "coleta":
    case "criado_coleta":
      return "cube-outline";
    case "scan":
      return "scan-outline";
    case "lido":
    case "leitura":
      return "document-text-outline";
    case "reatribuido":
    case "reatribuicao":
    case "assumir":
    case "reatribuido_em_rota":
      return "swap-horizontal";
    case "lancar_avulso":
      return "layers-outline";
    case "nova_saida_mesmo_entregador":
      return "repeat-outline";
    default:
      return "ellipse";
  }
}

export function formatEventoTimestamp(iso?: string | null): string {
  if (iso == null || String(iso).trim() === "") return "—";
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return "—";
  const data = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const hora = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return `${data} às ${hora}`;
}

export function isEventoEntrega(evento?: string | null): boolean {
  const key = normalizeEventoKey(evento);
  return key === "entregue" || key === "entregue_lote";
}

export function isEventoAusencia(evento?: string | null): boolean {
  const key = normalizeEventoKey(evento);
  return key === "ausente" || key === "ausente_lote";
}

export function isEventoCancelamento(evento?: string | null): boolean {
  return normalizeEventoKey(evento) === "cancelado";
}

export function findLastHistoricoIndexByKeys(
  historico: { evento?: string | null }[],
  matcher: (evento?: string | null) => boolean
): number {
  let last = -1;
  historico.forEach((item, index) => {
    if (matcher(item.evento)) last = index;
  });
  return last;
}
