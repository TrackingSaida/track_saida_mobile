import assert from "node:assert/strict";
import {
  hasFriendlyAvulsoId,
  matchesContains,
  matchesResolve,
  scoreCodigoSearch,
} from "../matchAvulsoSearch";

const avulsoFriendly = {
  codigo: "AVULSO-001583",
  codigo_exibicao: "teste • 06311-001",
};

const avulsoFallback = {
  codigo: "AVULSO-001583",
  codigo_exibicao: "AVULSO-001583",
};

const shopee = {
  codigo: "BR2603333150841",
  codigo_exibicao: null,
};

assert.equal(hasFriendlyAvulsoId(avulsoFriendly), true);
assert.equal(hasFriendlyAvulsoId(avulsoFallback), false);
assert.equal(hasFriendlyAvulsoId(shopee), false);

assert.equal(matchesContains(avulsoFriendly, "teste"), true);
assert.equal(matchesContains(avulsoFriendly, "06311"), true);
assert.equal(matchesContains(avulsoFriendly, "6311001"), true);
assert.equal(matchesContains(avulsoFriendly, "AVULSO-001583"), true);
assert.equal(matchesContains(avulsoFriendly, "naoexiste"), false);

assert.equal(matchesContains(avulsoFallback, "AVULSO-001"), true);
assert.equal(matchesContains(avulsoFallback, "teste"), false);

assert.equal(matchesResolve(avulsoFriendly, "teste • 06311-001"), true);
assert.equal(matchesResolve(avulsoFriendly, "teste"), true);
assert.equal(matchesResolve(avulsoFriendly, "06311-001"), true);
assert.equal(matchesResolve(avulsoFriendly, "06311001"), true);
assert.equal(matchesResolve(avulsoFriendly, "AVULSO-001583"), true);
assert.equal(matchesResolve(avulsoFriendly, "outro"), false);

assert.equal(matchesResolve(shopee, "BR2603333150841"), true);
assert.equal(matchesResolve(shopee, "br2603333150841"), true);

assert.ok(scoreCodigoSearch(avulsoFriendly, "teste • 06311-001") >= 100);
assert.ok(scoreCodigoSearch(avulsoFriendly, "teste") >= 10);

console.log("matchAvulsoSearch.test.ts: ok");
