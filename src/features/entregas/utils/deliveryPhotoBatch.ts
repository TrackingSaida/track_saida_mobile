import { uploadDeliveryPhoto } from "../../../services/deliveryPhotoService";
import { createPhotoId } from "../../../services/outbox/types";
import type { AxiosError } from "axios";

export type PhotoUploadInput = {
  uri: string;
  photoId?: string;
  objectKey?: string;
};

const UPLOAD_CONCURRENCY = 3;

function isObsoleteDeliveryActionError(e: unknown): boolean {
  const ax = e as AxiosError<{ detail?: { code?: string } }>;
  return ax.response?.status === 409 && ax.response?.data?.detail?.code === "ACAO_PEDIDO_OBSOLETA";
}

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
    const filename = photo.uri.split("/").pop() || "foto.jpg";
    let objectKey = photo.objectKey;
    let lastObsoleteError: unknown = null;
    for (const idSaida of targets) {
      try {
        objectKey = await uploadDeliveryPhoto({
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
      } catch (error) {
        if (!isObsoleteDeliveryActionError(error)) throw error;
        lastObsoleteError = error;
      }
    }
    if (!objectKey) throw lastObsoleteError;
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
