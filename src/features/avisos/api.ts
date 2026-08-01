import { apiClient } from "../../services/apiClient";

export type AvisoItem = {
  id: number;
  titulo: string;
  mensagem: string;
  prioridade: string;
  criado_em?: string | null;
  lido: boolean;
  lido_em?: string | null;
};

export type AvisoAdminOut = {
  id: number;
  sub_base: string;
  titulo: string;
  mensagem: string;
  prioridade: string;
  criado_em?: string | null;
  destinatarios_count: number;
};

export async function listAvisos(): Promise<AvisoItem[]> {
  const { data } = await apiClient.get<AvisoItem[]>("/mobile/avisos");
  return data || [];
}

export async function listUrgentesPendentes(): Promise<AvisoItem[]> {
  const { data } = await apiClient.get<AvisoItem[]>("/mobile/avisos/urgentes-pendentes");
  return data || [];
}

export async function getAviso(id: number): Promise<AvisoItem> {
  const { data } = await apiClient.get<AvisoItem>(`/mobile/avisos/${id}`);
  return data;
}

export async function marcarAvisoLido(id: number): Promise<void> {
  await apiClient.post(`/mobile/avisos/${id}/lido`);
}

export async function criarAviso(payload: {
  titulo: string;
  mensagem: string;
  prioridade: "normal" | "urgente";
  motoboy_ids?: number[];
  todos_ativos?: boolean;
}): Promise<AvisoAdminOut> {
  const { data } = await apiClient.post<AvisoAdminOut>("/avisos", payload);
  return data;
}

export async function listAvisosAdmin(): Promise<AvisoAdminOut[]> {
  const { data } = await apiClient.get<AvisoAdminOut[]>("/avisos");
  return data || [];
}
