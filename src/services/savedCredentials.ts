import * as SecureStore from "expo-secure-store";

/** Mesmas chaves usadas em LoginScreen (não alterar sem migrar). */
const REMEMBER_CREDENTIALS_KEY = "remember_credentials";
const SAVED_IDENTIFIER_KEY = "saved_login_identifier";
const SAVED_PASSWORD_KEY = "saved_login_password";

export async function getSavedCredentials(): Promise<{
  identifier: string;
  password: string;
} | null> {
  try {
    const remember = (await SecureStore.getItemAsync(REMEMBER_CREDENTIALS_KEY)) === "true";
    if (!remember) return null;
    const identifier = (await SecureStore.getItemAsync(SAVED_IDENTIFIER_KEY))?.trim() || "";
    const password = (await SecureStore.getItemAsync(SAVED_PASSWORD_KEY)) || "";
    if (!identifier || !password) return null;
    return { identifier, password };
  } catch {
    return null;
  }
}

export async function saveOrClearCredentials(
  identifier: string,
  password: string,
  remember: boolean
): Promise<void> {
  try {
    if (remember) {
      await SecureStore.setItemAsync(REMEMBER_CREDENTIALS_KEY, "true");
      await SecureStore.setItemAsync(SAVED_IDENTIFIER_KEY, identifier);
      await SecureStore.setItemAsync(SAVED_PASSWORD_KEY, password);
    } else {
      await SecureStore.deleteItemAsync(REMEMBER_CREDENTIALS_KEY);
      await SecureStore.deleteItemAsync(SAVED_IDENTIFIER_KEY);
      await SecureStore.deleteItemAsync(SAVED_PASSWORD_KEY);
    }
  } catch {
    /* ignore */
  }
}
