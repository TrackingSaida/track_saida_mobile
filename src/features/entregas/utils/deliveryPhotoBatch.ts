import { uploadDeliveryPhoto } from "../../../services/deliveryPhotoService";

export async function uploadEntreguePhotosForDeliveryIds(
  photoUris: string[],
  idSaidas: number[]
): Promise<void> {
  for (const idSaida of idSaidas) {
    for (const uri of photoUris) {
      await uploadDeliveryPhoto({
        id_saida: idSaida,
        tipo: "entregue",
        uri,
        mimeType: "image/jpeg",
        filename: uri.split("/").pop() || "foto.jpg",
        validarCamposObrigatorios: false,
        alterarStatus: false,
      });
    }
  }
}

export async function uploadAusentePhotosForDeliveryIds(
  photoUris: string[],
  idSaidas: number[]
): Promise<void> {
  for (const idSaida of idSaidas) {
    for (const uri of photoUris) {
      await uploadDeliveryPhoto({
        id_saida: idSaida,
        tipo: "ausente",
        uri,
        mimeType: "image/jpeg",
        filename: uri.split("/").pop() || "foto.jpg",
        validarCamposObrigatorios: false,
        alterarStatus: false,
      });
    }
  }
}
