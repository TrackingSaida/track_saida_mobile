import { groupAusentesByMotivo, MOTIVO_AUSENCIA_SEM_INFO } from "../groupAusentesByMotivo";
import type { EntregaListItem } from "../../types";

function item(
  id: number,
  motivo: string | null | undefined,
  servico = "Shopee"
): EntregaListItem {
  return {
    id_saida: id,
    codigo: `BR${id}`,
    status: "AUSENTE",
    exibicao: "Ocorrência",
    servico,
    cliente: null,
    bairro: null,
    endereco: null,
    contato: null,
    data: null,
    data_hora_entrega: null,
    motivo_ocorrencia: motivo,
  };
}

describe("groupAusentesByMotivo", () => {
  it("agrupa por motivo e ordena pela quantidade", () => {
    const groups = groupAusentesByMotivo([
      item(1, "Recusado"),
      item(2, "Cliente ausente"),
      item(3, "Cliente ausente"),
      item(4, null),
    ]);
    expect(groups.map((g) => [g.motivo, g.data.length])).toEqual([
      ["Cliente ausente", 2],
      ["Recusado", 1],
      [MOTIVO_AUSENCIA_SEM_INFO, 1],
    ]);
  });
});
