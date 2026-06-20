import type { ExtratoDiaItem, ExtratoFinanceiro, ExtratoPedidoItem } from "../types";

export type ServicoExtrato = "Shopee" | "Flex" | "Avulso";

export function normalizeExtratoServico(servico: string): ServicoExtrato {
  const s = (servico || "").trim().toLowerCase();
  if (s.includes("shopee")) return "Shopee";
  if (s.includes("flex") || s.includes("mercado") || s.includes("ml")) return "Flex";
  return "Avulso";
}

function parseValorItem(valor?: string): number {
  const n = Number.parseFloat(String(valor ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function sumValorItens(itens: ExtratoPedidoItem[]): number {
  return itens.reduce((acc, it) => acc + parseValorItem(it.valor), 0);
}

function formatValorSum(total: number): string {
  return total.toFixed(2);
}

export function filterExtratoByServicos(
  extrato: ExtratoFinanceiro,
  servicosAtivos: Set<ServicoExtrato>
): ExtratoFinanceiro {
  if (servicosAtivos.size === 0) return extrato;

  const dias: ExtratoDiaItem[] = [];
  let totalPacotes = 0;
  let valorTotal = 0;
  const resumo = { shopee: 0, flex: 0, avulso: 0 };

  for (const dia of extrato.dias) {
    const itens = dia.itens.filter((it) => servicosAtivos.has(normalizeExtratoServico(it.servico)));
    if (itens.length === 0) continue;

    const valorDia = sumValorItens(itens);
    totalPacotes += itens.length;
    valorTotal += valorDia;

    for (const it of itens) {
      const tipo = normalizeExtratoServico(it.servico);
      if (tipo === "Shopee") resumo.shopee += 1;
      else if (tipo === "Flex") resumo.flex += 1;
      else resumo.avulso += 1;
    }

    dias.push({
      ...dia,
      itens,
      total_pacotes_filtrados: itens.length,
      valor_dia: formatValorSum(valorDia),
    });
  }

  return {
    ...extrato,
    valor_a_receber: formatValorSum(valorTotal),
    total_pacotes_filtrados: totalPacotes,
    resumo_por_servico: resumo,
    dias,
  };
}
