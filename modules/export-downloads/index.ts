import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";

type SavedDownload = { uri: string; fileName: string };

type ExportDownloadsNative = {
  isSupported(): boolean;
  saveBase64ToDownloads(base64: string, fileName: string, mimeType: string): Promise<SavedDownload>;
};

const nativeModule =
  Platform.OS === "android"
    ? requireOptionalNativeModule<ExportDownloadsNative>("ExportDownloads")
    : null;

/** Falso em iOS, Android < 10 ou build antigo sem o módulo nativo. */
export function canSaveToDownloads(): boolean {
  try {
    return !!nativeModule && nativeModule.isSupported();
  } catch {
    return false;
  }
}

export async function saveBase64ToDownloads(
  base64: string,
  fileName: string,
  mimeType: string
): Promise<SavedDownload> {
  if (!nativeModule) {
    throw new Error("Salvar em Downloads não está disponível nesta versão do app.");
  }
  return nativeModule.saveBase64ToDownloads(base64, fileName, mimeType);
}
