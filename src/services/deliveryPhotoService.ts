import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import { API_BASE_URL } from "../config/api";
import { useAuthStore } from "../store/authStore";
import { patchFotoSaida } from "../features/entregas/api";

const MAX_PHOTOS = 3;

function getAuthHeaders(): Record<string, string> {
  const token = useAuthStore.getState().token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

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

/**
 * Obtém presigned PUT, envia o arquivo ao B2 e chama PATCH /saidas/{id}/foto (append).
 * Retorna o object_key. Lança em erro de rede ou API.
 */
export async function uploadDeliveryPhoto(params: UploadDeliveryPhotoParams): Promise<string> {
  const { id_saida, tipo, uri, mimeType, filename } = params;
  const headers = getAuthHeaders();

  const presignRes = await fetch(`${API_BASE_URL}/upload/presign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      filename,
      id_saida,
      tipo,
      content_type: mimeType,
    }),
  });
  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(err.detail || `Presign falhou: ${presignRes.status}`);
  }
  const presign = (await presignRes.json()) as {
    upload_url: string;
    object_key: string;
    headers: { "Content-Type"?: string };
  };

  const uploadHeaders: Record<string, string> = {
    ...(presign.headers["Content-Type"] ? { "Content-Type": presign.headers["Content-Type"] } : { "Content-Type": mimeType }),
  };

  const uploadResult = await FileSystem.uploadAsync(presign.upload_url, uri, {
    httpMethod: "PUT",
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: uploadHeaders,
  });

  if (uploadResult.status < 200 || uploadResult.status >= 300) {
    throw new Error(`Upload falhou: ${uploadResult.status}`);
  }

  await patchFotoSaida(id_saida, presign.object_key, tipo);
  return presign.object_key;
}

export { MAX_PHOTOS };
