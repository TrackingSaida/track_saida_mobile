export type CategoriaTutorial = "rotas" | "entregas" | "coletas";

export type Tutorial = {
  id: string;
  serie: string;
  episodio: number;
  titulo: string;
  descricao: string;
  youtubeVideoId: string;
  categoria: CategoriaTutorial;
  duracaoSegundos: number;
  ordem: number;
  ativo: boolean;
  publicadoEm: string;
  /** Papéis do JWT que podem ver o tutorial. 4 = motoboy. */
  perfis: number[];
};

export const CATEGORIA_LABEL: Record<CategoriaTutorial, string> = {
  rotas: "Rotas",
  entregas: "Entregas",
  coletas: "Coletas",
};

export const ORDEM_CATEGORIAS: CategoriaTutorial[] = ["rotas", "entregas", "coletas"];
