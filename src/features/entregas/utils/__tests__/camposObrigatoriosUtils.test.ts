import {
  camposAusenteFromDeliveries,
  camposEntregueFromDeliveries,
  mergeEntregaPreservingCampos,
  unionCamposObrigatorios,
} from "../camposObrigatoriosUtils";
import type { EntregaListItem } from "../../types";

function baseItem(
  partial: Partial<EntregaListItem> & Pick<EntregaListItem, "id_saida">
): EntregaListItem {
  return {
    codigo: "A",
    status: "EM_ROTA",
    exibicao: "Pendente",
    cliente: null,
    bairro: null,
    endereco: null,
    contato: null,
    data: null,
    data_hora_entrega: null,
    ...partial,
  };
}

describe("camposObrigatoriosUtils", () => {
  it("une campos sem duplicar", () => {
    expect(unionCamposObrigatorios(["foto"], ["Foto", "recebedor"], [])).toEqual([
      "foto",
      "recebedor",
    ]);
  });

  it("une campos entregue de vários pedidos do lote", () => {
    const items = [
      { campos_obrigatorios_entregue: ["foto"] },
      { campos_obrigatorios_entregue: [] },
      { campos_obrigatorios_entregue: ["recebedor"] },
    ];
    expect(camposEntregueFromDeliveries(items)).toEqual(["foto", "recebedor"]);
  });

  it("une campos ausente de vários pedidos do lote", () => {
    const items = [
      { campos_obrigatorios_ausente: ["foto"] },
      { campos_obrigatorios_ausente: ["observacao"] },
    ];
    expect(camposAusenteFromDeliveries(items)).toEqual(["foto", "observacao"]);
  });

  it("preserva campos locais quando update vem vazio", () => {
    const prev = baseItem({
      id_saida: 1,
      campos_obrigatorios: ["foto"],
      campos_obrigatorios_entregue: ["foto"],
      campos_obrigatorios_ausente: ["foto"],
    });
    const updated = baseItem({
      id_saida: 1,
      endereco: "Rua X",
      campos_obrigatorios: [],
      campos_obrigatorios_entregue: [],
      campos_obrigatorios_ausente: [],
    });
    const merged = mergeEntregaPreservingCampos(prev, updated);
    expect(merged.endereco).toBe("Rua X");
    expect(merged.campos_obrigatorios_entregue).toEqual(["foto"]);
    expect(merged.campos_obrigatorios_ausente).toEqual(["foto"]);
  });

  it("prefere campos do update quando preenchidos", () => {
    const prev = baseItem({
      id_saida: 1,
      campos_obrigatorios_entregue: ["foto"],
    });
    const updated = baseItem({
      id_saida: 1,
      campos_obrigatorios_entregue: ["foto", "recebedor"],
    });
    expect(mergeEntregaPreservingCampos(prev, updated).campos_obrigatorios_entregue).toEqual([
      "foto",
      "recebedor",
    ]);
  });
});
