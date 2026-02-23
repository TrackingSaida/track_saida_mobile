/**
 * Máscaras para CPF e RG.
 * CPF: 11 dígitos → 000.000.000-00
 * RG: até 8 dígitos + 1 dígito ou letra A-Z → 00.000.000-0
 */

export function formatCPF(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/** Último caractere do RG pode ser 0-9 ou A-Z; demais apenas dígitos. Formato 00.000.000-0 */
export function formatRG(value: string): string {
  const cleaned = value.replace(/[.\s-]/g, "");
  const digits = cleaned.replace(/[^0-9]/g, "");
  const lastChar = cleaned.replace(/[0-9]/g, "");
  const first8 = digits.slice(0, 8);
  const ninth = lastChar.charAt(0) && /[0-9A-Za-z]/.test(lastChar.charAt(0))
    ? lastChar.charAt(0).toUpperCase()
    : digits.length > 8
      ? digits.charAt(8)
      : "";
  const combined = first8 + ninth;
  if (combined.length <= 2) return combined;
  if (combined.length <= 5) return `${combined.slice(0, 2)}.${combined.slice(2)}`;
  if (combined.length <= 8) return `${combined.slice(0, 2)}.${combined.slice(2, 5)}.${combined.slice(5)}`;
  return `${combined.slice(0, 2)}.${combined.slice(2, 5)}.${combined.slice(5, 8)}-${combined.slice(8)}`;
}

/** Para CPF: apenas 11 dígitos (remove pontos e traço). */
export function unmaskCPF(value: string): string {
  return value.replace(/\D/g, "").slice(0, 11);
}

/** Para RG: 8 dígitos + opcional 9º caractere (dígito ou A-Z). Remove pontos e traço. */
export function unmaskRG(value: string): string {
  const cleaned = value.replace(/[.\s-]/g, "");
  const digits = cleaned.replace(/[^0-9]/g, "").slice(0, 8);
  const ninth = cleaned.replace(/[0-9]/g, "");
  const last = ninth.charAt(0) && /[0-9A-Za-z]/.test(ninth.charAt(0)) ? ninth.charAt(0).toUpperCase() : "";
  return digits + last;
}
