import type { Tutorial } from "./types";

/**
 * Catálogo local do MVP. Não é uma API e não simula resposta de backend.
 * A troca futura é substituir listarTutoriais() por um GET global, sem filtro de sub_base.
 */
const CATALOGO: Tutorial[] = [
  {
    id: "rotevo-ensina-ep-01",
    serie: "ROTEVO Ensina",
    episodio: 1,
    titulo: "Como preparar sua rota de entregas",
    descricao:
      "Aprenda a configurar a preparação de rota, registrar endereços dos pacotes e organizar suas entregas.",
    youtubeVideoId: "1Omc16c6088",
    categoria: "rotas",
    duracaoSegundos: 97,
    ordem: 1,
    ativo: true,
    publicadoEm: "2026-10-29",
    perfis: [4],
  },
];

export function listarTutoriais(): Tutorial[] {
  return CATALOGO.filter((item) => item.ativo)
    .slice()
    .sort((a, b) => a.ordem - b.ordem || a.episodio - b.episodio);
}
