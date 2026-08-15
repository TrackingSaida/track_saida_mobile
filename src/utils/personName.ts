/** Formatação e ordenação de nomes de pessoa (padrão do sistema). */

const MINOR_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Nome com iniciais maiúsculas (pt-BR); mantém de/da/do em minúsculo. */
export function formatPersonName(raw: string): string {
  const parts = String(raw || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (parts.length === 0) return "";
  return parts
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (index > 0 && MINOR_WORDS.has(lower)) return lower;
      if (lower.length === 0) return lower;
      return lower
        .split("-")
        .map((chunk) =>
          chunk
            ? chunk.charAt(0).toLocaleUpperCase("pt-BR") + chunk.slice(1)
            : chunk
        )
        .join("-");
    })
    .join(" ");
}

export function comparePersonNames(a: string, b: string): number {
  return String(a || "").localeCompare(String(b || ""), "pt-BR", {
    sensitivity: "base",
  });
}

export function sortByPersonName<T>(
  list: T[],
  getName: (item: T) => string = (item) =>
    String((item as { nome?: string }).nome || "")
): T[] {
  return [...list].sort((a, b) => comparePersonNames(getName(a), getName(b)));
}

/** Formata campo `nome` e ordena A→Z. */
export function normalizePersonList<T extends { nome: string }>(list: T[]): T[] {
  return sortByPersonName(
    list.map((item) => ({
      ...item,
      nome: formatPersonName(item.nome || ""),
    }))
  );
}
