import type { JwtClaims } from "./jwt";

function asRole(role: unknown): number | undefined {
  if (typeof role === "number" && Number.isFinite(role)) return Math.trunc(role);
  if (typeof role === "string" && /^\d+$/.test(role.trim())) return Number(role.trim());
  return undefined;
}

/** Aceita só true explícito (evita string/"false" virar truthy). */
function asExplicitTrue(value: unknown): boolean {
  return value === true || value === 1 || value === "true" || value === "1";
}

/** Motoboy no app mobile (JWT role=4). */
export function isMotoboyRole(role: number | undefined): boolean {
  return asRole(role) === 4;
}

/** Admin, root, operador ou coletador (painel / operação). */
export function isStaffOperacaoRole(role: number | undefined): boolean {
  const r = asRole(role);
  return r === 0 || r === 1 || r === 2 || r === 3;
}

/** Root/Admin no contexto do app (ações sensíveis). */
export function isAdminRole(role: number | undefined): boolean {
  const r = asRole(role);
  return r === 0 || r === 1;
}

/**
 * Leitura de saídas / consulta: staff (0–3) sempre pode na UI; motoboy segue flag do token.
 */
export function effectivePodeLerSaida(claims: JwtClaims | null | undefined): boolean {
  if (!claims) return false;
  const r = asRole(claims.role);
  if (isStaffOperacaoRole(r)) return true;
  if (isMotoboyRole(r)) return asExplicitTrue(claims.pode_ler_saida);
  return asExplicitTrue(claims.pode_ler_saida);
}

/**
 * Leitura de coletas: respeita ignorar_coleta; staff 0–3 com coleta ativa no owner; motoboy segue token.
 */
export function effectivePodeLerColeta(claims: JwtClaims | null | undefined): boolean {
  if (!claims) return false;
  if (claims.ignorar_coleta === true) return false;
  const r = asRole(claims.role);
  if (isStaffOperacaoRole(r)) return true;
  if (isMotoboyRole(r)) return asExplicitTrue(claims.pode_ler_coleta);
  return asExplicitTrue(claims.pode_ler_coleta);
}

/** Digitação manual: nega só com false explícito (default liberado). */
function asDefaultTrue(value: unknown): boolean {
  if (value === false || value === 0 || value === "false" || value === "0") return false;
  return true;
}

/**
 * Digitação manual de código: staff (0–3) sempre pode; motoboy liberado por padrão (opt-out).
 */
export function effectivePodeDigitarCodigoManual(claims: JwtClaims | null | undefined): boolean {
  if (!claims) return false;
  const r = asRole(claims.role);
  if (isStaffOperacaoRole(r)) return true;
  if (isMotoboyRole(r)) return asDefaultTrue(claims.pode_digitar_codigo_manual);
  return false;
}

/** Rótulo curto para exibição (opcional). */
export function staffRoleLabel(role: number | undefined): string {
  switch (asRole(role)) {
    case 0:
      return "Root";
    case 1:
      return "Admin";
    case 2:
      return "Operador";
    case 3:
      return "Coletador";
    default:
      return "Operação";
  }
}
