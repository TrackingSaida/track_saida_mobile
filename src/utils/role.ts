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

export type ModoOperacaoColeta = "desativado" | "codigo" | "coleta_manual" | "ambos";

export function modoOperacaoColeta(claims: JwtClaims | null | undefined): ModoOperacaoColeta {
  if (!claims || claims.ignorar_coleta === true) return "desativado";
  const modo = String(claims.modo_operacao || "codigo").trim().toLowerCase();
  if (modo === "coleta_manual" || modo === "ambos" || modo === "codigo") return modo;
  return "codigo";
}

/** Câmera e leitor físico. */
export function permiteLeituraColeta(claims: JwtClaims | null | undefined): boolean {
  const modo = modoOperacaoColeta(claims);
  return modo === "codigo" || modo === "ambos";
}

/** Lançamento por quantidades (Flex/Shopee/Avulso). */
export function permiteManualColeta(claims: JwtClaims | null | undefined): boolean {
  const modo = modoOperacaoColeta(claims);
  return modo === "coleta_manual" || modo === "ambos";
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

/**
 * Lançar avulso: staff (0–3) sempre pode; motoboy liberado por padrão (opt-out).
 */
export function effectivePodeLancarAvulso(claims: JwtClaims | null | undefined): boolean {
  if (!claims) return false;
  const r = asRole(claims.role);
  if (isStaffOperacaoRole(r)) return true;
  if (isMotoboyRole(r)) return asDefaultTrue(claims.pode_lancar_avulso);
  return false;
}

export type AvulsoExigeFotoMotoboy = { avulso_exige_foto?: boolean } | null | undefined;

/**
 * Foto obrigatória no avulso: motoboy segue JWT; staff segue flag do motoboy selecionado (se disponível).
 */
export function effectiveAvulsoExigeFoto(
  claims: JwtClaims | null | undefined,
  selectedMotoboy?: AvulsoExigeFotoMotoboy
): boolean {
  if (!claims) return false;
  const r = asRole(claims.role);
  if (isStaffOperacaoRole(r)) return asExplicitTrue(selectedMotoboy?.avulso_exige_foto);
  if (isMotoboyRole(r)) return asExplicitTrue(claims.avulso_exige_foto);
  return false;
}

/** Owner exige entrada na base antes da saída. */
export function effectiveEntradaObrigatoria(claims: JwtClaims | null | undefined): boolean {
  if (!claims) return false;
  return asExplicitTrue(claims.entrada_obrigatoria_habilitada);
}

/** Owner habilitou Conferência de Saída. */
export function effectiveConferenciaSaida(claims: JwtClaims | null | undefined): boolean {
  if (!claims) return false;
  return asExplicitTrue(claims.conferencia_saida_habilitada);
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
