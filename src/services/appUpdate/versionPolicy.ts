/**
 * Comparação de versão alinhada a track_saidas/mobile_app_version.py.
 * Versão inválida não bloqueia o app.
 */
export type AppVersionPolicy = {
  minVersion: string;
  minVersionByRole: Record<string, string>;
  storeUrl: string;
  message: string;
};

export function parseVersion(value: string | null | undefined): number[] | null {
  let text = (value || "").trim();
  if (text.toLowerCase().startsWith("v")) text = text.slice(1);
  text = text.split("-")[0].split("+")[0].trim();
  if (!text) return null;
  const parts = text.split(".");
  const nums: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    nums.push(Number(part));
  }
  return nums.length ? nums : null;
}

export function isVersionLess(installed: string, required: string): boolean {
  const left = parseVersion(installed);
  const right = parseVersion(required);
  if (!left || !right) return false;
  const width = Math.max(left.length, right.length);
  for (let i = 0; i < width; i += 1) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    if (a < b) return true;
    if (a > b) return false;
  }
  return false;
}

function asRole(role: unknown): number | undefined {
  if (typeof role === "number" && Number.isFinite(role)) return Math.trunc(role);
  if (typeof role === "string" && /^\d+$/.test(role.trim())) return Number(role.trim());
  return undefined;
}

export function requiredVersion(policy: AppVersionPolicy, role: unknown): string | null {
  let chosen = parseVersion(policy.minVersion) ? policy.minVersion : null;
  const numericRole = asRole(role);
  if (numericRole == null) return chosen;
  const roleMin = policy.minVersionByRole[String(numericRole)];
  if (!roleMin || !parseVersion(roleMin)) return chosen;
  if (!chosen || isVersionLess(chosen, roleMin)) return roleMin;
  return chosen;
}

export function isUpdateRequired(
  installed: string,
  policy: AppVersionPolicy,
  role: unknown
): boolean {
  const required = requiredVersion(policy, role);
  if (!required || !parseVersion(installed)) return false;
  return isVersionLess(installed, required);
}
