import * as SecureStore from "expo-secure-store";

/** Última sub_base escolhida no login root (reauth silencioso). */
const ROOT_LAST_SUB_BASE_KEY = "root_last_sub_base";

export async function getRootLastSubBase(): Promise<string | null> {
  try {
    const value = (await SecureStore.getItemAsync(ROOT_LAST_SUB_BASE_KEY))?.trim() || "";
    return value || null;
  } catch {
    return null;
  }
}

export async function setRootLastSubBase(subBase: string): Promise<void> {
  try {
    const value = (subBase || "").trim();
    if (!value) {
      await SecureStore.deleteItemAsync(ROOT_LAST_SUB_BASE_KEY);
      return;
    }
    await SecureStore.setItemAsync(ROOT_LAST_SUB_BASE_KEY, value);
  } catch {
    /* ignore */
  }
}

export async function clearRootLastSubBase(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ROOT_LAST_SUB_BASE_KEY);
  } catch {
    /* ignore */
  }
}
