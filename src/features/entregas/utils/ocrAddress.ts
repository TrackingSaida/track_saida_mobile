/**
 * Heurística para extrair campos de endereço a partir de linhas de texto (OCR).
 * Foca em templates mais comuns (DANFE/Shopee, Envio Flex) e um fallback baseado em CEP.
 * CEP: 8 dígitos ou 00000-000; estado: 2 letras maiúsculas com contexto; número: número sozinho ou após rua.
 */
import type { AddressFormValues } from "../components/AddressForm";
import { replaceSpokenNumbers } from "./spokenNumbers";

export type ParsedAddress = Partial<AddressFormValues> & {
  rawText?: string;
  confidence?: "high" | "medium" | "low";
};

export type AddressParseDefaults = {
  cidade?: string;
  estado?: string;
};

const CEP_REGEX = /\b(\d{5}-?\d{3})\b/;
const ESTADO_REGEX = /\b([A-Z]{2})\b/;

type ParsedCepInfo = {
  cep: string;
  index: number;
};

type SplitStreetResult = {
  rua: string;
  numero: string;
  afterNumero: string;
};

type CityState = {
  cidade?: string;
  estado?: string;
};

const LOGRADOURO_WORDS = [
  "rua",
  "avenida",
  "av ",
  "av.",
  "travessa",
  "alameda",
  "estrada",
  "rodovia",
  "rod ",
  "r.",
];

function removeDiacritics(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeForMatch(text: string): string {
  const noDiacritics = removeDiacritics(text);
  return noDiacritics.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeCep(cepRaw: string): string {
  const digits = cepRaw.replace(/\D/g, "");
  if (!digits) return "";
  return digits.padStart(8, "0").slice(0, 8);
}

function isNoiseLine(line: string): boolean {
  const normalized = normalizeForMatch(line);
  if (!normalized) return true;

  // Nunca considerar ruído se contiver esses rótulos importantes
  if (
    normalized.includes("cep") ||
    normalized.includes("bairro") ||
    normalized.includes("endereco") ||
    normalized.includes("endere") ||
    normalized.includes("destinat")
  ) {
    return false;
  }

  // Apenas números longos ou código de barras / chave de acesso
  const digitsOnly = line.replace(/\D/g, "");
  const hasLetters = /[a-zA-Z]/.test(line);
  if (!hasLetters && digitsOnly.length >= 10) {
    return true;
  }

  // Linha muito curta
  if (normalized.length < 3) {
    return true;
  }

  // Palavras típicas de ruído em DANFE / etiquetas
  const noiseKeywords = [
    "danfe",
    "nf",
    "nota fiscal",
    "serie",
    "série",
    "emissao",
    "emissão",
    "pedido",
    "remetente",
    "qrcode",
    "pack",
    "envio",
    "entrega",
    "data",
    "chave de acesso",
    "chavedeacesso",
  ];
  for (const word of noiseKeywords) {
    if (normalized.includes(word)) {
      return true;
    }
  }

  // Rodovias tipo BR116 etc.
  if (/br\d{2,}/i.test(normalized)) {
    return true;
  }

  // Linha com pouquíssimas letras em relação a símbolos
  const lettersCount = (line.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const nonSpaceCount = (line.replace(/\s/g, "").match(/./g) || []).length;
  if (lettersCount === 0 && nonSpaceCount > 0) {
    return true;
  }

  return false;
}

function normalizeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const collapsed = trimmed.replace(/\s+/g, " ");
    if (collapsed.length < 3) continue;

    const key = normalizeForMatch(collapsed);
    if (seen.has(key)) continue;
    seen.add(key);

    if (isNoiseLine(collapsed)) continue;

    result.push(collapsed);
  }

  return result;
}

function findFirstCepInRange(lines: string[], start = 0, end = lines.length - 1): ParsedCepInfo | null {
  const finalEnd = Math.min(end, lines.length - 1);
  for (let i = Math.max(0, start); i <= finalEnd; i++) {
    const match = lines[i].match(CEP_REGEX);
    if (match) {
      const cep = normalizeCep(match[1]);
      if (cep) {
        return { cep, index: i };
      }
    }
  }
  return null;
}

function scoreAddressLine(line: string): number {
  let score = 0;
  const normalized = normalizeForMatch(line);

  if (!normalized) return -Infinity;

  // Logradouro
  for (const word of LOGRADOURO_WORDS) {
    if (normalized.includes(word)) {
      score += 3;
      break;
    }
  }

  // Número (não CEP)
  const withoutCep = line.replace(CEP_REGEX, "");
  if (/\b\d{1,5}\b/.test(withoutCep)) {
    score += 3;
  }

  // Vírgula
  if (line.includes(",")) {
    score += 1;
  }

  // Penalizações
  if (isNoiseLine(line)) {
    score -= 5;
  }

  const penaltyKeywords = ["cep", "bairro", "pedido", "nf", "danfe", "remetent"];
  for (const word of penaltyKeywords) {
    if (normalized.includes(word)) {
      score -= 3;
      break;
    }
  }

  // Linha que claramente é CEP
  if (CEP_REGEX.test(line)) {
    score -= 2;
  }

  return score;
}

function pickBestAddressLine(
  lines: string[],
): { line: string; index: number } | null {
  let bestIndex = -1;
  let bestScore = -Infinity;

  lines.forEach((line, index) => {
    const score = scoreAddressLine(line);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  if (bestIndex !== -1 && bestScore >= 3) {
    return { line: lines[bestIndex], index: bestIndex };
  }

  // Tentar combinações de linhas adjacentes
  let combinedBest: { line: string; index: number } | null = null;
  let combinedBestScore = -Infinity;

  for (let i = 0; i < lines.length - 1; i++) {
    const combined = `${lines[i]} ${lines[i + 1]}`;
    const score = scoreAddressLine(combined);
    if (score > combinedBestScore) {
      combinedBestScore = score;
      combinedBest = { line: combined, index: i };
    }
  }

  if (combinedBest && combinedBestScore >= 3) {
    return combinedBest;
  }

  return null;
}

function splitStreetAndNumber(addressLine: string): SplitStreetResult {
  let line = addressLine.trim();

  // Remover rótulo de endereço antes de tudo (Endereço:, Endereco:, etc.)
  const colonIndex = line.indexOf(":");
  if (colonIndex !== -1) {
    const before = line.slice(0, colonIndex);
    const beforeNorm = normalizeForMatch(before);
    if (beforeNorm.includes("endere")) {
      line = line.slice(colonIndex + 1).trim();
    }
  }

  // Remover CEP e palavra CEP da linha para não confundir com número da casa
  line = line.replace(CEP_REGEX, "").replace(/cep[:\s]*/i, "").trim();

  // Encontrar o último número de 1–5 dígitos (provável número da residência)
  const matches = Array.from(line.matchAll(/\b(\d{1,5})\b/g));
  if (matches.length === 0) {
    return {
      rua: line.trim(),
      numero: "",
      afterNumero: "",
    };
  }

  const lastMatch = matches[matches.length - 1];
  const matchIndex = lastMatch.index ?? 0;
  const matchText = lastMatch[0];

  const beforeNumero = line
    .slice(0, matchIndex)
    .replace(/\b(nº|n°|numero|número)\b\.?/gi, "")
    .replace(/[,\s]+$/g, "")
    .trim();
  const afterNumero = line.slice(matchIndex + matchText.length).trim();

  return {
    rua: beforeNumero || line.trim(),
    numero: lastMatch[1],
    afterNumero,
  };
}

function extractCityAndState(fragment: string): CityState {
  const text = fragment.trim();
  if (!text) return {};

  const match = text.match(/([^,-]+)[,-]\s*([A-Z]{2})\s*$/);
  if (match) {
    const uf = match[2].trim();
    if (ESTADO_REGEX.test(uf)) {
      const cidade = match[1].trim();
      return {
        cidade: cidade || undefined,
        estado: uf,
      };
    }
  }

  return {};
}

function isProbableNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.length > 40) return false;
  if (/\d/.test(trimmed)) return false;

  const normalized = normalizeForMatch(trimmed);
  const badKeywords = [
    "rua",
    "avenida",
    "av ",
    "av.",
    "travessa",
    "alameda",
    "estrada",
    "rodovia",
    "cep",
    "bairro",
    "endereco",
    "endere",
    "complem",
  ];
  for (const word of badKeywords) {
    if (normalized.includes(word)) {
      return false;
    }
  }

  return true;
}

function extractDestinatarioAroundAnchor(
  lines: string[],
  anchorIndex: number,
): string | undefined {
  const anchorLine = lines[anchorIndex] ?? "";
  const afterColon = anchorLine.split(":").slice(1).join(":").trim();
  if (afterColon && isProbableNameLine(afterColon)) {
    return afterColon;
  }

  const limit = Math.min(anchorIndex + 5, lines.length - 1);
  for (let i = anchorIndex + 1; i <= limit; i++) {
    const candidate = lines[i].trim();
    if (candidate && isProbableNameLine(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function findFallbackDestinatario(lines: string[]): string | undefined {
  for (const line of lines) {
    if (isProbableNameLine(line)) {
      return line.trim();
    }
  }
  return undefined;
}

function extractBairroFromLine(line: string): string {
  const normalized = normalizeForMatch(line);
  const idx = normalized.indexOf("bairr");
  if (idx === -1) {
    return line.trim();
  }

  const afterLabel = line.slice(idx);
  const colonIndex = afterLabel.indexOf(":");
  if (colonIndex !== -1) {
    return afterLabel.slice(colonIndex + 1).trim();
  }

  // Remove a palavra "bairro" e similares
  return afterLabel.replace(/bairro[:\s]*/i, "").trim();
}

function extractComplementoFromLine(line: string): string {
  const normalized = normalizeForMatch(line);
  const idx = normalized.indexOf("complem");
  if (idx === -1) {
    return line.trim();
  }

  const afterLabel = line.slice(idx);
  const colonIndex = afterLabel.indexOf(":");
  if (colonIndex !== -1) {
    return afterLabel.slice(colonIndex + 1).trim();
  }

  return afterLabel.replace(/complemento[:\s]*/i, "").trim();
}

export function parseOcrToAddress(lines: string[]): Partial<AddressFormValues> {
  const normalizedLines = normalizeLines(lines);
  const result: Partial<AddressFormValues> = {
    complemento: "",
  };

  if (normalizedLines.length === 0) {
    return result;
  }

  const globalCepInfo = findFirstCepInRange(normalizedLines);

  const destAnchorIndex = normalizedLines.findIndex((line) =>
    normalizeForMatch(line).includes("destinat"),
  );
  const hasDestAnchor = destAnchorIndex >= 0;

  const endAnchorIndex = normalizedLines.findIndex((line) =>
    normalizeForMatch(line).includes("endere"),
  );
  const hasEndAnchor = endAnchorIndex >= 0;

  // TEMPLATE 1 – DANFE/Shopee (DESTINAT)
  if (hasDestAnchor) {
    const start = destAnchorIndex;
    const end = Math.min(destAnchorIndex + 10, normalizedLines.length - 1);

    const destinatario = extractDestinatarioAroundAnchor(
      normalizedLines,
      destAnchorIndex,
    );
    if (destinatario) {
      result.destinatario = destinatario;
    }

    const cepInfo = findFirstCepInRange(normalizedLines, start, end);
    if (cepInfo) {
      result.cep = cepInfo.cep;
    }

    for (let i = start; i <= end; i++) {
      const line = normalizedLines[i];
      if (normalizeForMatch(line).includes("bairr")) {
        const bairro = extractBairroFromLine(line);
        if (bairro) {
          result.bairro = bairro;
          break;
        }
      }
    }

    const windowLines = normalizedLines.slice(start + 1, end + 1);
    const addressCandidate = pickBestAddressLine(windowLines);
    if (addressCandidate) {
      const { rua, numero, afterNumero } = splitStreetAndNumber(
        addressCandidate.line,
      );
      if (rua) result.rua = rua;
      if (numero) result.numero = numero;

      const cityState = extractCityAndState(afterNumero || addressCandidate.line);
      if (cityState.cidade) result.cidade = cityState.cidade;
      if (cityState.estado) result.estado = cityState.estado;
    }
  }

  // TEMPLATE 2 – Envio Flex (ENDERE)
  if (hasEndAnchor) {
    const start = endAnchorIndex;
    const end = Math.min(endAnchorIndex + 12, normalizedLines.length - 1);

    const anchorLine = normalizedLines[endAnchorIndex];
    let enderecoValue = anchorLine;
    const colonIndex = enderecoValue.indexOf(":");
    if (colonIndex !== -1) {
      enderecoValue = enderecoValue.slice(colonIndex + 1).trim();
    }

    const enderecoNorm = normalizeForMatch(enderecoValue);
    if (enderecoNorm.startsWith("endereco")) {
      enderecoValue = enderecoValue.slice(enderecoValue.indexOf(" ") + 1).trim();
    }

    const { rua, numero, afterNumero } = splitStreetAndNumber(enderecoValue);
    if (rua && !result.rua) result.rua = rua;
    if (numero && !result.numero) result.numero = numero;

    const cityState = extractCityAndState(afterNumero || enderecoValue);
    if (cityState.cidade && !result.cidade) result.cidade = cityState.cidade;
    if (cityState.estado && !result.estado) result.estado = cityState.estado;

    const cepInfo = findFirstCepInRange(normalizedLines, start, end);
    if (cepInfo && !result.cep) {
      result.cep = cepInfo.cep;
    }

    for (let i = start; i <= end; i++) {
      const line = normalizedLines[i];
      const norm = normalizeForMatch(line);
      if (!result.bairro && norm.includes("bairr")) {
        const bairro = extractBairroFromLine(line);
        if (bairro) {
          result.bairro = bairro;
        }
      }

      if (!result.complemento && norm.includes("complem")) {
        const complemento = extractComplementoFromLine(line);
        if (complemento) {
          result.complemento = complemento;
        }
      }
    }

    if (!result.destinatario) {
      let destIndex = normalizedLines.findIndex((line) =>
        normalizeForMatch(line).includes("destinat"),
      );
      if (destIndex === -1) {
        const windowLines = normalizedLines.slice(start, end + 1);
        destIndex = windowLines.findIndex((line) =>
          normalizeForMatch(line).includes("destinat"),
        );
        if (destIndex !== -1) {
          destIndex += start;
        }
      }

      if (destIndex !== -1) {
        const destinatario = extractDestinatarioAroundAnchor(
          normalizedLines,
          destIndex,
        );
        if (destinatario) {
          result.destinatario = destinatario;
        }
      }
    }
  }

  // Fallback CEP-first (sem âncoras)
  if (!hasDestAnchor && !hasEndAnchor && globalCepInfo) {
    const cepIndex = globalCepInfo.index;
    const start = Math.max(0, cepIndex - 3);
    const end = Math.min(normalizedLines.length - 1, cepIndex + 4);

    const windowLines = normalizedLines.slice(start, end + 1);
    const addressCandidate = pickBestAddressLine(windowLines);
    if (addressCandidate) {
      const { rua, numero, afterNumero } = splitStreetAndNumber(
        addressCandidate.line,
      );
      if (rua && !result.rua) result.rua = rua;
      if (numero && !result.numero) result.numero = numero;

      const cityState = extractCityAndState(afterNumero || addressCandidate.line);
      if (cityState.cidade && !result.cidade) result.cidade = cityState.cidade;
      if (cityState.estado && !result.estado) result.estado = cityState.estado;
    }

    for (let i = start; i <= end; i++) {
      const line = normalizedLines[i];
      if (!result.bairro && normalizeForMatch(line).includes("bairr")) {
        const bairro = extractBairroFromLine(line);
        if (bairro) {
          result.bairro = bairro;
          break;
        }
      }
    }

    if (!result.destinatario) {
      const destinatario = findFallbackDestinatario(normalizedLines);
      if (destinatario) {
        result.destinatario = destinatario;
      }
    }
  }

  // Garantir CEP normalizado mesmo que venha apenas do global
  if (!result.cep && globalCepInfo) {
    result.cep = globalCepInfo.cep;
  }

  // Destinatário de fallback se até aqui não encontrou
  if (!result.destinatario) {
    const destinatario = findFallbackDestinatario(normalizedLines);
    if (destinatario) {
      result.destinatario = destinatario;
    }
  }

  return result;
}

function scoreParsedAddress(p: Partial<AddressFormValues>): number {
  let score = 0;
  if ((p.rua ?? "").trim()) score += 3;
  if ((p.numero ?? "").trim()) score += 2;
  if ((p.cidade ?? "").trim()) score += 2;
  if ((p.estado ?? "").trim()) score += 1;
  if ((p.cep ?? "").replace(/\D/g, "").length === 8) score += 2;
  if ((p.bairro ?? "").trim()) score += 1;
  return score;
}

function applyParseDefaults(
  parsed: Partial<AddressFormValues>,
  defaults?: AddressParseDefaults
): Partial<AddressFormValues> {
  const result = { ...parsed };
  if (!result.cidade?.trim() && defaults?.cidade) result.cidade = defaults.cidade;
  if (!result.estado?.trim() && defaults?.estado) result.estado = defaults.estado;
  return result;
}

/** Texto livre: "Rua Dona Flor 123 Jandira" → campos estruturados. */
export function parseFreeTextAddress(
  text: string,
  defaults?: AddressParseDefaults
): ParsedAddress {
  const rawText = text.trim();
  if (!rawText) return { rawText, confidence: "low" };

  const normalized = rawText
    .replace(/\s+número\s+/gi, " ")
    .replace(/\s+nº\s+/gi, " ")
    .replace(/\s+no\s+/gi, " ")
    .trim();

  const lines = normalized
    .split(/[,;]|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  let parsed = parseOcrToAddress(lines.length > 0 ? lines : [normalized]);

  if (normalized.length > 5) {
    const cepMatch = normalized.match(/\b(\d{5}-?\d{3})\b/);
    const withoutCep = cepMatch
      ? normalized.replace(cepMatch[0], "").trim()
      : normalized;

    if (!(parsed.rua ?? "").trim()) {
      const numMatch = withoutCep.match(/^(.*?)[\s,]+(\d+[a-zA-Z]?)(?:\s+(.+))?$/);
      if (numMatch) {
        parsed = {
          ...parsed,
          rua: numMatch[1].trim(),
          numero: numMatch[2],
          cidade: numMatch[3]?.trim() || parsed.cidade,
          cep: cepMatch ? normalizeCep(cepMatch[1]) : parsed.cep,
        };
      } else {
        parsed = { ...parsed, rua: withoutCep };
      }
    } else if (!(parsed.numero ?? "").trim()) {
      const { rua, numero, afterNumero } = splitStreetAndNumber(
        (parsed.rua ?? "").trim() || withoutCep
      );
      if (rua) parsed.rua = rua;
      if (numero) parsed.numero = numero;
      if (!(parsed.cidade ?? "").trim() && afterNumero) {
        const cityState = extractCityAndState(afterNumero);
        if (cityState.cidade) parsed.cidade = cityState.cidade;
        if (cityState.estado) parsed.estado = cityState.estado;
      }
    }
  }

  parsed = applyParseDefaults(parsed, defaults);
  const score = scoreParsedAddress(parsed);
  const confidence: ParsedAddress["confidence"] =
    score >= 6 ? "high" : score >= 4 ? "medium" : "low";

  return { ...parsed, rawText, confidence };
}

/** Voz inteligente com números por extenso e inferência de cidade. */
export function parseVoiceAddress(
  transcript: string,
  defaults?: AddressParseDefaults
): ParsedAddress {
  let text = transcript.trim();
  if (!text) return { rawText: text, confidence: "low" };

  text = text
    .replace(/\b(s\s*p|são paulo)\b/gi, " São Paulo SP ")
    .replace(/\b(numero|número|nº)\s+/gi, " ")
    .replace(/\b(eh|tipo|então|entao|ah)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  text = replaceSpokenNumbers(text);

  let parsed = parseFreeTextAddress(text, defaults);

  const words = text.split(/\s+/);
  if (!(parsed.cidade ?? "").trim() && words.length >= 2) {
    const last = words[words.length - 1];
    const secondLast = words[words.length - 2];
    if (/^[A-Z]{2}$/i.test(last) && secondLast.length > 2) {
      parsed = {
        ...parsed,
        cidade: secondLast.charAt(0).toUpperCase() + secondLast.slice(1).toLowerCase(),
        estado: last.toUpperCase(),
      };
    } else if (last.length > 3 && !/^\d+$/.test(last)) {
      parsed = {
        ...parsed,
        cidade: last.charAt(0).toUpperCase() + last.slice(1).toLowerCase(),
      };
    }
  }

  parsed = applyParseDefaults(parsed, defaults);
  const score = scoreParsedAddress(parsed);
  const confidence: ParsedAddress["confidence"] =
    score >= 6 ? "high" : score >= 4 ? "medium" : "low";

  return { ...parsed, rawText: transcript, confidence };
}

/** Escolhe o melhor candidato OCR por completude. */
export function pickBestOcrAddress(
  lines: string[]
): ParsedAddress {
  const parsed = parseOcrToAddress(lines);
  const score = scoreParsedAddress(parsed);
  const confidence: ParsedAddress["confidence"] =
    score >= 6 ? "high" : score >= 4 ? "medium" : "low";
  return {
    ...parsed,
    rawText: lines.join("\n"),
    confidence,
  };
}

/** Converte ParsedAddress para AddressFormValues (campos vazios como string). */
export function parsedToFormValues(p: ParsedAddress): AddressFormValues {
  return {
    destinatario: p.destinatario ?? "",
    rua: p.rua ?? "",
    numero: p.numero ?? "",
    complemento: p.complemento ?? "",
    bairro: p.bairro ?? "",
    cidade: p.cidade ?? "",
    estado: p.estado ?? "",
    cep: p.cep ?? "",
  };
}

/** Para voz: uma única string é quebrada em "linhas" por vírgula, ponto ou "número". */
export function parseVoiceToAddress(text: string): Partial<AddressFormValues> {
  const normalized = text.replace(/\s+número\s+/gi, ", ").replace(/\s+nº\s+/gi, ", ");
  const lines = normalized
    .split(/[,.]|\s+-\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parseOcrToAddress(lines);
}

/** Detecta múltiplos endereços na transcrição de voz. */
export function parseVoiceToAddresses(text: string): Partial<AddressFormValues>[] {
  const segments = text
    .split(/\b(próximo|proximo|seguinte|depois|agora)\b|[\n;]+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
  if (segments.length <= 1) {
    const single = parseVoiceToAddress(text);
    const hasContent = Boolean(
      (single.rua ?? "").trim() || (single.cep ?? "").replace(/\D/g, "").length === 8
    );
    return hasContent ? [single] : [];
  }
  return segments
    .map((seg) => parseVoiceToAddress(seg))
    .filter(
      (addr) =>
        Boolean((addr.rua ?? "").trim()) ||
        (addr.cep ?? "").replace(/\D/g, "").length === 8
    );
}

/**
 * Exemplos de casos de teste manuais (arrays de linhas):
 *
 * 1) DANFE / Shopee (DESTINATARIO)
 *
 * const exemploDanfe = [
 *   "DANFE SIMPLIFICADO",
 *   "DESTINATÁRIO",
 *   "Fulano de Tal",
 *   "Rua Duarte da Costa, 102, Barueri, SP",
 *   "Bairro: Jardim Belval",
 *   "CEP 06462-120",
 * ];
 *
 * 2) Envio Flex (Endereço / Bairro / Destinatário / CEP sem hífen)
 *
 * const exemploEnvioFlex = [
 *   "Envio Flex",
 *   "Endereço: Rua Dom Feliciano 79",
 *   "Bairro: Centro",
 *   "Complemento: Apto 32",
 *   "Destinatário: Sicrano da Silva",
 *   "CEP 06462120",
 * ];
 *
 * 3) Fallback CEP-first (CEP no meio e rua próxima)
 *
 * const exemploFallback = [
 *   "Pedido 123456",
 *   "Rua das Palmeiras, 45",
 *   "CEP 06462-120",
 *   "Barueri, SP",
 * ];
 */
