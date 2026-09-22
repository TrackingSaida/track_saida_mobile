import * as SecureStore from "expo-secure-store";

function todaySaoPauloYmd(): string {
  try {
    return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  } catch {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}

export function birthdayStorageKey(userId: number | string): string {
  return `birthday_greeted_${userId}_${todaySaoPauloYmd()}`;
}

export async function hasSeenBirthdayToday(userId: number | string): Promise<boolean> {
  try {
    const v = await SecureStore.getItemAsync(birthdayStorageKey(userId));
    return v === "1";
  } catch {
    return false;
  }
}

export async function markBirthdaySeenToday(userId: number | string): Promise<void> {
  try {
    await SecureStore.setItemAsync(birthdayStorageKey(userId), "1");
  } catch {
    /* ignore */
  }
}
