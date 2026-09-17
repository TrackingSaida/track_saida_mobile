import assert from "node:assert/strict";
import { test } from "node:test";
import type { EntregaListItem } from "../../types";
import {
  clusterRouteOrderByAddress,
  getDeliveryStopKey,
  groupOrderedByAddress,
  streetNameForStopKey,
} from "../routeUtils";

function makeDelivery(partial: Partial<EntregaListItem> & { id_saida: number }): EntregaListItem {
  return {
    codigo: `C${partial.id_saida}`,
    status: "saiu_para_entrega",
    exibicao: "Pendente",
    cliente: "Cliente",
    bairro: null,
    endereco: null,
    contato: null,
    data: null,
    data_hora_entrega: null,
    ...partial,
  } as EntregaListItem;
}

test("streetNameForStopKey remove número composto da API", () => {
  assert.equal(streetNameForStopKey("Av. Anibal Correia, 193", "193"), "av. anibal correia");
  assert.equal(streetNameForStopKey("Rua das Flores, 100, Apto 1", "100"), "rua das flores");
  assert.equal(streetNameForStopKey("Rua das Flores", "100"), "rua das flores");
});

test("bairros diferentes na mesma rua continuam paradas distintas", () => {
  const a = makeDelivery({
    id_saida: 3,
    endereco: "Av. Anibal Correia, 193",
    numero: "193",
    cidade: "Barueri",
    bairro: "Jardim Paulista",
    cep: "06401-000",
  });
  const b = makeDelivery({
    id_saida: 4,
    endereco: "Av. Anibal Correia, 193",
    numero: "193",
    cidade: "Barueri",
    bairro: "Parque Viana",
    cep: "06449-000",
  });
  assert.notEqual(getDeliveryStopKey(a), getDeliveryStopKey(b));
  assert.equal(groupOrderedByAddress([a, b]).length, 2);
});

test("depois de igualar o bairro, junta os volumes na mesma parada", () => {
  const a = makeDelivery({
    id_saida: 3,
    endereco: "Av. Anibal Correia, 193",
    numero: "193",
    cidade: "Barueri",
    bairro: "Jardim Paulista",
    cep: "06401-000",
  });
  const b = makeDelivery({
    id_saida: 4,
    endereco: "Av. Anibal Correia, 193",
    numero: "193",
    cidade: "Barueri",
    bairro: "Jardim Paulista",
    cep: "06449-000",
  });
  assert.equal(getDeliveryStopKey(a), getDeliveryStopKey(b));
  const groups = groupOrderedByAddress([a, b]);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].deliveryIds, [3, 4]);
});

test("clusterRouteOrderByAddress junta só quem ficou com o mesmo endereço", () => {
  const a = makeDelivery({
    id_saida: 1,
    endereco: "Rua A, 10",
    numero: "10",
    cidade: "Osasco",
    bairro: "Centro",
    cep: "06010-000",
  });
  const b = makeDelivery({
    id_saida: 2,
    endereco: "Rua B, 20",
    numero: "20",
    cidade: "Osasco",
    bairro: "Centro",
    cep: "06020-000",
  });
  const c = makeDelivery({
    id_saida: 3,
    endereco: "Rua A, 10",
    numero: "10",
    cidade: "Osasco",
    bairro: "Centro",
    cep: "06110-000",
  });
  const clustered = clusterRouteOrderByAddress([a, b, c], [1, 2, 3]);
  const groups = groupOrderedByAddress(
    clustered.map((id) => [a, b, c].find((d) => d.id_saida === id)!)
  );
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].deliveryIds, [1, 3]);
});

test("números diferentes continuam paradas separadas", () => {
  const a = makeDelivery({
    id_saida: 1,
    endereco: "Rua A, 10",
    numero: "10",
    cidade: "Osasco",
    bairro: "Centro",
  });
  const b = makeDelivery({
    id_saida: 2,
    endereco: "Rua A, 20",
    numero: "20",
    cidade: "Osasco",
    bairro: "Centro",
  });
  assert.notEqual(getDeliveryStopKey(a), getDeliveryStopKey(b));
  assert.equal(groupOrderedByAddress([a, b]).length, 2);
});
