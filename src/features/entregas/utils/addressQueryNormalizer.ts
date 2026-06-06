/** Normalização de query de endereço (espelho do backend). */

import { normalizeOcrText } from "./ocrTextFix";
import { replaceSpokenNumbers } from "./spokenNumbers";

export type AddressInputSource = "text" | "ocr" | "voice";

/** Pipeline unificado antes do parse/busca: OCR fix → voz → (query norm na API). */
export function preprocessAddressInput(text: string, source: AddressInputSource = "text"): string {
  let out = (text || "").trim();
  if (!out) return "";
  if (source === "ocr" || source === "voice") {
    out = normalizeOcrText(out);
  }
  if (source === "voice") {
    out = replaceSpokenNumbers(out);
  }
  return out;
}

const ABBREV: Array<[RegExp, string]> = [
  [/^r\.?\s+/i, "Rua "],
  [/^rua\s+/i, "Rua "],
  [/^av\.?\s+/i, "Avenida "],
  [/^avenida\s+/i, "Avenida "],
  [/^al\.?\s+/i, "Alameda "],
  [/^alameda\s+/i, "Alameda "],
  [/^rod\.?\s+/i, "Rodovia "],
  [/^rodovia\s+/i, "Rodovia "],
  [/^tv\.?\s+/i, "Travessa "],
  [/^trav\.?\s+/i, "Travessa "],
  [/^travessa\s+/i, "Travessa "],
];

const ESTADO_NOME_TO_UF: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  goias: "GO",
  maranhao: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  paraiba: "PB",
  parana: "PR",
  pernambuco: "PE",
  piaui: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

function stripAccents(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Converte nome completo ou ISO BR-XX para sigla UF (evita slice(0,2) em 'São Paulo' → 'SÃ'). */
export function normalizeEstadoUf(estado?: string, iso3166?: string): string {
  if (iso3166) {
    const iso = iso3166.trim().toUpperCase();
    if (iso.startsWith("BR-") && iso.length >= 5) return iso.slice(3, 5);
    if (iso.length === 2 && /^[A-Z]{2}$/.test(iso)) return iso;
  }
  const raw = (estado ?? "").trim();
  if (!raw) return "";
  const compact = raw.replace(/\s+/g, "").toUpperCase();
  if (compact.length === 2 && /^[A-Z]{2}$/.test(compact)) return compact;
  const key = stripAccents(raw).toLowerCase();
  return ESTADO_NOME_TO_UF[key] ?? "";
}

export function normalizeAddressQuery(query: string): string {
  const q = (query || "").trim();
  if (!q) return "";
  const lower = q.toLowerCase();
  for (const [pattern, replacement] of ABBREV) {
    if (pattern.test(lower)) {
      const rest = lower.replace(pattern, "").trim();
      const titleRest = rest
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return `${replacement.trim()} ${titleRest}`.trim();
    }
  }
  return q
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
