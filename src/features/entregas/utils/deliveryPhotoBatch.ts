import { uploadDeliveryPhoto } from "../../../services/deliveryPhotoService";
import { createPhotoId } from "../../../services/outbox/types";

export type PhotoUploadInput = {
  uri: string;
  photoId?: string;
  objectKey?: string;
};

async function uploadPhotosForDeliveryIds(
  photos: PhotoUploadInput[],
  idSaidas: number[],
  tipo: "entregue" | "ausente"
): Promise<string[]> {
  const targets = idSaidas.filter((id) => id > 0);
  if (targets.length === 0 || photos.length === 0) return [];

  const keys: string[] = [];
  for (const photo of photos) {
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
    });
    keys.push(objectKey);

    for (const idSaida of targets.slice(1)) {
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
      });
    }
  }
  return keys;
}

export async function uploadEntreguePhotosForDeliveryIds(
  photoUris: string[],
  idSaidas: number[],
  photoIds?: string[]
): Promise<string[]> {
  return uploadPhotosForDeliveryIds(
    photoUris.map((uri, index) => ({ uri, photoId: photoIds?.[index] })),
    idSaidas,
    "entregue"
  );
}

export async function uploadAusentePhotosForDeliveryIds(
  photoUris: string[],
  idSaidas: number[],
  photoIds?: string[]
): Promise<string[]> {
  return uploadPhotosForDeliveryIds(
    photoUris.map((uri, index) => ({ uri, photoId: photoIds?.[index] })),
    idSaidas,
    "ausente"
  );
}
