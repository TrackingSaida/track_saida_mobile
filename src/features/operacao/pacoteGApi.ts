import { isAxiosError } from "axios";
import { apiClient as client } from "../../services/apiClient";
import { formatApiError } from "../../utils/formatApiError";

export interface CategoriaG {
  id: number;
  nome: string;
  descricao?: string | null;
  ordem?: number;
  ativo?: boolean;
}

let cacheCategorias: { em: number; itens: CategoriaG[] } | null = null;
const CACHE_MS = 5 * 60 * 1000;

/** Categorias ativas da sub_base (nome/descrição; valores ficam só para admin). */
export async function listarCategoriasG(force = false): Promise<CategoriaG[]> {
  if (!force && cacheCategorias && Date.now() - cacheCategorias.em < CACHE_MS) {
    return cacheCategorias.itens;
  }
  const { data } = await client.get<CategoriaG[]>("/entregadores/precos/categorias-g");
  const itens = (Array.isArray(data) ? data : [])
    .filter((c) => c && c.ativo !== false)
    .sort((a, b) => Number(a.ordem ?? 0) - Number(b.ordem ?? 0));
  cacheCategorias = { em: Date.now(), itens };
  return itens;
}

export interface TamanhoPacoteResult {
  categoria_g_id: number | null;
  categoria_g_nome: string | null;
}

/** Define o tamanho do pacote: categoria G ou `null` para Normal. */
export async function definirTamanhoPacote(
  idSaida: number,
  categoriaId: number | null
): Promise<TamanhoPacoteResult> {
  try {
    const { data } = await client.patch<Partial<TamanhoPacoteResult>>(`/saidas/${idSaida}`, {
      categoria_g_id: categoriaId,
    });
    return {
      categoria_g_id: data?.categoria_g_id ?? categoriaId,
      categoria_g_nome: data?.categoria_g_nome ?? null,
    };
  } catch (err) {
    throw new Error(mensagemErroTamanho(err));
  }
}

function mensagemErroTamanho(err: unknown): string {
  if (isAxiosError(err)) {
    const status = err.response?.status;
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    const code = detail && typeof detail === "object" ? (detail as { code?: string }).code : undefined;
    if (status === 403) return "Você não tem permissão para alterar o tamanho do pacote.";
    if (code === "STATUS_FINALIZADO") {
      return "Pacotes entregues/cancelados não podem mudar de tamanho.";
    }
  }
  return formatApiError(err, "Não foi possível alterar o tamanho do pacote.");
}
