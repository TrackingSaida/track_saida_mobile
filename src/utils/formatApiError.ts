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
    if (typeof o.msg === "string" && o.msg.trim()) return o.msg.trim();
    if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
  }
  return "";
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
        out = detail.trim();
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
