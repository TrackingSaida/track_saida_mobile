/** Formatação e ordenação de nomes de motoboy (operação). */

const MINOR_WORDS = new Set(["de", "da", "do", "das", "dos", "e"]);

/** Nome com iniciais maiúsculas (pt-BR); mantém de/da/do em minúsculo. */
export function formatMotoboyNome(raw: string): string {
  const parts = raw.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  return parts
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (index > 0 && MINOR_WORDS.has(lower)) return lower;
      if (lower.length === 0) return lower;
      return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
    })
    .join(" ");
}

export function sortMotoboysByNome<T extends { nome: string }>(list: T[]): T[] {
  return [...list].sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
  );
}

/** Formata nomes e ordena A→Z. */
export function normalizeMotoboyList<T extends { nome: string }>(list: T[]): T[] {
  return sortMotoboysByNome(
    list.map((item) => ({
      ...item,
      nome: formatMotoboyNome(item.nome || ""),
    }))
  );
}
