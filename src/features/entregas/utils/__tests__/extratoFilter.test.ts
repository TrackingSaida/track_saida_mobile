import assert from "node:assert/strict";
import {
  filterExtratoByServicos,
  isExtratoCancelado,
  isExtratoGrupoEntregue,
  valorExtratoPorFiltro,
  type ServicoExtrato,
} from "../extratoFilter";
import type { ExtratoFinanceiro, ExtratoPedidoItem } from "../../types";

function item(partial: Partial<ExtratoPedidoItem> & Pick<ExtratoPedidoItem, "id_saida" | "status">): ExtratoPedidoItem {
  return {
    codigo: `BR${partial.id_saida}`,
    exibicao: partial.exibicao ?? "",
    servico: partial.servico ?? "Shopee",
    valor: partial.valor ?? "4.00",
    ...partial,
  };
}

const entregues: ExtratoPedidoItem[] = Array.from({ length: 10 }, (_, i) =>
  item({ id_saida: i + 1, status: "ENTREGUE", exibicao: "Entregue", valor: "4.00" })
);
const cancelados: ExtratoPedidoItem[] = [
  item({ id_saida: 101, status: "CANCELADO", exibicao: "Cancelado", valor: "4.00" }),
  item({ id_saida: 102, status: "CANCELADO", exibicao: "Cancelado", valor: "4.00" }),
];

function extratoBase(statusFiltro: ExtratoFinanceiro["status_filtro"]): ExtratoFinanceiro {
  const visiveis =
    statusFiltro === "cancelados"
      ? cancelados
      : statusFiltro === "todos"
        ? [...entregues, ...cancelados]
        : entregues;
  return {
    periodo_inicio: "2026-08-16",
    periodo_fim: "2026-08-31",
    status_filtro: statusFiltro,
    valor_a_receber: "0",
    total_pacotes_associados: 10,
    total_pacotes_filtrados: visiveis.length,
    total_cancelados: 2,
    resumo_por_servico: { shopee: visiveis.length, flex: 0, avulso: 0 },
    itens_cancelados: statusFiltro === "grupo_entregue" ? cancelados : [],
    dias: [
      {
        data: "2026-08-20",
        total_pacotes_associados: 10,
        total_pacotes_filtrados: visiveis.length,
        valor_dia: "0",
        itens: visiveis,
        itens_cancelados: statusFiltro === "grupo_entregue" ? cancelados : [],
      },
    ],
  };
}

assert.equal(valorExtratoPorFiltro(40, 8, "todos"), 48);
assert.equal(valorExtratoPorFiltro(40, 8, "grupo_entregue"), 32);
assert.equal(valorExtratoPorFiltro(40, 8, "cancelados"), 8);
assert.ok(isExtratoGrupoEntregue(item({ id_saida: 1, status: "ENTREGUE", exibicao: "Entregue" })));
assert.ok(isExtratoGrupoEntregue(item({ id_saida: 2, status: "EM_ROTA", exibicao: "Pendente" })));
assert.ok(isExtratoCancelado(item({ id_saida: 3, status: "CANCELADO", exibicao: "Cancelado" })));
assert.equal(isExtratoGrupoEntregue(item({ id_saida: 4, status: "AUSENTE", exibicao: "Ausente" })), false);

const shopee: Set<ServicoExtrato> = new Set(["Shopee"]);

const todosFiltrado = filterExtratoByServicos(extratoBase("todos"), shopee);
assert.equal(todosFiltrado.valor_a_receber, "48.00");
assert.equal(todosFiltrado.dias[0].valor_dia, "48.00");

const entregueFiltrado = filterExtratoByServicos(extratoBase("grupo_entregue"), shopee);
assert.equal(entregueFiltrado.valor_a_receber, "32.00");
assert.equal(entregueFiltrado.dias[0].valor_dia, "32.00");

const canceladosFiltrado = filterExtratoByServicos(extratoBase("cancelados"), shopee);
assert.equal(canceladosFiltrado.valor_a_receber, "8.00");
assert.equal(canceladosFiltrado.dias[0].valor_dia, "8.00");

const flexOnly = item({
  id_saida: 200,
  status: "ENTREGUE",
  exibicao: "Entregue",
  servico: "Flex",
  valor: "4.00",
});
const misto: ExtratoFinanceiro = {
  ...extratoBase("grupo_entregue"),
  dias: [
    {
      data: "2026-08-20",
      total_pacotes_associados: 11,
      total_pacotes_filtrados: 11,
      valor_dia: "0",
      itens: [...entregues, flexOnly],
      itens_cancelados: cancelados,
    },
  ],
  itens_cancelados: cancelados,
};
const soShopee = filterExtratoByServicos(misto, shopee);
assert.equal(soShopee.total_pacotes_filtrados, 10);
assert.equal(soShopee.valor_a_receber, "32.00");

console.log("extratoFilter tests OK");
