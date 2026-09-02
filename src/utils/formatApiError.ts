import { isAxiosError } from "axios";

/**
 * Converte um pedaço do corpo de erro (string, objeto com msg/message, etc.) em texto.
 */
function pieceToMessage(d: unknown): string {
  if (d == null) return "";
  if (typeof d === "string") return d.trim();
  if (typeof d === "number" || typeof d === "boolean") return String(d);
  if (Array.isArray(d)) return d.map(pieceToMessage).filter(Boolean).join("; ");
  if (typeof d === "object") {
    const o = d as Record<string, unknown>;
    if (typeof o.mensagem === "string" && o.mensagem.trim()) return o.mensagem.trim();
    if (typeof o.msg === "string" && o.msg.trim()) return o.msg.trim();
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  }
  return "";
}

/**
 * Tenta extrair objeto de detail quando a API (ou proxy) devolve string
 * no formato JSON ou repr Python: {'mensagem': '...', 'pode_ajudar': True}.
 */
export function parseApiDetailObject(detail: unknown): Record<string, unknown> | null {
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    return detail as Record<string, unknown>;
  }
  if (typeof detail !== "string") return null;
  const raw = detail.trim();
  if (!raw) return null;

  const tryParse = (text: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
    return null;
  };

  const asJson = tryParse(raw);
  if (asJson) return asJson;

  // Converte repr Python comum (aspas simples / True / False / None).
  const jsonish = raw
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null")
    .replace(/'/g, '"');
  return tryParse(jsonish);
}

/**
 * Extrai mensagem legível de erros Axios / Error genérico (evita "[object Object]" no Alert).
 */
export function formatApiError(err: unknown, fallback: string): string {
  let out = "";

  if (isAxiosError(err)) {
    const data = err.response?.data;
    if (typeof data === "string" && data.trim()) {
      out = data.trim();
    } else if (data && typeof data === "object") {
      const rec = data as Record<string, unknown>;
      const detail = rec.detail;
      if (typeof detail === "string" && detail.trim()) {
        const parsed = parseApiDetailObject(detail);
        out = parsed ? pieceToMessage(parsed) || detail.trim() : detail.trim();
      } else if (Array.isArray(detail)) {
        out = pieceToMessage(detail);
      } else if (detail != null && typeof detail === "object") {
        out = pieceToMessage(detail);
      }
      if (!out && typeof rec.message === "string" && rec.message.trim()) {
        out = rec.message.trim();
      }
    }
  }

  if (!out && err instanceof Error && err.message.trim()) {
    out = err.message.trim();
  }

  if (!out || out === "[object Object]") return fallback;
  return out;
}
