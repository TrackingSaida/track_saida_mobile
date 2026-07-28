import { uploadDeliveryPhoto } from "../../../services/deliveryPhotoService";
import { createPhotoId } from "../../../services/outbox/types";

export type PhotoUploadInput = {
  uri: string;
  photoId?: string;
  objectKey?: string;
};

const UPLOAD_CONCURRENCY = 3;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(runners);
  return results;
}

async function uploadPhotosForDeliveryIds(
  photos: PhotoUploadInput[],
  idSaidas: number[],
  tipo: "entregue" | "ausente" | "devolucao",
  clientActionId?: string
): Promise<string[]> {
  const targets = idSaidas.filter((id) => id > 0);
  if (targets.length === 0 || photos.length === 0) return [];

  const keys = await mapPool(photos, UPLOAD_CONCURRENCY, async (photo) => {
    const photoId = photo.photoId || createPhotoId();
    const primaryId = targets[0];
    const filename = photo.uri.split("/").pop() || "foto.jpg";
    const objectKey = await uploadDeliveryPhoto({
      id_saida: primaryId,
      tipo,
      uri: photo.uri,
      mimeType: "image/jpeg",
      filename,
      photoId,
      existingObjectKey: photo.objectKey,
      validarCamposObrigatorios: false,
      alterarStatus: false,
      clientActionId,
    });

    if (targets.length > 1) {
      await mapPool(targets.slice(1), UPLOAD_CONCURRENCY, async (idSaida) => {
        await uploadDeliveryPhoto({
          id_saida: idSaida,
          tipo,
          uri: photo.uri,
          mimeType: "image/jpeg",
          filename,
          photoId,
          existingObjectKey: objectKey,
          validarCamposObrigatorios: false,
          alterarStatus: false,
          clientActionId,
        });
      });
    }

    return objectKey;
  });

  return keys;
}

export async function uploadEntreguePhotosForDeliveryIds(
  photoUris: string[],
  idSaidas: number[],
  photoIds?: string[],
  headers?: Record<string, string>
): Promise<string[]> {
  return uploadPhotosForDeliveryIds(
    photoUris.map((uri, index) => ({ uri, photoId: photoIds?.[index] })),
    idSaidas,
    "entregue",
    headers?.["X-Client-Action-Id"]
  );
}

export async function uploadAusentePhotosForDeliveryIds(
  photoUris: string[],
  idSaidas: number[],
  photoIds?: string[],
  headers?: Record<string, string>
): Promise<string[]> {
  return uploadPhotosForDeliveryIds(
    photoUris.map((uri, index) => ({ uri, photoId: photoIds?.[index] })),
    idSaidas,
    "ausente",
    headers?.["X-Client-Action-Id"]
  );
}

export async function uploadDevolucaoPhotosForDeliveryIds(
  photoUris: string[],
  idSaidas: number[],
  photoIds?: string[],
  headers?: Record<string, string>
): Promise<string[]> {
  return uploadPhotosForDeliveryIds(
    photoUris.map((uri, index) => ({ uri, photoId: photoIds?.[index] })),
    idSaidas,
    "devolucao",
    headers?.["X-Client-Action-Id"]
  );
}
