export type PhotoUploadStatus = "idle" | "uploading" | "sent" | "error";

export type PhotoItemLike = { status?: PhotoUploadStatus; uri?: string };

export function countSentPhotos(photos: PhotoItemLike[]): number {
  return photos.filter((p) => p.status === "sent").length;
}

/** Foto obrigatória = pelo menos 1 foto adicionada (será enviada na fila/sync). */
export function meetsRequiredPhotoRule(
  photos: PhotoItemLike[],
  fotoObrigatoria: boolean
): boolean {
  if (!fotoObrigatoria) return true;
  if (photos.length >= 1) return true;
  return countSentPhotos(photos) >= 1;
}

export function canConfirmWithPhotos(
  photos: PhotoItemLike[],
  fotoObrigatoria: boolean
): { ok: boolean; reason?: string } {
  if (!fotoObrigatoria) return { ok: true };
  if (photos.length === 0) {
    return { ok: false, reason: "Adicione pelo menos uma foto de comprovante." };
  }
  const sent = countSentPhotos(photos);
  const pending = photos.some(
    (p) => !p.status || p.status === "idle" || p.status === "uploading"
  );
  if (sent >= 1) return { ok: true };
  if (pending || photos.length >= 1) return { ok: true };
  return {
    ok: false,
    reason: "Nenhuma foto foi enviada. Toque em Tentar novamente ou adicione outra foto.",
  };
}

export function hasPendingPhotoUploads(photos: PhotoItemLike[]): boolean {
  return photos.some((p) => p.status === "idle" || p.status === "uploading");
}
