import type { JwtClaims } from "./jwt";

export type OwnerTipo = "base" | "subbase";

/** Tipo do owner: base = labels Seller; qualquer outro valor = Base. */
export function normalizeTipoOwner(raw: unknown): OwnerTipo {
  const v = String(raw ?? "").trim().toLowerCase();
  return v === "base" ? "base" : "subbase";
}

export function getOwnerTipo(
  user?: Pick<JwtClaims, "tipo_owner"> | Record<string, unknown> | null
): OwnerTipo {
  if (!user) return "subbase";
  const rec = user as Record<string, unknown>;
  return normalizeTipoOwner(rec.tipo_owner ?? rec.tipoOwner);
}

export function isOwnerTipoBase(user?: Pick<JwtClaims, "tipo_owner"> | null): boolean {
  return getOwnerTipo(user) === "base";
}

/** "Seller" quando tipo_owner=base; "Base" quando subbase. */
export function ownerEntityLabel(user?: Pick<JwtClaims, "tipo_owner"> | null): string {
  return isOwnerTipoBase(user) ? "Seller" : "Base";
}

export function ownerEntityLabelLower(user?: Pick<JwtClaims, "tipo_owner"> | null): string {
  return isOwnerTipoBase(user) ? "seller" : "base";
}

export function ownerEntityArticle(user?: Pick<JwtClaims, "tipo_owner"> | null): "o" | "a" {
  return isOwnerTipoBase(user) ? "o" : "a";
}
