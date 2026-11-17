/** Busca de pacote: avulso com identificação usa codigo_exibicao; senão codigo interno. */

export type CodigoSearchable = {
  codigo?: string | null;
  codigo_exibicao?: string | null;
};

export function normalizeSearchText(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function digitsOnly(raw: string): string {
  return String(raw || "").replace(/\D/g, "");
}

export function hasFriendlyAvulsoId(item: CodigoSearchable): boolean {
  const label = String(item.codigo_exibicao ?? "").trim();
  if (!label) return false;
  const code = String(item.codigo ?? "").trim();
  if (code && label.toLowerCase() === code.toLowerCase()) return false;
  if (/^avulso-/i.test(label)) return false;
  return true;
}

function labelSegments(label: string): string[] {
  return label
    .split("•")
    .map((s) => s.trim())
    .filter(Boolean);
}

function looksLikeInternalOrMarketplaceCode(raw: string): boolean {
  const u = String(raw || "").trim().toUpperCase();
  if (!u) return false;
  if (u.startsWith("AVULSO-")) return true;
  if (/^BR(\d{13}|\d{12}[A-Z])$/.test(u)) return true;
  if (/^[A-Z0-9-]{8,}$/.test(u) && !u.includes(" ")) return true;
  return false;
}

/** Filtro digitado (contém). */
export function matchesContains(item: CodigoSearchable, query: string): boolean {
  const qNorm = normalizeSearchText(query);
  if (!qNorm) return true;
  const qDigits = digitsOnly(query);
  const code = String(item.codigo ?? "").trim();
  const label = String(item.codigo_exibicao ?? "").trim();

  if (hasFriendlyAvulsoId(item)) {
    const labelNorm = normalizeSearchText(label);
    if (labelNorm.includes(qNorm)) return true;
    if (qDigits.length >= 3) {
      const labelDigits = digitsOnly(label);
      if (labelDigits.includes(qDigits)) return true;
    }
    // QR/código interno ainda encontra o pacote
    if (code && normalizeSearchText(code).includes(qNorm)) return true;
    return false;
  }

  return normalizeSearchText(code).includes(qNorm);
}

/** Submit/scan: exact no rótulo/segmentos/CEP, ou código real. */
export function matchesResolve(item: CodigoSearchable, raw: string): boolean {
  const rawTrim = String(raw || "").trim();
  if (!rawTrim) return false;
  const rawNorm = normalizeSearchText(rawTrim);
  const rawDigits = digitsOnly(rawTrim);
  const code = String(item.codigo ?? "").trim();
  const label = String(item.codigo_exibicao ?? "").trim();
  const codeNorm = normalizeSearchText(code);

  if (codeNorm && codeNorm === rawNorm) return true;

  if (hasFriendlyAvulsoId(item)) {
    const labelNorm = normalizeSearchText(label);
    if (labelNorm === rawNorm) return true;
    for (const seg of labelSegments(label)) {
      if (normalizeSearchText(seg) === rawNorm) return true;
    }
    if (rawDigits.length === 8) {
      const labelDigits = digitsOnly(label);
      if (labelDigits.includes(rawDigits) || rawDigits === labelDigits) return true;
      for (const seg of labelSegments(label)) {
        if (digitsOnly(seg) === rawDigits) return true;
      }
    }
    if (looksLikeInternalOrMarketplaceCode(rawTrim) && codeNorm && codeNorm === rawNorm) {
      return true;
    }
    return false;
  }

  return Boolean(codeNorm && codeNorm === rawNorm);
}

/** Score para busca na rota: exact > prefix > contains (rótulo ou código). */
export function scoreCodigoSearch(item: CodigoSearchable, query: string): number {
  const qNorm = normalizeSearchText(query);
  if (!qNorm) return 0;
  const code = String(item.codigo ?? "").trim();
  const label = hasFriendlyAvulsoId(item) ? String(item.codigo_exibicao ?? "").trim() : "";
  const haystacks = [label, code].filter(Boolean).map(normalizeSearchText);

  for (const h of haystacks) {
    if (h === qNorm) return 100;
  }
  for (const h of haystacks) {
    if (h.startsWith(qNorm)) return 50;
  }
  if (matchesContains(item, query)) return 10;
  return 0;
}
