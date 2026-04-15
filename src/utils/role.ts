import type { JwtClaims } from "./jwt";

/** Motoboy no app mobile (JWT role=4). */
export function isMotoboyRole(role: number | undefined): boolean {
  return role === 4;
}

/** Admin, root, operador ou coletador (painel / operação). */
export function isStaffOperacaoRole(role: number | undefined): boolean {
  return role === 0 || role === 1 || role === 2 || role === 3;
}

/** Root/Admin no contexto do app (ações sensíveis). */
export function isAdminRole(role: number | undefined): boolean {
  return role === 0 || role === 1;
}

/**
 * Leitura de saídas / consulta: staff (0–3) sempre pode na UI; motoboy segue flag do token.
 */
export function effectivePodeLerSaida(claims: JwtClaims | null | undefined): boolean {
  const r = claims?.role;
  if (isStaffOperacaoRole(r)) return true;
  if (isMotoboyRole(r)) return Boolean(claims?.pode_ler_saida);
  return Boolean(claims?.pode_ler_saida);
}

/**
 * Leitura de coletas: respeita ignorar_coleta; staff 0–3 com coleta ativa no owner; motoboy segue token.
 */
export function effectivePodeLerColeta(claims: JwtClaims | null | undefined): boolean {
  if (claims?.ignorar_coleta === true) return false;
  const r = claims?.role;
  if (isStaffOperacaoRole(r)) return true;
  if (isMotoboyRole(r)) return Boolean(claims?.pode_ler_coleta);
  return Boolean(claims?.pode_ler_coleta);
}

/** Rótulo curto para exibição (opcional). */
export function staffRoleLabel(role: number | undefined): string {
  switch (role) {
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
