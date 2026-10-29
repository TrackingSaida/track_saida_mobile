import { CATEGORIA_LABEL, ORDEM_CATEGORIAS, type CategoriaTutorial, type Tutorial } from "./types";

export function normalizarBusca(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function formatarDuracao(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

export function duracaoPorExtenso(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const minutos = Math.floor(total / 60);
  const resto = total % 60;
  const partes: string[] = [];
  if (minutos === 1) partes.push("1 minuto");
  else if (minutos > 1) partes.push(`${minutos} minutos`);
  if (resto === 1) partes.push("1 segundo");
  else if (resto > 1) partes.push(`${resto} segundos`);
  return partes.join(" e ") || "0 segundos";
}

export function normalizarPapel(role: unknown): number | undefined {
  if (typeof role === "number" && Number.isFinite(role)) return Math.trunc(role);
  if (typeof role === "string" && /^\d+$/.test(role.trim())) return Number(role.trim());
  return undefined;
}

export function tutoriaisDoPerfil(itens: Tutorial[], role: number | undefined): Tutorial[] {
  if (typeof role !== "number" || !Number.isFinite(role)) return [];
  return itens.filter((item) => item.ativo && item.perfis.includes(role));
}

export function categoriasVisiveis(itens: Tutorial[]): CategoriaTutorial[] {
  return ORDEM_CATEGORIAS.filter((categoria) => itens.some((item) => item.categoria === categoria));
}

export function filtrarTutoriais(
  itens: Tutorial[],
  filtro: { categoria: CategoriaTutorial | "todos"; busca: string }
): Tutorial[] {
  const consulta = normalizarBusca(filtro.busca);
  return itens.filter((item) => {
    if (filtro.categoria !== "todos" && item.categoria !== filtro.categoria) return false;
    if (!consulta) return true;
    const rotulo = CATEGORIA_LABEL[item.categoria];
    return [item.titulo, item.descricao, rotulo].some((parte) => normalizarBusca(parte).includes(consulta));
  });
}
