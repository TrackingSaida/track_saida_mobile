import * as FileSystem from "expo-file-system/legacy";
import {
  mergePendingCaptureUriForScope,
  parseAvulsoSource,
  parsePendingCaptureIdSaida,
  parsePendingCaptureKind,
  parseTipoDocumento,
  pendingCaptureMatchesScope,
  pickLatestResumeItem,
  toResumeItem,
  type AusenteDraftFields,
  type AusentePhotoDraft,
  type AvulsoPhotoDraft,
  type AvulsoPhotoSource,
  type DevolucaoPhotoDraft,
  type EntregueDraftFields,
  type EntreguePhotoDraft,
  type PendingCaptureRecord,
  type PendingCaptureScope,
  type PhotoFlowDraft,
  type PhotoResumeItem,
} from "./photoFlowUtils";

export type DeliveryPhotoDraftKind = "entregue" | "ausente";

const DRAFT_DIR = `${FileSystem.documentDirectory}delivery_photo_drafts/`;
const PENDING_CAPTURE_PATH = `${DRAFT_DIR}pending_capture.json`;
const AVULSO_PATH = `${DRAFT_DIR}avulso.json`;
const DEVOLUCAO_PATH = `${DRAFT_DIR}devolucao.json`;

function draftPath(kind: DeliveryPhotoDraftKind, idSaida: number): string {
  return `${DRAFT_DIR}${kind}_${idSaida}.json`;
}

async function ensureDraftDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DRAFT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DRAFT_DIR, { intermediates: true });
  }
}

async function writeJson(path: string, payload: unknown): Promise<void> {
  await ensureDraftDir();
  await FileSystem.writeAsStringAsync(path, JSON.stringify(payload));
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function deleteIfExists(path: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  } catch {
    /* ignore */
  }
}

async function existingUris(uris: string[]): Promise<string[]> {
  const existing: string[] = [];
  for (const uri of uris) {
    if (!uri) continue;
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (fileInfo.exists) existing.push(uri);
    } catch {
      /* skip missing */
    }
  }
  return existing;
}

export async function savePendingCaptureUri(
  uri: string,
  scope?: PendingCaptureScope | null
): Promise<void> {
  const trimmed = uri.trim();
  if (!trimmed) return;
  const existing = await loadPendingCaptureRecord();
  const kind = scope?.kind ?? existing?.kind;
  const idSaida = parsePendingCaptureIdSaida(scope?.idSaida ?? existing?.idSaida);
  const payload: PendingCaptureRecord = {
    uri: trimmed,
    updatedAt: Date.now(),
    ...(kind ? { kind } : {}),
    ...(idSaida != null ? { idSaida } : {}),
  };
  await writeJson(PENDING_CAPTURE_PATH, payload);
}

export async function loadPendingCaptureRecord(): Promise<PendingCaptureRecord | null> {
  const parsed = await readJson<{
    uri?: string;
    updatedAt?: number;
    kind?: unknown;
    idSaida?: unknown;
  }>(PENDING_CAPTURE_PATH);
  const uri = typeof parsed?.uri === "string" ? parsed.uri.trim() : "";
  if (!uri) return null;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
  } catch {
    return null;
  }
  return {
    uri,
    updatedAt: Number(parsed?.updatedAt) || Date.now(),
    kind: parsePendingCaptureKind(parsed?.kind),
    idSaida: parsePendingCaptureIdSaida(parsed?.idSaida),
  };
}

export async function loadPendingCaptureUri(): Promise<string | null> {
  const record = await loadPendingCaptureRecord();
  return record?.uri ?? null;
}

export async function clearPendingCaptureUri(): Promise<void> {
  await deleteIfExists(PENDING_CAPTURE_PATH);
}

export async function clearPendingCaptureIfMatches(scope: PendingCaptureScope): Promise<void> {
  const pending = await loadPendingCaptureRecord();
  if (!pendingCaptureMatchesScope(pending, scope)) return;
  await clearPendingCaptureUri();
}

async function consumeMatchingPending(
  scope: PendingCaptureScope,
  consumed: boolean
): Promise<void> {
  if (!consumed) return;
  await clearPendingCaptureIfMatches(scope);
}

export async function saveDeliveryPhotoDraft(
  kind: DeliveryPhotoDraftKind,
  idSaida: number,
  photoUris: string[],
  fields?: EntregueDraftFields | AusenteDraftFields
): Promise<void> {
  if (idSaida <= 0) return;
  const payload: EntreguePhotoDraft | AusentePhotoDraft = {
    kind,
    idSaida,
    photoUris,
    updatedAt: Date.now(),
    ...(fields ? { fields } : {}),
  } as EntreguePhotoDraft | AusentePhotoDraft;
  await writeJson(draftPath(kind, idSaida), payload);
  await consumeMatchingPending({ kind, idSaida }, photoUris.length > 0);
}

export async function loadDeliveryPhotoDraft(
  kind: DeliveryPhotoDraftKind,
  idSaida: number
): Promise<string[]> {
  const record = await loadDeliveryPhotoDraftRecord(kind, idSaida);
  return record?.photoUris ?? [];
}

export async function loadDeliveryPhotoDraftRecord(
  kind: DeliveryPhotoDraftKind,
  idSaida: number
): Promise<(EntreguePhotoDraft | AusentePhotoDraft) | null> {
  if (idSaida <= 0) return null;
  const parsed = await readJson<{
    photoUris?: string[];
    fields?: EntregueDraftFields | AusenteDraftFields;
    updatedAt?: number;
  }>(draftPath(kind, idSaida));
  const pending = await loadPendingCaptureRecord();
  const pendingMatches = pendingCaptureMatchesScope(pending, { kind, idSaida });
  if (!parsed && !pendingMatches) return null;
  const photoUris = await existingUris(
    mergePendingCaptureUriForScope(
      Array.isArray(parsed?.photoUris) ? parsed.photoUris : [],
      pending?.uri ?? null,
      pendingMatches
    )
  );
  if (kind === "entregue") {
    const fields = parsed?.fields
      ? {
          tipoRecebedor: String((parsed.fields as EntregueDraftFields).tipoRecebedor || "Comprador"),
          nomeRecebedor: String((parsed.fields as EntregueDraftFields).nomeRecebedor || ""),
          tipoDocumento: parseTipoDocumento((parsed.fields as EntregueDraftFields).tipoDocumento),
          numeroDocumento: String((parsed.fields as EntregueDraftFields).numeroDocumento || ""),
          observacao: String((parsed.fields as EntregueDraftFields).observacao || ""),
        }
      : undefined;
    return {
      kind: "entregue",
      idSaida,
      photoUris,
      fields,
      updatedAt: Number(parsed?.updatedAt) || Date.now(),
    };
  }
  const fields = parsed?.fields
    ? {
        motivoId:
          typeof (parsed.fields as AusenteDraftFields).motivoId === "number"
            ? (parsed.fields as AusenteDraftFields).motivoId
            : null,
        observacao: String((parsed.fields as AusenteDraftFields).observacao || ""),
      }
    : undefined;
  return {
    kind: "ausente",
    idSaida,
    photoUris,
    fields,
    updatedAt: Number(parsed?.updatedAt) || Date.now(),
  };
}

export async function clearDeliveryPhotoDraft(
  kind: DeliveryPhotoDraftKind,
  idSaida: number
): Promise<void> {
  if (idSaida <= 0) return;
  await deleteIfExists(draftPath(kind, idSaida));
  await clearPendingCaptureIfMatches({ kind, idSaida });
}

export async function saveAvulsoPhotoDraft(draft: Omit<AvulsoPhotoDraft, "kind" | "updatedAt"> & { updatedAt?: number }): Promise<void> {
  const payload: AvulsoPhotoDraft = {
    kind: "avulso",
    source: parseAvulsoSource(draft.source),
    identificacao: draft.identificacao,
    quantidade: draft.quantidade,
    photos: draft.photos,
    updatedAt: draft.updatedAt ?? Date.now(),
  };
  await writeJson(AVULSO_PATH, payload);
  await consumeMatchingPending({ kind: "avulso" }, payload.photos.length > 0);
}

export async function loadAvulsoPhotoDraft(
  source?: AvulsoPhotoSource
): Promise<AvulsoPhotoDraft | null> {
  const parsed = await readJson<Partial<AvulsoPhotoDraft>>(AVULSO_PATH);
  if (!parsed) return null;
  const photos = [];
  for (const photo of Array.isArray(parsed.photos) ? parsed.photos : []) {
    if (!photo?.uri) continue;
    try {
      const info = await FileSystem.getInfoAsync(photo.uri);
      if (!info.exists) continue;
      photos.push({
        id: String(photo.id || `local-${photos.length}`),
        uri: photo.uri,
        objectKey: photo.objectKey,
        photoId: photo.photoId,
      });
    } catch {
      /* skip */
    }
  }
  const draft: AvulsoPhotoDraft = {
    kind: "avulso",
    source: parseAvulsoSource(parsed.source),
    identificacao: String(parsed.identificacao || ""),
    quantidade: String(parsed.quantidade || "1"),
    photos,
    updatedAt: Number(parsed.updatedAt) || Date.now(),
  };
  if (source && draft.source !== source) return null;
  const pending = await loadPendingCaptureRecord();
  if (
    pendingCaptureMatchesScope(pending, { kind: "avulso" }) &&
    pending?.uri &&
    !draft.photos.some((p) => p.uri === pending.uri)
  ) {
    draft.photos.push({ id: `pending-${Date.now()}`, uri: pending.uri });
  }
  return draft;
}

export async function clearAvulsoPhotoDraft(): Promise<void> {
  await deleteIfExists(AVULSO_PATH);
  await clearPendingCaptureIfMatches({ kind: "avulso" });
}

export async function saveDevolucaoPhotoDraft(draft: {
  idSaida: number | null;
  codigo?: string;
  photoUri: string | null;
}): Promise<void> {
  const payload: DevolucaoPhotoDraft = {
    kind: "devolucao",
    idSaida: draft.idSaida,
    codigo: draft.codigo,
    photoUri: draft.photoUri,
    updatedAt: Date.now(),
  };
  await writeJson(DEVOLUCAO_PATH, payload);
  await consumeMatchingPending(
    { kind: "devolucao", idSaida: draft.idSaida },
    !!payload.photoUri
  );
}

export async function loadDevolucaoPhotoDraft(): Promise<DevolucaoPhotoDraft | null> {
  const parsed = await readJson<Partial<DevolucaoPhotoDraft>>(DEVOLUCAO_PATH);
  if (!parsed) return null;
  let photoUri: string | null = typeof parsed.photoUri === "string" ? parsed.photoUri : null;
  if (photoUri) {
    try {
      const info = await FileSystem.getInfoAsync(photoUri);
      if (!info.exists) photoUri = null;
    } catch {
      photoUri = null;
    }
  }
  const idSaida = typeof parsed.idSaida === "number" ? parsed.idSaida : null;
  const pending = await loadPendingCaptureRecord();
  if (
    !photoUri &&
    pendingCaptureMatchesScope(pending, { kind: "devolucao", idSaida })
  ) {
    photoUri = pending?.uri ?? null;
  }
  return {
    kind: "devolucao",
    idSaida,
    codigo: typeof parsed.codigo === "string" ? parsed.codigo : undefined,
    photoUri,
    updatedAt: Number(parsed.updatedAt) || Date.now(),
  };
}

export async function clearDevolucaoPhotoDraft(): Promise<void> {
  await deleteIfExists(DEVOLUCAO_PATH);
  await clearPendingCaptureIfMatches({ kind: "devolucao" });
}

async function listDeliveryKindDrafts(): Promise<PhotoFlowDraft[]> {
  const drafts: PhotoFlowDraft[] = [];
  try {
    await ensureDraftDir();
    const listing = await FileSystem.readDirectoryAsync(DRAFT_DIR);
    for (const name of listing) {
      const match = /^(entregue|ausente)_(\d+)\.json$/.exec(name);
      if (!match) continue;
      const kind = match[1] as DeliveryPhotoDraftKind;
      const idSaida = Number(match[2]);
      const record = await loadDeliveryPhotoDraftRecord(kind, idSaida);
      if (record) drafts.push(record);
    }
  } catch {
    /* ignore */
  }
  return drafts;
}

export async function listResumeWorthyPhotoDrafts(): Promise<PhotoResumeItem[]> {
  const items: PhotoResumeItem[] = [];
  const kindDrafts = await listDeliveryKindDrafts();
  for (const draft of kindDrafts) {
    const item = toResumeItem(draft);
    if (item) items.push(item);
  }
  const avulso = await loadAvulsoPhotoDraft();
  if (avulso) {
    const item = toResumeItem(avulso);
    if (item) items.push(item);
  }
  const devolucao = await loadDevolucaoPhotoDraft();
  if (devolucao) {
    const item = toResumeItem(devolucao);
    if (item) items.push(item);
  }
  return items;
}

export async function getLatestPhotoResumeItem(): Promise<PhotoResumeItem | null> {
  const items = await listResumeWorthyPhotoDrafts();
  return pickLatestResumeItem(items);
}

export async function discardPhotoResumeItem(item: PhotoResumeItem): Promise<void> {
  if (item.kind === "avulso") {
    await clearAvulsoPhotoDraft();
  } else if (item.kind === "devolucao") {
    await clearDevolucaoPhotoDraft();
  } else if (item.idSaida) {
    await clearDeliveryPhotoDraft(item.kind, item.idSaida);
  }
  await clearPendingCaptureUri();
}
