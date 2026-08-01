import { apiClient as client } from "../../services/apiClient";
import { formatApiError } from "../../utils/formatApiError";

export interface EntradaLerResult {
  ok: boolean;
  ja_existia?: boolean;
  promovido_coleta?: boolean;
  id_saida?: number;
  codigo?: string;
  servico?: string;
  status?: string;
}

export interface EntradaLancarAvulsoResult {
  quantidade_criada: number;
  codigos: string[];
  saidas: Array<{ id_saida: number; codigo: string; servico: string; status: string }>;
  mensagem: string;
}

export interface EntradaResumoDia {
  data_ref: string;
  total: number;
  sum_shopee: number;
  sum_mercado: number;
  sum_avulso: number;
}

export async function lerEntrada(params: {
  codigo: string;
  origem?: "camera" | "manual";
  qr_payload_raw?: string;
}): Promise<EntradaLerResult> {
  const { data } = await client.post<EntradaLerResult>("/entradas/ler", {
    codigo: params.codigo,
    origem: params.origem || "camera",
    ...(params.qr_payload_raw ? { qr_payload_raw: params.qr_payload_raw } : {}),
  });
  return data;
}

/** Avulso já em NA_BASE (fluxo Registrar entrada — sem motoboy). */
export async function lancarAvulsoEntrada(params: {
  identificacao?: string | null;
  quantidade: number;
}): Promise<EntradaLancarAvulsoResult> {
  const { data } = await client.post<EntradaLancarAvulsoResult>("/entradas/lancar-avulso", {
    quantidade: params.quantidade,
    ...(params.identificacao ? { identificacao: params.identificacao } : {}),
  });
  return data;
}

/** Totais do dia na base (todos os operadores da sub_base). */
export async function getEntradaResumoDia(dataRef?: string): Promise<EntradaResumoDia> {
  const { data } = await client.get<EntradaResumoDia>("/entradas/resumo-dia", {
    params: dataRef ? { data_ref: dataRef } : undefined,
  });
  return data;
}

export function isEntradaObrigatoriaError(err: unknown): boolean {
  const anyErr = err as {
    response?: { status?: number; data?: { code?: string; detail?: { code?: string } | string } };
  };
  const data = anyErr?.response?.data;
  if (!data || typeof data !== "object") return false;
  if ((data as { code?: string }).code === "ENTRADA_OBRIGATORIA") return true;
  const detail = (data as { detail?: { code?: string } | string }).detail;
  if (detail && typeof detail === "object" && detail.code === "ENTRADA_OBRIGATORIA") return true;
  return false;
}

export function mensagemErroEntrada(err: unknown): string {
  if (isEntradaObrigatoriaError(err)) {
    return "Este pacote ainda não teve entrada na base.";
  }
  return formatApiError(err, "Não foi possível registrar a entrada.");
}
