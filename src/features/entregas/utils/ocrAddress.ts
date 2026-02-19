/**
 * Heurística para extrair campos de endereço a partir de linhas de texto (OCR).
 * CEP: 8 dígitos ou 00000-000; estado: 2 letras maiúsculas; número: número sozinho ou após rua.
 */
import type { AddressFormValues } from "../components/AddressForm";

const CEP_REGEX = /\b(\d{5}-?\d{3})\b/;
const ESTADO_REGEX = /\b([A-Z]{2})\b/;
const NUMERO_REGEX = /(\d+)(?:\s|,|$)/;

export function parseOcrToAddress(lines: string[]): Partial<AddressFormValues> {
  const fullText = lines.join(" \n ");
  const result: Partial<AddressFormValues> = {};

  const cepMatch = fullText.match(CEP_REGEX);
  if (cepMatch) result.cep = cepMatch[1].replace(/\D/g, "").padStart(8, "0").slice(0, 8);

  const estadoMatch = fullText.match(ESTADO_REGEX);
  if (estadoMatch) result.estado = estadoMatch[1];

  const parts: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (t.length > 1) parts.push(t);
  }

  if (parts.length > 0) result.destinatario = parts[0];

  let rua = "";
  let numero = "";
  let bairro = "";
  let cidade = "";

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i];
    const numInLine = p.match(NUMERO_REGEX);
    if (numInLine && !numero && p.length < 30) {
      numero = numInLine[1];
      rua = p.replace(NUMERO_REGEX, "").replace(/[,.]/g, "").trim();
      if (!rua && i > 1) rua = parts[i - 1];
    } else if (!rua && p.length > 3 && !CEP_REGEX.test(p) && !/^\d+$/.test(p)) {
      rua = p;
    } else if (rua && !bairro && p.length > 2 && !CEP_REGEX.test(p)) {
      bairro = p;
    } else if (bairro && !cidade && p.length > 2) {
      cidade = p;
    }
  }

  if (rua) result.rua = rua;
  if (numero) result.numero = numero;
  if (bairro) result.bairro = bairro;
  if (cidade) result.cidade = cidade;
  result.complemento = "";

  return result;
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
