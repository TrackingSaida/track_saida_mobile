import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystem from "expo-file-system/legacy";
import Constants from "expo-constants";
import { getPresignUpload, patchFotoSaida } from "../features/entregas/api";
import type { AxiosError } from "axios";
import { usePhotoCaptureStore } from "../store/photoCaptureStore";
import {
  PREPARE_MAX_WIDTH,
  shouldSkipImageResize,
  type PhotoPickResult,
} from "./photoFlowUtils";
import {
  AVULSO_UPLOAD_MAX_ATTEMPTS,
  AvulsoUploadError,
  backoffMs,
  classifyStorageUploadFailure,
  classifyThrownUploadError,
  formatAvulsoUploadLog,
  isTransientUploadFailure,
} from "./avulsoUploadDiagnostics";

export type { PhotoPickResult };

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

const MAX_PHOTOS = 3;

export type PhotoSource = "camera" | "gallery";

/** Abre ActionSheet: Tirar foto | Galeria | Cancelar. Retorna resultado ou null se cancelar. */
export async function selectOrTakePhoto(): Promise<PhotoPickResult | null> {
  const { Alert } = await import("react-native");
  return new Promise((resolve) => {
    Alert.alert("Adicionar foto", "Escolha uma opção", [
      {
        text: "Tirar foto",
        onPress: () => takeDeliveryPhoto().then(resolve),
      },
      {
        text: "Galeria",
        onPress: () => openGallery().then(resolve),
      },
      { text: "Cancelar", style: "cancel", onPress: () => resolve(null) },
    ]);
  });
}

/** Captura in-app (não abre a câmera do sistema) e persiste o JPEG em disco. */
export async function takeDeliveryPhoto(): Promise<PhotoPickResult | null> {
  try {
    const captured = await usePhotoCaptureStore.getState().requestCapture();
    if (!captured) return null;
    return await preparePhoto(captured.uri);
  } finally {
    usePhotoCaptureStore.getState().releaseHardware();
  }
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
    quality: 0.7,
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

function uniquePhotoFilename(indexHint?: number): string {
  return `photo_${Date.now()}_${indexHint ?? 0}.jpg`;
}

/** Copia a captura imediatamente para o armazenamento do app (sobrevive se o processo morrer). */
export async function persistCapturedPhoto(uri: string): Promise<PhotoPickResult> {
  await ensurePhotosDir();
  const filename = `capture_${Date.now()}.jpg`;
  const dest = `${PHOTOS_DIR}${filename}`;
  if (uri === dest) {
    return { uri: dest, mimeType: "image/jpeg", filename };
  }
  await FileSystem.copyAsync({ from: uri, to: dest });
  return {
    uri: dest,
    mimeType: "image/jpeg",
    filename,
  };
}

async function fileSizeBytes(uri: string): Promise<number | undefined> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && "size" in info && typeof info.size === "number") return info.size;
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Redimensiona se necessário e copia para URI única. Se o resize falhar, usa o arquivo original. */
export async function preparePhoto(uri: string, indexHint?: number): Promise<PhotoPickResult> {
  await ensurePhotosDir();
  const filename = uniquePhotoFilename(indexHint);
  const dest = `${PHOTOS_DIR}${filename}`;
  const size = await fileSizeBytes(uri);

  const copyOriginal = async () => {
    if (uri === dest) return;
    await FileSystem.copyAsync({ from: uri, to: dest });
  };

  if (shouldSkipImageResize(size)) {
    await copyOriginal();
    return { uri: dest, mimeType: "image/jpeg", filename };
  }

  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: PREPARE_MAX_WIDTH } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );
    await FileSystem.copyAsync({ from: manipulated.uri, to: dest });
  } catch (e) {
    console.warn("[preparePhoto] resize falhou, usando arquivo em disco", e);
    await copyOriginal();
  }
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

  const timeoutError = Object.assign(new Error("timeout"), { name: "AbortError" });
  try {
    const result = await Promise.race([
      FileSystem.uploadAsync(presign.upload_url, uri, {
        httpMethod: "PUT",
        headers: { "Content-Type": contentType },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      }),
      sleep(B2_UPLOAD_TIMEOUT_MS).then(() => {
        throw timeoutError;
      }),
    ]);

    if (result.status < 200 || result.status >= 300) {
      const classified = classifyStorageUploadFailure(result.status, "");
      if (opts?.logAsAvulso) {
        logAvulsoUpload({
          stage: "storage_upload",
          attempt: opts.attempt,
          status: result.status,
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
        httpStatus: result.status,
        storageCode: classified.storageCode,
        retryable: classified.retryable,
        attempt: opts?.attempt,
      });
    }

    if (opts?.logAsAvulso) {
      logAvulsoUpload({
        stage: "storage_upload",
        attempt: opts.attempt,
        status: result.status,
        duration_ms: Date.now() - started,
        object_key: presign.object_key,
        photo_id: opts.photoId,
        code: "OK",
      });
    }
  } catch (e) {
    if (e instanceof AvulsoUploadError) throw e;
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
