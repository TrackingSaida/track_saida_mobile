export function decodeJwtPayload(token: string): { username?: string; sub_base?: string } {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const payload = JSON.parse(atob(parts[1]));
    return { username: payload.username, sub_base: payload.sub_base };
  } catch {
    return {};
  }
}
