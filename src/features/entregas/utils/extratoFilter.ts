import type { ExtratoDiaItem, ExtratoFinanceiro, ExtratoPedidoItem, ExtratoStatusFiltro } from "../types";

export type ServicoExtrato = "Shopee" | "Flex" | "Avulso";

const GRUPO_ENTREGUE_STATUS = new Set(["SAIU_PARA_ENTREGA", "EM_ROTA", "ENTREGUE", "SAIU"]);

export function normalizeExtratoServico(servico: string): ServicoExtrato {
  const s = (servico || "").trim().toLowerCase();
  if (s.includes("shopee")) return "Shopee";
  if (s.includes("flex") || s.includes("mercado") || s.includes("ml")) return "Flex";
  return "Avulso";
}

export function valorExtratoPorFiltro(
  feitos: number,
  cancelados: number,
  modo?: ExtratoStatusFiltro | string
): number {
  const key = String(modo || "grupo_entregue").trim().toLowerCase();
  if (key === "todos") return feitos + cancelados;
  if (key === "cancelados") return cancelados;
  return feitos - cancelados;
}

export function isExtratoCancelado(item: ExtratoPedidoItem): boolean {
  const status = String(item.status || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  const exibicao = String(item.exibicao || "").trim().toLowerCase();
  return status.includes("CANCEL") || exibicao.includes("cancel");
}

export function isExtratoGrupoEntregue(item: ExtratoPedidoItem): boolean {
  const status = String(item.status || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");
  if (GRUPO_ENTREGUE_STATUS.has(status)) return true;
  const exibicao = String(item.exibicao || "").trim().toLowerCase();
  return exibicao === "entregue" || exibicao === "pendente";
}

function parseValorItem(valor?: string | number): number {
  const n = Number.parseFloat(String(valor ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function sumValorItens(itens: ExtratoPedidoItem[]): number {
  return itens.reduce((acc, it) => acc + parseValorItem(it.valor), 0);
}

function formatValorSum(total: number): string {
  return total.toFixed(2);
}

function filterByServico(
  itens: ExtratoPedidoItem[] | undefined,
  servicos: Set<ServicoExtrato>
): ExtratoPedidoItem[] {
  return (itens ?? []).filter((it) => servicos.has(normalizeExtratoServico(it.servico)));
}

function bumpResumo(
  resumo: { shopee: number; flex: number; avulso: number },
  itens: ExtratoPedidoItem[]
): void {
  for (const it of itens) {
    const tipo = normalizeExtratoServico(it.servico);
    if (tipo === "Shopee") resumo.shopee += 1;
    else if (tipo === "Flex") resumo.flex += 1;
    else resumo.avulso += 1;
  }
}

export function filterExtratoByServicos(
  extrato: ExtratoFinanceiro,
  servicosAtivos: Set<ServicoExtrato>
): ExtratoFinanceiro {
  if (servicosAtivos.size === 0) return extrato;

  const modo = extrato.status_filtro;
  const canceladosPeriodo = filterByServico(extrato.itens_cancelados, servicosAtivos);
  const dias: ExtratoDiaItem[] = [];
  let totalPacotes = 0;
  let feitosTotal = 0;
  let canceladosDaLista = 0;
  const resumo = { shopee: 0, flex: 0, avulso: 0 };

  for (const dia of extrato.dias) {
    const itens = filterByServico(dia.itens, servicosAtivos);
    if (itens.length === 0) continue;

    const feitosDia = sumValorItens(itens.filter(isExtratoGrupoEntregue));
    const canceladosDiaLista = sumValorItens(itens.filter(isExtratoCancelado));
    const canceladosDiaOcultos = sumValorItens(filterByServico(dia.itens_cancelados, servicosAtivos));
    const canceladosDia = canceladosDiaLista + canceladosDiaOcultos;
    const valorDia = valorExtratoPorFiltro(feitosDia, canceladosDia, modo);

    feitosTotal += feitosDia;
    canceladosDaLista += canceladosDiaLista;
    totalPacotes += itens.length;
    bumpResumo(resumo, itens);

    dias.push({
      ...dia,
      itens,
      itens_cancelados: filterByServico(dia.itens_cancelados, servicosAtivos),
      total_pacotes_filtrados: itens.length,
      valor_dia: formatValorSum(valorDia),
      valor_feitos: formatValorSum(feitosDia),
      valor_cancelados: formatValorSum(canceladosDia),
    });
  }

  const canceladosOcultos = sumValorItens(canceladosPeriodo);
  const valorTotal = valorExtratoPorFiltro(feitosTotal, canceladosDaLista + canceladosOcultos, modo);

  return {
    ...extrato,
    valor_a_receber: formatValorSum(valorTotal),
    valor_feitos: formatValorSum(feitosTotal),
    valor_cancelados: formatValorSum(canceladosDaLista + canceladosOcultos),
    total_pacotes_filtrados: totalPacotes,
    resumo_por_servico: resumo,
    itens_cancelados: canceladosPeriodo,
    dias,
  };
}
