import * as FileSystem from "expo-file-system/legacy";

export type DeliveryPhotoDraftKind = "entregue" | "ausente";

export type DeliveryPhotoDraft = {
  idSaida: number;
  kind: DeliveryPhotoDraftKind;
  photoUris: string[];
  updatedAt: number;
};

const DRAFT_DIR = `${FileSystem.documentDirectory}delivery_photo_drafts/`;

function draftPath(kind: DeliveryPhotoDraftKind, idSaida: number): string {
  return `${DRAFT_DIR}${kind}_${idSaida}.json`;
}

async function ensureDraftDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DRAFT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DRAFT_DIR, { intermediates: true });
  }
}

export async function saveDeliveryPhotoDraft(
  kind: DeliveryPhotoDraftKind,
  idSaida: number,
  photoUris: string[]
): Promise<void> {
  if (idSaida <= 0) return;
  await ensureDraftDir();
  const payload: DeliveryPhotoDraft = {
    idSaida,
    kind,
    photoUris,
    updatedAt: Date.now(),
  };
  await FileSystem.writeAsStringAsync(draftPath(kind, idSaida), JSON.stringify(payload));
}

export async function loadDeliveryPhotoDraft(
  kind: DeliveryPhotoDraftKind,
  idSaida: number
): Promise<string[]> {
  if (idSaida <= 0) return [];
  try {
    const path = draftPath(kind, idSaida);
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as DeliveryPhotoDraft;
    if (!Array.isArray(parsed.photoUris)) return [];
    const existing: string[] = [];
    for (const uri of parsed.photoUris) {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) existing.push(uri);
    }
    return existing;
  } catch {
    return [];
  }
}

export async function clearDeliveryPhotoDraft(
  kind: DeliveryPhotoDraftKind,
  idSaida: number
): Promise<void> {
  if (idSaida <= 0) return;
  try {
    const path = draftPath(kind, idSaida);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch {
    /* ignore */
  }
}
