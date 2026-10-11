import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import type { EntregaListItem } from "../types";
import { buildEnderecoRows, buildExportFileName } from "./exportEnderecosRows";
import { canSaveToDownloads, saveBase64ToDownloads } from "../../../../modules/export-downloads";
import { useAuthStore } from "../../../store/authStore";
import {
  buildMotoboyPrefsKey,
  getExportDirUri,
  setExportDirUri,
} from "../../../services/settingsService";

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLSX_UTI = "org.openxmlformats.spreadsheetml.sheet";

const { StorageAccessFramework } = FileSystem;

export type ExportEnderecosResult =
  | { status: "saved"; fileName: string; folderLabel: string; cacheUri: string; total: number }
  | { status: "shared"; fileName: string; total: number }
  | { status: "cancelled" }
  | { status: "empty" };

function buildWorkbookBase64(rows: ReturnType<typeof buildEnderecoRows>): string {
  const sheet = XLSX.utils.json_to_sheet(rows, { header: ["endereço", "numero", "cep"] });
  sheet["!cols"] = [{ wch: 48 }, { wch: 10 }, { wch: 10 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Planilha1");
  return XLSX.write(workbook, { type: "base64", bookType: "xlsx" }) as string;
}

function folderLabelFromTreeUri(dirUri: string): string {
  try {
    const decoded = decodeURIComponent(dirUri);
    const tail = decoded.split("/tree/").pop() ?? "";
    const path = tail.includes(":") ? tail.slice(tail.indexOf(":") + 1) : tail;
    const name = path.split("/").filter(Boolean).pop();
    if (!name || name === "Download") return "Downloads";
    return name;
  } catch {
    return "pasta escolhida";
  }
}

async function writeToDir(dirUri: string, fileName: string, base64: string): Promise<void> {
  const fileUri = await StorageAccessFramework.createFileAsync(dirUri, fileName, XLSX_MIME);
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

async function downloadXlsxAndroid(
  base64: string,
  fileName: string
): Promise<{ folderLabel: string } | null> {
  const userKey = buildMotoboyPrefsKey(useAuthStore.getState().currentUser);
  const savedDir = await getExportDirUri(userKey).catch(() => null);
  if (savedDir) {
    try {
      await writeToDir(savedDir, fileName, base64);
      return { folderLabel: folderLabelFromTreeUri(savedDir) };
    } catch {
      await setExportDirUri(userKey, null).catch(() => undefined);
    }
  }

  const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync(
    StorageAccessFramework.getUriForDirectoryInRoot("Download")
  );
  if (!permission.granted) return null;

  await writeToDir(permission.directoryUri, fileName, base64);
  await setExportDirUri(userKey, permission.directoryUri).catch(() => undefined);
  return { folderLabel: folderLabelFromTreeUri(permission.directoryUri) };
}

export async function shareExportedFile(cacheUri: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Compartilhamento não disponível neste aparelho.");
  }
  await Sharing.shareAsync(cacheUri, {
    mimeType: XLSX_MIME,
    UTI: XLSX_UTI,
    dialogTitle: "Compartilhar endereços",
  });
}

export async function exportEnderecosXlsx(
  items: Array<Pick<EntregaListItem, "endereco" | "numero" | "cep">>
): Promise<ExportEnderecosResult> {
  const rows = buildEnderecoRows(items);
  if (rows.length === 0) return { status: "empty" };

  const fileName = buildExportFileName();
  const base64 = buildWorkbookBase64(rows);
  const cacheUri = `${FileSystem.cacheDirectory ?? ""}${fileName}`;
  await FileSystem.writeAsStringAsync(cacheUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (Platform.OS === "android" && canSaveToDownloads()) {
    const saved = await saveBase64ToDownloads(base64, fileName, XLSX_MIME);
    return {
      status: "saved",
      fileName: saved.fileName,
      folderLabel: "Downloads",
      cacheUri,
      total: rows.length,
    };
  }

  if (Platform.OS === "android") {
    const saved = await downloadXlsxAndroid(base64, fileName);
    if (!saved) return { status: "cancelled" };
    return { status: "saved", fileName, folderLabel: saved.folderLabel, cacheUri, total: rows.length };
  }

  await shareExportedFile(cacheUri);
  return { status: "shared", fileName, total: rows.length };
}
