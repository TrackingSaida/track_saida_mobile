/**
 * Regras puras do fluxo de foto (captura em disco, rascunho, retomada).
 * Sem React Native — testável com tsx.
 */

export const PREPARE_MAX_WIDTH = 1280;
/** Abaixo disso o JPEG já está pequeno o bastante — evita ImageManipulator (OOM). */
export const SKIP_RESIZE_MAX_BYTES = 500_000;
export const CAMERA_HARDWARE_RELEASE_MS = 500;
export const PHOTO_DRAFT_MAX_AGE_MS = 48 * 60 * 60 * 1000;

export type PhotoPickResult = {
  uri: string;
  mimeType: string;
  filename: string;
};

export type PhotoFlowKind = "entregue" | "ausente" | "avulso" | "devolucao";
export type AvulsoPhotoSource = "scan" | "saidas";

export type EntregueDraftFields = {
  tipoRecebedor: string;
  nomeRecebedor: string;
  tipoDocumento: "RG" | "CPF";
  numeroDocumento: string;
  observacao: string;
};

export type AusenteDraftFields = {
  motivoId: number | null;
  observacao: string;
};

export type AvulsoDraftPhoto = {
  id: string;
  uri: string;
  objectKey?: string;
  photoId?: string;
};

export type EntreguePhotoDraft = {
  kind: "entregue";
  idSaida: number;
  photoUris: string[];
  fields?: EntregueDraftFields;
  updatedAt: number;
};

export type AusentePhotoDraft = {
  kind: "ausente";
  idSaida: number;
  photoUris: string[];
  fields?: AusenteDraftFields;
  updatedAt: number;
};

export type AvulsoPhotoDraft = {
  kind: "avulso";
  source: AvulsoPhotoSource;
  identificacao: string;
  quantidade: string;
  photos: AvulsoDraftPhoto[];
  updatedAt: number;
};

export type DevolucaoPhotoDraft = {
  kind: "devolucao";
  idSaida: number | null;
  codigo?: string;
  photoUri: string | null;
  updatedAt: number;
};

export type PhotoFlowDraft =
  | EntreguePhotoDraft
  | AusentePhotoDraft
  | AvulsoPhotoDraft
  | DevolucaoPhotoDraft;

export type PhotoResumeItem = {
  kind: PhotoFlowKind;
  title: string;
  subtitle: string;
  idSaida?: number;
  source?: AvulsoPhotoSource;
  updatedAt: number;
};

export function shouldSkipImageResize(sizeBytes: number | undefined | null): boolean {
  return typeof sizeBytes === "number" && Number.isFinite(sizeBytes) && sizeBytes > 0 && sizeBytes <= SKIP_RESIZE_MAX_BYTES;
}

export function isDraftFresh(updatedAt: number, now = Date.now()): boolean {
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return false;
  return now - updatedAt <= PHOTO_DRAFT_MAX_AGE_MS;
}

export function isResumeWorthyDraft(draft: PhotoFlowDraft, now = Date.now()): boolean {
  if (!isDraftFresh(draft.updatedAt, now)) return false;
  if (draft.kind === "avulso") return draft.photos.length > 0;
  if (draft.kind === "devolucao") return !!draft.photoUri;
  return draft.photoUris.length > 0;
}

export function resumeCopyForKind(kind: PhotoFlowKind): { title: string; subtitle: string } {
  if (kind === "ausente") {
    return {
      title: "Foto de ausência não concluída",
      subtitle: "O app fechou depois da foto. Continuar de onde parou?",
    };
  }
  if (kind === "avulso") {
    return {
      title: "Lançamento avulso não concluído",
      subtitle: "A foto ficou salva neste aparelho. Continuar o lançamento?",
    };
  }
  if (kind === "devolucao") {
    return {
      title: "Devolução não concluída",
      subtitle: "A foto do comprovante ficou salva. Continuar a devolução?",
    };
  }
  return {
    title: "Comprovante não concluído",
    subtitle: "A foto ficou salva neste aparelho. Continuar o registro da entrega?",
  };
}

export function toResumeItem(draft: PhotoFlowDraft): PhotoResumeItem | null {
  if (!isResumeWorthyDraft(draft)) return null;
  const copy = resumeCopyForKind(draft.kind);
  if (draft.kind === "avulso") {
    return {
      kind: "avulso",
      title: copy.title,
      subtitle: copy.subtitle,
      source: draft.source,
      updatedAt: draft.updatedAt,
    };
  }
  if (draft.kind === "devolucao") {
    return {
      kind: "devolucao",
      title: copy.title,
      subtitle: copy.subtitle,
      idSaida: draft.idSaida ?? undefined,
      updatedAt: draft.updatedAt,
    };
  }
  return {
    kind: draft.kind,
    title: copy.title,
    subtitle: copy.subtitle,
    idSaida: draft.idSaida,
    updatedAt: draft.updatedAt,
  };
}

export function pickLatestResumeItem(items: PhotoResumeItem[]): PhotoResumeItem | null {
  if (items.length === 0) return null;
  return items.slice().sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

export function mergePendingCaptureUri(photoUris: string[], pendingUri: string | null): string[] {
  const uri = (pendingUri || "").trim();
  if (!uri) return photoUris;
  if (photoUris.includes(uri)) return photoUris;
  return [...photoUris, uri];
}

export function parseTipoDocumento(value: unknown): "RG" | "CPF" {
  return value === "CPF" ? "CPF" : "RG";
}

export function parseAvulsoSource(value: unknown): AvulsoPhotoSource {
  return value === "saidas" ? "saidas" : "scan";
}
