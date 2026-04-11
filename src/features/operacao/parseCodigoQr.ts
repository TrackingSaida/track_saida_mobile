/**
 * Normalização de payload de QR/código (ML JSON, external_order_id, Shopee BR, etc.)
 * alinhada à leitura de coleta — reutilizada em consulta e leitura de saídas (operador/admin).
 */

export type ParseCodigoQrResult = {
  codigo: string;
  qr_payload_raw?: string;
  /** "estruturado" = reconhecemos um padrão de marketplace; "fallback" = usamos o texto bruto. */
  fonte: "estruturado" | "fallback";
};

function toAsciiDigits(s: string): string {
  if (!s) return "";
  const sup: Record<string, string> = {
    "⁰": "0",
    "¹": "1",
    "²": "2",
    "³": "3",
    "⁴": "4",
    "⁵": "5",
    "⁶": "6",
    "⁷": "7",
    "⁸": "8",
    "⁹": "9",
  };
  let out = String(s).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (d) => sup[d] ?? d);
  out = out.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xff10 + 0x30));
  return out;
}

function isCodigoShopee(codigo: string): boolean {
  if (!codigo || typeof codigo !== "string") return false;
  const c = String(codigo).toUpperCase().trim();
  return /^BR(\d{13}|\d{12}[A-Z])$/.test(c);
}

/** Igual ao painel web (`classifyCodigo`): só aceita padrões de envio conhecidos; rejeita fallback e lixo (URLs, NF-e). */
export type ClassifyCodigoOperacaoResult =
  | { ok: true; codigo: string; servico: string; qr_payload_raw?: string }
  | { ok: false; motivo: string };

export function classifyCodigoParaOperacao(rawInput: string): ClassifyCodigoOperacaoResult {
  const rawInputStr = String(rawInput || "").trim();
  if (!rawInputStr) {
    return { ok: false, motivo: "Informe um código." };
  }

  const allDigits = toAsciiDigits(rawInputStr).replace(/\D+/g, "");
  if (/^\d{44}$/.test(allDigits)) {
    return { ok: false, motivo: "NF-e (44 dígitos) — use o código da etiqueta do envio." };
  }

  if (/^(https?|exp|expo|data):/i.test(rawInputStr)) {
    return { ok: false, motivo: "Link ou QR de sistema não é código de envio." };
  }

  const p = parseCodigoQrRaw(rawInputStr);
  if (p.fonte === "fallback") {
    return { ok: false, motivo: "Código não reconhecido. Use etiqueta Shopee, Mercado Livre ou avulso válido." };
  }

  const codigo = p.codigo.trim();
  if (!codigo) {
    return { ok: false, motivo: "Código vazio após leitura." };
  }

  let servico: string;
  if (p.qr_payload_raw) {
    servico = "Mercado Livre";
  } else if (isCodigoShopee(codigo)) {
    servico = "Shopee";
  } else {
    servico = inferServicoSaida(codigo);
  }

  return {
    ok: true,
    codigo,
    servico,
    ...(p.qr_payload_raw ? { qr_payload_raw: p.qr_payload_raw } : {}),
  };
}

/** Heurística para POST /saidas/ler (campo servico). */
export function inferServicoSaida(codigo: string): string {
  const c = codigo.trim().toUpperCase();
  if (c.startsWith("BR")) return "Shopee";
  if (/^\d{10,}$/.test(codigo.trim())) return "Mercado Livre";
  return "Avulso";
}

/**
 * Extrai o código de rastreio e opcionalmente o payload ML bruto.
 * Se nenhum padrão conhecido for encontrado, devolve `fonte: "fallback"` com o texto trimado.
 */
export function parseCodigoQrRaw(rawInput: string): ParseCodigoQrResult {
  const rawInputStr = String(rawInput || "").trim();
  if (!rawInputStr) return { codigo: "", fonte: "fallback" };

  try {
    if (rawInputStr.startsWith("{") && rawInputStr.trim().endsWith("}")) {
      const obj = JSON.parse(rawInputStr) as { id?: string; sender_id?: unknown; hash_code?: unknown };
      if (typeof obj.id === "string" && (obj.sender_id != null || obj.hash_code != null)) {
        const codigo = String(obj.id).trim();
        return { codigo, qr_payload_raw: rawInputStr, fonte: "estruturado" };
      }
    }
  } catch {
    /* ignore */
  }

  const raw = toAsciiDigits(rawInputStr).toUpperCase().trim();
  const allDigits = raw.replace(/\D+/g, "");

  try {
    if (raw.startsWith("{") && raw.endsWith("}")) {
      const obj = JSON.parse(raw) as { external_order_id?: string };
      if (typeof obj.external_order_id === "string") {
        const codigo = obj.external_order_id.toUpperCase().trim();
        return { codigo, fonte: "estruturado" };
      }
    }
  } catch {
    /* ignore */
  }

  const extMatch = raw.match(/external_order_id["']?\s*[:=]\s*["']?([\w-]+)/i);
  if (extMatch) {
    return { codigo: extMatch[1].toUpperCase(), fonte: "estruturado" };
  }

  const magaluMatch = raw.match(/external_grouper_code\^Ç\^(\d{10,})\^/i);
  if (magaluMatch) {
    return { codigo: magaluMatch[1], fonte: "estruturado" };
  }

  if (/^LM[\w\d-]+$/i.test(raw)) {
    return { codigo: raw, fonte: "estruturado" };
  }

  const sh = raw.match(/(?:^|[^A-Z0-9])(BR(?:\d{13}|\d{12}[A-Z]))(?=$|[^A-Z0-9])/i);
  if (sh) {
    return { codigo: sh[1].toUpperCase(), fonte: "estruturado" };
  }

  const mlRun = allDigits.match(/4[5-9]\d{9,}/);
  if (mlRun) {
    return {
      codigo: mlRun[0].slice(0, 11),
      qr_payload_raw: rawInputStr,
      fonte: "estruturado",
    };
  }

  if (/^\d{8}$/.test(allDigits)) {
    return { codigo: allDigits, fonte: "estruturado" };
  }

  if (/^\d{7}$/.test(allDigits)) {
    return { codigo: allDigits, fonte: "estruturado" };
  }

  if (/^CP\d{3,}/.test(raw) || /^TIME\d{6}$/i.test(raw)) {
    return { codigo: raw, fonte: "estruturado" };
  }

  const phone = raw.match(/0?(\d{2})[-\s]?(\d{4,5})[-\s]?(\d{4})/);
  if (phone) {
    const cod = `${phone[1]}${phone[2]}${phone[3]}`;
    return { codigo: cod, fonte: "estruturado" };
  }

  return { codigo: rawInputStr, fonte: "fallback" };
}

export { toAsciiDigits, isCodigoShopee };
