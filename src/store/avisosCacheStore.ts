import { create } from "zustand";
import type { AvisoItem } from "../features/avisos/api";

type AvisosCacheState = {
  byId: Record<number, AvisoItem>;
  upsert: (item: AvisoItem) => void;
  get: (id: number) => AvisoItem | undefined;
  list: () => AvisoItem[];
};

function mergeAviso(prev: AvisoItem | undefined, next: AvisoItem): AvisoItem {
  return {
    id: next.id,
    titulo: next.titulo || prev?.titulo || "",
    mensagem: next.mensagem || prev?.mensagem || "",
    prioridade: next.prioridade || prev?.prioridade || "normal",
    criado_em: next.criado_em ?? prev?.criado_em,
    lido: next.lido ?? prev?.lido ?? false,
    lido_em: next.lido_em ?? prev?.lido_em,
  };
}

export function avisoFromPushData(data: Record<string, unknown> | null | undefined): AvisoItem | null {
  if (!data) return null;
  const id = Number(data.aviso_id);
  if (!Number.isFinite(id) || id <= 0) return null;
  const titulo = String(data.titulo ?? data.title ?? "").trim();
  const mensagem = String(data.mensagem ?? data.body ?? "").trim();
  const prioridade = String(data.prioridade || "").toLowerCase() === "urgente" ? "urgente" : "normal";
  return {
    id,
    titulo,
    mensagem,
    prioridade,
    lido: false,
  };
}

export const useAvisosCacheStore = create<AvisosCacheState>((set, get) => ({
  byId: {},
  upsert: (item) =>
    set((state) => ({
      byId: {
        ...state.byId,
        [item.id]: mergeAviso(state.byId[item.id], item),
      },
    })),
  get: (id) => get().byId[id],
  list: () => Object.values(get().byId),
}));
