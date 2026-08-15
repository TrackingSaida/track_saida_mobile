import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import { getPresignUpload, patchFotoSaida } from "../features/entregas/api";
import type { AxiosError } from "axios";
import {
  AVULSO_UPLOAD_MAX_ATTEMPTS,
  AvulsoUploadError,
  backoffMs,
  classifyStorageUploadFailure,
  classifyThrownUploadError,
  formatAvulsoUploadLog,
  isTransientUploadFailure,
} from "./avulsoUploadDiagnostics";

function getAppVersionForLog(): string {
  return (
    Constants.expoConfig?.version ??
    (typeof Constants.nativeAppVersion === "string" ? Constants.nativeAppVersion : null) ??
    "?"
  );
}

function logAvulsoUpload(
  fields: Parameters<typeof formatAvulsoUploadLog>[0]
): void {
  console.info(
    formatAvulsoUploadLog({
      ...fields,
      app_version: fields.app_version ?? getAppVersionForLog(),
    })
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function getCameraLaunchOptions(): ImagePicker.ImagePickerOptions {
  return {
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.7,
    cameraType: ImagePicker.CameraType.back,
    ...(Platform.OS === "android" ? { legacy: true } : {}),
  };
}

async function openCamera(): Promise<PhotoPickResult | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Permissão de câmera negada.");
  }
  const result = await ImagePicker.launchCameraAsync(getCameraLaunchOptions());
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const filename = asset.uri.split("/").pop() || "foto.jpg";
  return {
    uri: asset.uri,
    mimeType: asset.mimeType || "image/jpeg",
    filename,
  };
}

/** Abre a câmera traseira direto no toque (sem Alert intermediário). */
export async function takeDeliveryPhoto(): Promise<PhotoPickResult | null> {
  return openCamera();
}

/** Abre a galeria para escolher foto de comprovante. */
export async function pickDeliveryPhotoFromGallery(): Promise<PhotoPickResult | null> {
  return openGallery();
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

const PHOTOS_DIR = `${FileSystem.documentDirectory}delivery_photos/`;
const B2_UPLOAD_TIMEOUT_MS = 60_000;

async function ensurePhotosDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
  }
}

/** Redimensiona, comprime e copia para URI única (evita colisão ao adicionar várias fotos). */
export async function preparePhoto(uri: string, indexHint?: number): Promise<PhotoPickResult> {
  const manipulated = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
  );
  await ensurePhotosDir();
  const suffix = indexHint ?? Date.now();
  const filename = `photo_${Date.now()}_${suffix}.jpg`;
  const dest = `${PHOTOS_DIR}${filename}`;
  await FileSystem.copyAsync({ from: manipulated.uri, to: dest });
  return {
    uri: dest,
    mimeType: "image/jpeg",
    filename,
  };
}

export async function copyPhotoToPath(sourceUri: string, destPath: string): Promise<void> {
  const parent = destPath.replace(/\/[^/]+$/, "/");
  const info = await FileSystem.getInfoAsync(parent);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(parent, { intermediates: true });
  }
  await FileSystem.copyAsync({ from: sourceUri, to: destPath });
}

export interface UploadDeliveryPhotoParams {
  id_saida: number;
  tipo: "entregue" | "ausente" | "devolucao";
  uri: string;
  mimeType: string;
  filename: string;
  photoId?: string;
  /** Se informado, só faz PATCH (sem novo PUT no B2). */
  existingObjectKey?: string;
  validarCamposObrigatorios?: boolean;
  alterarStatus?: boolean;
  /** Correlação com outbox / logs de audit no backend. */
  clientActionId?: string;
}

export interface UploadAvulsoFotoPendingParams {
  uri: string;
  mimeType: string;
  filename: string;
  photoId?: string;
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
  const {
    id_saida,
    tipo,
    uri,
    mimeType,
    filename,
    photoId,
    existingObjectKey,
    validarCamposObrigatorios = false,
    alterarStatus = true,
    clientActionId,
  } = params;

  let objectKey = (existingObjectKey || "").trim();

  if (!objectKey) {
    let presign: Awaited<ReturnType<typeof getPresignUpload>>;
    try {
      presign = await getPresignUpload({
        filename,
        id_saida,
        tipo,
        content_type: mimeType,
        photo_id: photoId,
      });
    } catch (e) {
      throw new Error(getErrorMessage(e) || "Não foi possível obter permissão para envio. Verifique o servidor.");
    }

    await putPhotoToPresignedUrl(presign, uri, mimeType);
    objectKey = presign.object_key;
  }

  try {
    const headers = clientActionId
      ? { "X-Client-Action-Id": clientActionId }
      : undefined;
    await patchFotoSaida(
      id_saida,
      objectKey,
      tipo,
      validarCamposObrigatorios,
      alterarStatus,
      photoId,
      headers
    );
  } catch (e) {
    throw new Error(getErrorMessage(e) || "Foto enviada, mas falha ao registrar. Tente novamente.");
  }
  return objectKey;
}

async function putPhotoToPresignedUrl(
  presign: Awaited<ReturnType<typeof getPresignUpload>>,
  uri: string,
  mimeType: string,
  opts?: { attempt?: number; photoId?: string; logAsAvulso?: boolean }
): Promise<void> {
  const contentType = presign.headers["Content-Type"] ?? mimeType;
  const started = Date.now();

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const bodyBytes = base64ToUint8Array(base64);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), B2_UPLOAD_TIMEOUT_MS);
  let uploadResponse: Response;
  try {
    uploadResponse = await fetch(presign.upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: bodyBytes.buffer.slice(
        bodyBytes.byteOffset,
        bodyBytes.byteOffset + bodyBytes.byteLength
      ) as ArrayBuffer,
      signal: controller.signal,
    });
  } catch (e) {
    if (opts?.logAsAvulso) {
      logAvulsoUpload({
        stage: "storage_upload",
        attempt: opts.attempt,
        status: e instanceof Error && e.name === "AbortError" ? "timeout" : "network",
        duration_ms: Date.now() - started,
        object_key: presign.object_key,
        photo_id: opts.photoId,
        code: e instanceof Error && e.name === "AbortError" ? "TIMEOUT" : "NETWORK",
      });
    }
    if (e instanceof Error && e.name === "AbortError") {
      throw new AvulsoUploadError({
        message:
          "O envio da foto demorou mais que o esperado.\nTente novamente.",
        stage: "storage_upload",
        code: "TIMEOUT",
        retryable: true,
        attempt: opts?.attempt,
      });
    }
    throw classifyThrownUploadError(e, "storage_upload");
  } finally {
    clearTimeout(timeoutId);
  }

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text().catch(() => "");
    const classified = classifyStorageUploadFailure(uploadResponse.status, text);
    if (opts?.logAsAvulso) {
      logAvulsoUpload({
        stage: "storage_upload",
        attempt: opts.attempt,
        status: uploadResponse.status,
        storage_code: classified.storageCode,
        duration_ms: Date.now() - started,
        object_key: presign.object_key,
        photo_id: opts.photoId,
        code: classified.code,
      });
    }
    throw new AvulsoUploadError({
      message: classified.message,
      stage: "storage_upload",
      code: classified.code,
      httpStatus: uploadResponse.status,
      storageCode: classified.storageCode,
      retryable: classified.retryable,
      attempt: opts?.attempt,
    });
  }

  if (opts?.logAsAvulso) {
    logAvulsoUpload({
      stage: "storage_upload",
      attempt: opts.attempt,
      status: uploadResponse.status,
      duration_ms: Date.now() - started,
      object_key: presign.object_key,
      photo_id: opts.photoId,
      code: "OK",
    });
  }
}

/**
 * Presign sem id_saida, envia ao B2 e retorna object_key (sem PATCH /saidas).
 * Retry só para falhas transitórias; nova URL pré-assinada a cada tentativa.
 */
export async function uploadAvulsoFotoPending(params: UploadAvulsoFotoPendingParams): Promise<string> {
  const { uri, mimeType, filename, photoId } = params;
  let lastError: AvulsoUploadError | null = null;

  for (let attempt = 1; attempt <= AVULSO_UPLOAD_MAX_ATTEMPTS; attempt++) {
    let presign: Awaited<ReturnType<typeof getPresignUpload>>;
    const presignStarted = Date.now();
    try {
      presign = await getPresignUpload({
        filename,
        tipo: "lancar_avulso",
        content_type: mimeType,
        photo_id: photoId,
      });
      logAvulsoUpload({
        stage: "presign",
        attempt,
        status: 200,
        duration_ms: Date.now() - presignStarted,
        object_key: presign.object_key,
        photo_id: photoId,
        code: "OK",
      });
    } catch (e) {
      const classified = classifyThrownUploadError(e, "presign");
      logAvulsoUpload({
        stage: "presign",
        attempt,
        status: classified.httpStatus ?? "error",
        duration_ms: Date.now() - presignStarted,
        photo_id: photoId,
        code: classified.code,
      });
      lastError = classified;
      if (
        !isTransientUploadFailure({
          stage: "presign",
          httpStatus: classified.httpStatus,
          code: classified.code,
          networkLike: classified.code === "NETWORK",
          timeoutLike: classified.code === "TIMEOUT",
        }) ||
        attempt >= AVULSO_UPLOAD_MAX_ATTEMPTS
      ) {
        throw classified;
      }
      await sleep(backoffMs(attempt));
      continue;
    }

    try {
      await putPhotoToPresignedUrl(presign, uri, mimeType, {
        attempt,
        photoId,
        logAsAvulso: true,
      });
      return presign.object_key;
    } catch (e) {
      const classified = classifyThrownUploadError(e, "storage_upload");
      lastError = classified;
      if (
        !classified.retryable ||
        !isTransientUploadFailure({
          stage: "storage_upload",
          httpStatus: classified.httpStatus,
          code: classified.code,
          networkLike: classified.code === "NETWORK",
          timeoutLike: classified.code === "TIMEOUT",
        }) ||
        attempt >= AVULSO_UPLOAD_MAX_ATTEMPTS
      ) {
        throw classified;
      }
      await sleep(backoffMs(attempt));
    }
  }

  throw (
    lastError ??
    new AvulsoUploadError({
      message: "Não foi possível enviar a foto agora.\nVerifique sua conexão e tente novamente.",
      stage: "storage_upload",
      code: "STORAGE_TEMPORARY_ERROR",
      retryable: true,
    })
  );
}

/** Atalho: preparePhoto + uploadAvulsoFotoPending. Exportado para fluxos staff (LeituraSaidas). */
export async function uploadPendingAvulsoPhoto(uri: string, photoId?: string): Promise<string> {
  const prepared = await preparePhoto(uri);
  return uploadAvulsoFotoPending({
    uri: prepared.uri,
    mimeType: prepared.mimeType,
    filename: prepared.filename,
    photoId,
  });
}

export { MAX_PHOTOS };
