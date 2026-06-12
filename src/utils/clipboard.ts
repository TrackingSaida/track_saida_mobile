import { Share } from "react-native";

/** Copia texto; usa Share como fallback se expo-clipboard não estiver disponível. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Clipboard = require("expo-clipboard") as {
      setStringAsync: (value: string) => Promise<void>;
    };
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    await Share.share({ message: text });
    return false;
  }
}
