import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { getPresignUpload, patchFotoSaida } from "../features/entregas/api";
import type { AxiosError } from "axios";

/** Converte base64 em Uint8Array para enviar no body do PUT. */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const MAX_PHOTOS = 3;

export type PhotoSource = "camera" | "gallery";

export interface PhotoPickResult {
  uri: string;
  mimeType: string;
  filename: string;
}

/** Abre ActionSheet: Tirar foto | Galeria | Cancelar. Retorna resultado ou null se cancelar. */
export async function selectOrTakePhoto(): Promise<PhotoPickResult | null> {
  const { Alert } = await import("react-native");
  return new Promise((resolve) => {
    Alert.alert("Adicionar foto", "Escolha uma opção", [
      {
        text: "Tirar foto",
        onPress: () => openCamera().then(resolve),
      },
      {
        text: "Galeria",
        onPress: () => openGallery().then(resolve),
      },
      { text: "Cancelar", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

async function openCamera(): Promise<PhotoPickResult | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permissão de câmera negada.");
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const filename = asset.uri.split("/").pop() || "foto.jpg";
  return {
    uri: asset.uri,
    mimeType: asset.mimeType || "image/jpeg",
    filename,
  };
}

async function openGallery(): Promise<PhotoPickResult | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permissão de galeria negada.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 1,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const filename = asset.uri.split("/").pop() || "foto.jpg";
  return {
    uri: asset.uri,
    mimeType: asset.mimeType || "image/jpeg",
    filename,
  };
}

/** Redimensiona e comprime a imagem (maxWidth 1280, compress 0.75, JPEG). */
export async function preparePhoto(uri: string): Promise<PhotoPickResult> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
  );
  const filename = "foto.jpg";
  return {
    uri: manipulated.uri,
    mimeType: "image/jpeg",
    filename,
  };
}

export interface UploadDeliveryPhotoParams {
  id_saida: number;
  tipo: "entregue" | "ausente";
  uri: string;
  mimeType: string;
  filename: string;
}

function getErrorMessage(e: unknown): string {
  if (e && typeof e === "object" && "response" in e) {
    const ax = e as AxiosError<{ detail?: string }>;
    const detail = ax.response?.data?.detail;
    if (detail) return typeof detail === "string" ? detail : JSON.stringify(detail);
    if (ax.response?.status) return `Erro ${ax.response.status}`;
  }
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Obtém presigned PUT, envia o arquivo ao B2 e chama PATCH /saidas/{id}/foto (append).
 * Retorna o object_key. Lança em erro de rede ou API com mensagem descritiva.
 */
export async function uploadDeliveryPhoto(params: UploadDeliveryPhotoParams): Promise<string> {
  const { id_saida, tipo, uri, mimeType, filename } = params;

  let presign: Awaited<ReturnType<typeof getPresignUpload>>;
  try {
    presign = await getPresignUpload({
      filename,
      id_saida,
      tipo,
      content_type: mimeType,
    });
  } catch (e) {
    throw new Error(getErrorMessage(e) || "Não foi possível obter permissão para envio. Verifique o servidor.");
  }

  const contentType = presign.headers["Content-Type"] ?? mimeType;

  // Ler arquivo e enviar via fetch PUT (garante que o corpo binário chega ao B2;
  // FileSystem.uploadAsync em alguns ambientes pode não enviar o body corretamente)
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bodyBytes = base64ToUint8Array(base64);

  const uploadResponse = await fetch(presign.upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: bodyBytes,
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => "");
    if (uploadResponse.status === 0 || !uploadResponse.status) {
      throw new Error(
        "Falha de rede ao enviar a foto. Verifique a internet e se o bucket está com CORS configurado para o app."
      );
    }
    if (uploadResponse.status === 403) {
      const hint =
        "Acesso negado pelo B2 (403). Verifique a Application Key: deve ser Read and Write, bucket correto e prefixo saida/.";
      throw new Error(
        text && text.length < 300 ? `Upload recusado (403): ${text.slice(0, 200)}. ${hint}` : `Upload recusado (403). ${hint}`
      );
    }
    throw new Error(
      text && text.length < 200
        ? `Upload recusado (${uploadResponse.status}): ${text}`
        : `Upload recusado (${uploadResponse.status}). Verifique CORS no bucket B2.`
    );
  }

  try {
    await patchFotoSaida(id_saida, presign.object_key, tipo);
  } catch (e) {
    throw new Error(getErrorMessage(e) || "Foto enviada, mas falha ao registrar. Tente novamente.");
  }
  return presign.object_key;
}

export { MAX_PHOTOS };
