import assert from "node:assert/strict";
import { test } from "node:test";
import { buildFullAddressFromFields } from "../addressBuild";
import {
  cepPrefixMatches,
  citiesMatch,
  countryIsBrazil,
  statesMatch,
} from "../addressNormalize";
import { validateGeocodeCandidate, geocodeAddressStrictDetailed } from "../geocodeStrict";
import {
  mapApiConfidence,
  resolveDeliveryDestination,
} from "../deliveryDestination";
import type { EntregaListItem } from "../../types";

test("buildFullAddressFromFields inclui Brasil no final", () => {
  const addr = buildFullAddressFromFields({
    rua: "Av Paulista",
    numero: "1000",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
    cep: "01310100",
  });
  assert.ok(addr.includes("Av Paulista"));
  assert.ok(addr.includes("São Paulo"));
  assert.ok(addr.endsWith("Brasil"));
});

test("validateGeocodeCandidate rejeita cidade errada", () => {
  const input = {
    rua: "Rua A",
    numero: "10",
    bairro: "Centro",
    cidade: "Barueri",
    estado: "SP",
    cep: "06401000",
  };
  const saoPauloCandidate = {
    lat: "-23.5505",
    lon: "-46.6333",
    address: {
      country: "Brasil",
      country_code: "br",
      state: "São Paulo",
      "ISO3166-2-lvl4": "BR-SP",
      city: "São Paulo",
      postcode: "01001000",
    },
  };
  assert.equal(validateGeocodeCandidate(saoPauloCandidate, input), false);
});

test("validateGeocodeCandidate aceita cidade correta", () => {
  const input = {
    rua: "Rua A",
    numero: "10",
    cidade: "Barueri",
    estado: "SP",
    cep: "06401000",
  };
  const candidate = {
    lat: "-23.5112",
    lon: "-46.8766",
    address: {
      country: "Brasil",
      country_code: "br",
      state: "São Paulo",
      "ISO3166-2-lvl4": "BR-SP",
      city: "Barueri",
      postcode: "06401000",
    },
  };
  assert.equal(validateGeocodeCandidate(candidate, input), true);
});

test("cepPrefixMatches compara 5 primeiros dígitos", () => {
  const addr = { postcode: "06401-000" };
  assert.equal(cepPrefixMatches("06401999", addr), true);
  assert.equal(cepPrefixMatches("01310100", addr), false);
});

test("statesMatch e countryIsBrazil", () => {
  const addr = { country: "Brasil", country_code: "br", state: "São Paulo", "ISO3166-2-lvl4": "BR-SP" };
  assert.equal(countryIsBrazil(addr), true);
  assert.equal(statesMatch("SP", addr), true);
  assert.equal(citiesMatch("Barueri", { city: "Barueri", country_code: "br" }), true);
});

test("resolveDeliveryDestination — API rooftop confiável", () => {
  const d = {
    id_saida: 1,
    codigo: "X",
    status: "s",
    exibicao: "P",
    cliente: null,
    bairro: "Centro",
    endereco: "Rua A",
    numero: "10",
    cidade: "Barueri",
    estado: "SP",
    cep: "06401000",
    contato: null,
    data: null,
    data_hora_entrega: null,
    latitude: -23.51,
    longitude: -46.87,
    coord_precision: "rooftop",
    endereco_origem: "google_places",
  } as EntregaListItem;
  const dest = resolveDeliveryDestination(d);
  assert.equal(dest.hasTrustedCoords, true);
  assert.equal(dest.source, "api_trusted");
  assert.equal(dest.confidence, "alta");
});

test("resolveDeliveryDestination — approx sem pin", () => {
  const d = {
    id_saida: 2,
    codigo: "Y",
    status: "s",
    exibicao: "P",
    cliente: null,
    bairro: "Centro",
    endereco: "Rua B",
    numero: "20",
    cidade: "Barueri",
    estado: "SP",
    cep: "06401000",
    contato: null,
    data: null,
    data_hora_entrega: null,
    latitude: -23.55,
    longitude: -46.63,
    coord_precision: "approx",
  } as EntregaListItem;
  const dest = resolveDeliveryDestination(d);
  assert.equal(dest.hasTrustedCoords, false);
  assert.equal(dest.source, "address_text");
});

test("resolveDeliveryDestination — sem cidade retorna none", () => {
  const d = {
    id_saida: 3,
    codigo: "Z",
    status: "s",
    exibicao: "P",
    cliente: null,
    bairro: "Centro",
    endereco: "Rua C",
    contato: null,
    data: null,
    data_hora_entrega: null,
  } as EntregaListItem;
  const dest = resolveDeliveryDestination(d);
  assert.equal(dest.hasTrustedCoords, false);
  assert.equal(dest.source, "none");
});

test("geocodeAddressStrictDetailed retorna no_match sem endereço mínimo", async () => {
  const outcome = await geocodeAddressStrictDetailed({
    rua: "ab",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "SP",
    cep: "",
  });
  assert.equal(outcome.status, "no_match");
});

test("mapApiConfidence", () => {
  assert.equal(
    mapApiConfidence({ coord_precision: "rooftop", endereco_origem: "google_places" } as EntregaListItem),
    "alta"
  );
  assert.equal(mapApiConfidence({ coord_precision: "approx" } as EntregaListItem), "baixa");
});
