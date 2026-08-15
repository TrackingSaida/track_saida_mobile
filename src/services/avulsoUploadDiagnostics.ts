/**
 * Diagnóstico, mensagens amigáveis e retry para upload de foto no Lançar Avulso.
 * Funções puras — testáveis sem React Native.
 */

export type AvulsoUploadStage =
  | "validation"
  | "presign"
  | "storage_upload"
  | "photo_register"
  | "avulso_create"
  | "unknown";

export type AvulsoUploadErrorCode =
  | "VALIDATION"
  | "SESSION_EXPIRED"
  | "STORAGE_TEMPORARY_ERROR"
  | "STORAGE_FORBIDDEN"
  | "STORAGE_CLIENT_ERROR"
  | "NETWORK"
  | "TIMEOUT"
  | "API_ERROR"
  | "UNKNOWN";

export class AvulsoUploadError extends Error {
  readonly stage: AvulsoUploadStage;
  readonly code: AvulsoUploadErrorCode;
  readonly httpStatus?: number;
  readonly storageCode?: string;
  readonly retryable: boolean;
  readonly attempt?: number;

  constructor(params: {
    message: string;
    stage: AvulsoUploadStage;
    code: AvulsoUploadErrorCode;
    httpStatus?: number;
    storageCode?: string;
    retryable?: boolean;
    attempt?: number;
  }) {
    super(params.message);
    this.name = "AvulsoUploadError";
    this.stage = params.stage;
    this.code = params.code;
    this.httpStatus = params.httpStatus;
    this.storageCode = params.storageCode;
    this.retryable = params.retryable ?? false;
    this.attempt = params.attempt;
  }
}

const TRANSIENT_HTTP = new Set([408, 429, 500, 502, 503, 504]);

/** Extrai Code/Message de XML de erro S3/B2 sem expor o XML ao usuário. */
export function parseStorageErrorXml(text: string): {
  code?: string;
  message?: string;
} {
  const raw = (text || "").trim();
  if (!raw || !raw.includes("<")) return {};
  const code = raw.match(/<Code>\s*([^<]+)\s*<\/Code>/i)?.[1]?.trim();
  const message = raw.match(/<Message>\s*([^<]+)\s*<\/Message>/i)?.[1]?.trim();
  return {
    ...(code ? { code } : {}),
    ...(message ? { message } : {}),
  };
}

export function isTransientHttpStatus(status?: number | null): boolean {
  if (status == null || !Number.isFinite(status)) return false;
  return TRANSIENT_HTTP.has(status);
}

export function isTransientUploadFailure(params: {
  stage: AvulsoUploadStage;
  httpStatus?: number;
  code?: AvulsoUploadErrorCode;
  networkLike?: boolean;
  timeoutLike?: boolean;
}): boolean {
  if (params.timeoutLike || params.code === "TIMEOUT") return true;
  if (params.networkLike || params.code === "NETWORK") return true;
  if (params.code === "STORAGE_TEMPORARY_ERROR") return true;
  if (params.stage === "storage_upload" || params.stage === "presign") {
    return isTransientHttpStatus(params.httpStatus);
  }
  if (params.stage === "avulso_create" || params.stage === "photo_register") {
    return isTransientHttpStatus(params.httpStatus) || !!params.networkLike;
  }
  return false;
}

export function friendlyAvulsoUploadMessage(err: {
  stage?: AvulsoUploadStage;
  code?: AvulsoUploadErrorCode;
  httpStatus?: number;
  message?: string;
}): string {
  const code = err.code;
  if (code === "SESSION_EXPIRED" || err.httpStatus === 401) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  if (code === "VALIDATION") {
    return err.message?.trim() || "Dados inválidos. Verifique e tente novamente.";
  }
  if (code === "TIMEOUT") {
    return "O envio da foto demorou mais que o esperado.\nTente novamente.";
  }
  if (code === "NETWORK" || code === "STORAGE_TEMPORARY_ERROR") {
    return "Não foi possível enviar a foto agora.\nVerifique sua conexão e tente novamente.";
  }
  if (code === "STORAGE_FORBIDDEN") {
    return "Não foi possível enviar a foto (acesso negado ao armazenamento).\nTente novamente ou fale com o suporte.";
  }
  if (err.stage === "avulso_create") {
    return "A foto foi enviada, mas não foi possível concluir o lançamento.\nTente novamente.";
  }
  if (err.stage === "presign") {
    return "Não foi possível preparar o envio da foto.\nVerifique sua conexão e tente novamente.";
  }
  return "Não foi possível enviar a foto agora.\nVerifique sua conexão e tente novamente.";
}

/** Remove XML/HTML técnico e mensagens cruas de rede. */
export function sanitizeTechnicalErrorText(text: string): string {
  const t = (text || "").trim();
  if (!t) return "";
  if (/<\?xml/i.test(t) || /<Error>/i.test(t) || /<\/Error>/i.test(t)) {
    const parsed = parseStorageErrorXml(t);
    if (parsed.code || parsed.message) {
      return [parsed.code, parsed.message].filter(Boolean).join(": ");
    }
    return "Falha temporária no armazenamento";
  }
  if (/^network\s*error$/i.test(t) || /network request failed/i.test(t)) {
    return "Falha de rede";
  }
  return t.length > 180 ? `${t.slice(0, 177)}...` : t;
}

export function classifyStorageUploadFailure(
  status: number,
  bodyText: string
): {
  code: AvulsoUploadErrorCode;
  storageCode?: string;
  retryable: boolean;
  message: string;
} {
  const parsed = parseStorageErrorXml(bodyText);
  const storageCode = parsed.code;
  if (status === 403) {
    return {
      code: "STORAGE_FORBIDDEN",
      storageCode,
      retryable: false,
      message: friendlyAvulsoUploadMessage({ code: "STORAGE_FORBIDDEN", stage: "storage_upload" }),
    };
  }
  if (isTransientHttpStatus(status) || storageCode === "InternalError" || storageCode === "ServiceUnavailable") {
    return {
      code: "STORAGE_TEMPORARY_ERROR",
      storageCode,
      retryable: true,
      message: friendlyAvulsoUploadMessage({
        code: "STORAGE_TEMPORARY_ERROR",
        stage: "storage_upload",
      }),
    };
  }
  if (status >= 400 && status < 500) {
    return {
      code: "STORAGE_CLIENT_ERROR",
      storageCode,
      retryable: false,
      message: friendlyAvulsoUploadMessage({ stage: "storage_upload", code: "STORAGE_CLIENT_ERROR" }),
    };
  }
  return {
    code: "STORAGE_TEMPORARY_ERROR",
    storageCode,
    retryable: true,
    message: friendlyAvulsoUploadMessage({
      code: "STORAGE_TEMPORARY_ERROR",
      stage: "storage_upload",
    }),
  };
}

export function classifyThrownUploadError(
  e: unknown,
  stage: AvulsoUploadStage
): AvulsoUploadError {
  if (e instanceof AvulsoUploadError) return e;

  const msg = e instanceof Error ? e.message : String(e ?? "");
  const name = e instanceof Error ? e.name : "";
  const axiosLike =
    e && typeof e === "object"
      ? (e as {
          response?: { status?: number; data?: { detail?: unknown } };
          code?: string;
          message?: string;
        })
      : null;
  const httpStatus = axiosLike?.response?.status;
  const axiosCode = axiosLike?.code;

  if (name === "AbortError" || /tempo esgotado|timeout|aborted/i.test(msg)) {
    return new AvulsoUploadError({
      message: friendlyAvulsoUploadMessage({ code: "TIMEOUT", stage }),
      stage,
      code: "TIMEOUT",
      httpStatus,
      retryable: true,
    });
  }

  if (httpStatus === 401) {
    return new AvulsoUploadError({
      message: friendlyAvulsoUploadMessage({ code: "SESSION_EXPIRED", httpStatus: 401 }),
      stage,
      code: "SESSION_EXPIRED",
      httpStatus: 401,
      retryable: false,
    });
  }

  const networkLike =
    axiosCode === "ERR_NETWORK" ||
    axiosCode === "ECONNABORTED" ||
    (!httpStatus &&
      (/network\s*error/i.test(msg) ||
        /network request failed/i.test(msg) ||
        /failed to fetch/i.test(msg)));

  if (networkLike) {
    return new AvulsoUploadError({
      message: friendlyAvulsoUploadMessage({ code: "NETWORK", stage }),
      stage,
      code: "NETWORK",
      retryable: true,
    });
  }

  if (isTransientHttpStatus(httpStatus)) {
    return new AvulsoUploadError({
      message: friendlyAvulsoUploadMessage({
        code: "STORAGE_TEMPORARY_ERROR",
        stage,
        httpStatus,
      }),
      stage,
      code: stage === "presign" || stage === "storage_upload" ? "STORAGE_TEMPORARY_ERROR" : "API_ERROR",
      httpStatus,
      retryable: true,
    });
  }

  const detail = axiosLike?.response?.data?.detail;
  let detailMsg = "";
  if (typeof detail === "string") detailMsg = detail;
  else if (detail && typeof detail === "object" && "message" in detail) {
    detailMsg = String((detail as { message?: unknown }).message ?? "");
  }

  const cleaned = sanitizeTechnicalErrorText(detailMsg || msg);
  return new AvulsoUploadError({
    message:
      stage === "avulso_create"
        ? friendlyAvulsoUploadMessage({ stage: "avulso_create", code: "API_ERROR" })
        : cleaned && cleaned !== "Falha de rede"
          ? friendlyAvulsoUploadMessage({ stage, code: "API_ERROR" })
          : friendlyAvulsoUploadMessage({ code: "NETWORK", stage }),
    stage,
    code: "API_ERROR",
    httpStatus,
    retryable: false,
  });
}

export function backoffMs(attempt: number, baseMs = 700): number {
  const n = Math.max(1, attempt);
  return Math.min(baseMs * Math.pow(2, n - 1), 4000);
}

export function summarizeObjectKey(key?: string | null): string {
  const k = (key || "").trim();
  if (!k) return "-";
  if (k.length <= 24) return k;
  return `${k.slice(0, 10)}…${k.slice(-10)}`;
}

export type AvulsoUploadLogFields = {
  stage: AvulsoUploadStage;
  attempt?: number;
  status?: number | string;
  storage_code?: string;
  duration_ms?: number;
  object_key?: string;
  photo_id?: string;
  code?: string;
  app_version?: string;
};

export function formatAvulsoUploadLog(fields: AvulsoUploadLogFields): string {
  const parts = [
    "[AVULSO_UPLOAD]",
    `stage=${fields.stage}`,
    fields.attempt != null ? `attempt=${fields.attempt}` : null,
    fields.status != null ? `status=${fields.status}` : null,
    fields.code ? `code=${fields.code}` : null,
    fields.storage_code ? `storage_code=${fields.storage_code}` : null,
    fields.duration_ms != null ? `duration_ms=${fields.duration_ms}` : null,
    fields.object_key ? `key=${summarizeObjectKey(fields.object_key)}` : null,
    fields.photo_id ? `photo_id=${fields.photo_id}` : null,
    fields.app_version ? `app=${fields.app_version}` : null,
  ].filter(Boolean);
  return parts.join(" ");
}

export const AVULSO_UPLOAD_MAX_ATTEMPTS = 3;
