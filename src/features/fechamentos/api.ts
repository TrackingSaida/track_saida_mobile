import { apiClient } from "../../services/apiClient";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useAuthStore } from "../../store/authStore";
import { API_BASE_URL } from "../../config/api";

export type FechamentoItem = {
  id_fechamento: number;
  codigo: string;
  periodo_inicio: string;
  periodo_fim: string;
  valor_base: number | string;
  valor_entregas: number | string;
  valor_coletas: number | string;
  qtd_dias_coleta: number;
  valor_adicao: number | string;
  valor_subtracao: number | string;
  valor_final: number | string;
  motivo_adicao?: string | null;
  motivo_subtracao?: string | null;
  status: string;
  chave_pix?: string | null;
  criado_em?: string | null;
  tem_pdf: boolean;
};

export async function listFechamentos(): Promise<FechamentoItem[]> {
  const { data } = await apiClient.get<FechamentoItem[]>("/mobile/fechamentos");
  return data || [];
}

export async function getFechamento(id: number): Promise<FechamentoItem> {
  const { data } = await apiClient.get<FechamentoItem>(`/mobile/fechamentos/${id}`);
  return data;
}

export async function downloadFechamentoPdf(id: number, codigo: string): Promise<void> {
  const token = useAuthStore.getState().token;
  const url = `${API_BASE_URL}/mobile/fechamentos/${id}/pdf`;
  const dest = `${FileSystem.cacheDirectory || ""}${codigo || `fechamento_${id}`}.pdf`;
  const result = await FileSystem.downloadAsync(url, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Baixar fechamento",
    });
  }
}
