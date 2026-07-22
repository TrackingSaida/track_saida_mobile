import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressFormValues } from "../../components/AddressForm";
import type { RankableAddressSuggestion } from "../addressSuggestionRank";
import {
  pickBestAddressSuggestion,
  suggestionCompletenessScore,
} from "../addressSuggestionRank";

function baseValues(partial: Partial<AddressFormValues> = {}): AddressFormValues {
  return {
    destinatario: "",
    rua: "Rua Marco Antônio dos Santos",
    numero: "21",
    complemento: "",
    bairro: "Parque Santana Gleba 2",
    cidade: "Santana de Parnaíba",
    estado: "SP",
    cep: "",
    ...partial,
  };
}

function suggestion(
  id: string,
  partial: Partial<RankableAddressSuggestion> & { values?: Partial<AddressFormValues> } = {}
): RankableAddressSuggestion {
  const { values: valuePartial, ...rest } = partial;
  return {
    id,
    latitude: -23.45,
    longitude: -46.92,
    values: baseValues(valuePartial),
    ...rest,
  };
}

test("auto-seleciona único resultado", () => {
  const only = suggestion("a", { values: { cep: "06515005" } });
  assert.equal(pickBestAddressSuggestion([only])?.id, "a");
});

test("preferência pelo endereço com CEP quando o local é o mesmo", () => {
  const withCep = suggestion("cep", {
    values: { cep: "06515005", bairro: "Parque Santana Gleba 2" },
    distanceKm: 27,
    provider: "nominatim",
  });
  const withoutCep = suggestion("sem", {
    values: { cep: "", bairro: "Parque Santana" },
    distanceKm: 26,
    provider: "nominatim",
    latitude: -23.4501,
    longitude: -46.9201,
  });
  assert.equal(pickBestAddressSuggestion([withoutCep, withCep])?.id, "cep");
  assert.ok(
    suggestionCompletenessScore(withCep) > suggestionCompletenessScore(withoutCep)
  );
});

test("não auto-seleciona quando são endereços diferentes e empate", () => {
  const a = suggestion("a", {
    values: {
      rua: "Rua A",
      numero: "10",
      cidade: "Barueri",
      estado: "SP",
      cep: "",
      bairro: "Centro",
    },
    latitude: -23.5,
    longitude: -46.8,
    distanceKm: 10,
  });
  const b = suggestion("b", {
    values: {
      rua: "Rua B",
      numero: "20",
      cidade: "Osasco",
      estado: "SP",
      cep: "",
      bairro: "Centro",
    },
    latitude: -23.55,
    longitude: -46.75,
    distanceKm: 12,
  });
  assert.equal(pickBestAddressSuggestion([a, b]), null);
});

test("auto-seleciona quando gap de completude é forte (CEP)", () => {
  const weak = suggestion("weak", {
    values: {
      rua: "Av Paulista",
      numero: "1000",
      cidade: "São Paulo",
      estado: "SP",
      cep: "",
      bairro: "",
    },
    latitude: -23.56,
    longitude: -46.65,
  });
  const strong = suggestion("strong", {
    values: {
      rua: "Av Brigadeiro Faria Lima",
      numero: "2000",
      cidade: "São Paulo",
      estado: "SP",
      cep: "01452000",
      bairro: "Jardim Paulistano",
    },
    latitude: -23.57,
    longitude: -46.69,
    confidence: 0.95,
  });
  assert.equal(pickBestAddressSuggestion([weak, strong])?.id, "strong");
});

test("preferência por endereço já utilizado do motoboy", () => {
  const local = suggestion("local", {
    provider: "local",
    alreadyUsed: true,
    values: { cep: "06515005" },
  });
  const other = suggestion("other", {
    provider: "nominatim",
    values: { cep: "06515005" },
    latitude: -23.45005,
    longitude: -46.92005,
  });
  assert.equal(pickBestAddressSuggestion([other, local])?.id, "local");
});
