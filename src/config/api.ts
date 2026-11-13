const PROD_API_BASE_URL = "https://track-saidas-api.onrender.com/api";
const HOMOL_API_BASE_URL = "https://rotevo-api-homol.onrender.com/api";

const appVariant = (process.env.EXPO_PUBLIC_APP_VARIANT || "").trim().toLowerCase();

/** Verdadeiro só no APK montado com a variante homol. O build de produção não define essa variável. */
export const IS_HOMOL_APP = appVariant === "homol";

/**
 * Homologação nunca cai na API de produção.
 * Se a variante é homol, a URL é fixa, mesmo que EXPO_PUBLIC_API_BASE_URL aponte para outro host.
 * Produção continua no host atual quando a variável não existe.
 */
function resolveApiBaseUrl(): string {
  if (IS_HOMOL_APP) return HOMOL_API_BASE_URL;
  const fromEnv = (process.env.EXPO_PUBLIC_API_BASE_URL || "").trim().replace(/\/+$/, "");
  return fromEnv || PROD_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();
