import assert from "node:assert/strict";
import {
  isStatusFinalEntrega,
  resolvePendingDeliveryByScan,
} from "../resolvePendingDeliveryByScan";
import type { EntregaListItem } from "../../types";

function item(partial: Partial<EntregaListItem> & Pick<EntregaListItem, "id_saida" | "status">): EntregaListItem {
  return {
    codigo: partial.codigo ?? `BR${partial.id_saida}`,
    exibicao: partial.exibicao ?? "Pendente",
    cliente: null,
    bairro: null,
    endereco: null,
    contato: null,
    data: null,
    data_hora_entrega: null,
    ...partial,
  };
}

assert.equal(
  isStatusFinalEntrega(item({ id_saida: 1, status: "SAIU_PARA_ENTREGA", exibicao: "Pendente" })),
  false,
  "SAIU_PARA_ENTREGA não é status final"
);
assert.equal(
  isStatusFinalEntrega(item({ id_saida: 2, status: "EM_ROTA", exibicao: "Pendente" })),
  false,
  "EM_ROTA não é status final"
);
assert.equal(
  isStatusFinalEntrega(item({ id_saida: 3, status: "ENTREGUE", exibicao: "Entregue" })),
  true
);
assert.equal(
  isStatusFinalEntrega(item({ id_saida: 4, status: "CANCELADO", exibicao: "Cancelado" })),
  true
);

const pendenteSaiu = item({
  id_saida: 10,
  codigo: "BR269912975142W",
  status: "SAIU_PARA_ENTREGA",
  exibicao: "Pendente",
});

const ok = resolvePendingDeliveryByScan("BR269912975142W", [pendenteSaiu]);
assert.equal(ok.ok, true);
if (ok.ok) assert.equal(ok.item.id_saida, 10);

const bloqueado = resolvePendingDeliveryByScan("BR269912975142W", [
  item({
    id_saida: 11,
    codigo: "BR269912975142W",
    status: "ENTREGUE",
    exibicao: "Entregue",
  }),
]);
assert.equal(bloqueado.ok, false);
if (!bloqueado.ok) {
  assert.equal(bloqueado.title, "Bloqueado");
  assert.match(bloqueado.message, /já está finalizado/);
}

const cancelado = resolvePendingDeliveryByScan("BR000", [
  item({ id_saida: 12, codigo: "BR000", status: "CANCELADO", exibicao: "Cancelado" }),
]);
assert.equal(cancelado.ok, false);

console.log("resolvePendingDeliveryByScan.test.ts: ok");
