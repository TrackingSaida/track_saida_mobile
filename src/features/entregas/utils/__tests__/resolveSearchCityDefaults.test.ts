import assert from "node:assert/strict";
import { test } from "node:test";
import { pickCityFromExpoPlace } from "../resolveSearchCityDefaults";

test("pickCityFromExpoPlace usa city/subregion e UF do region", () => {
  const city = pickCityFromExpoPlace({
    city: "Carapicuíba",
    region: "São Paulo",
  });
  assert.ok(city);
  assert.equal(city!.cidade, "Carapicuíba");
  assert.equal(city!.estado, "SP");
});

test("pickCityFromExpoPlace ignora nome que parece logradouro", () => {
  assert.equal(
    pickCityFromExpoPlace({
      name: "Rua das Flores",
      city: "",
      subregion: "",
      region: "SP",
    }),
    null
  );
});
