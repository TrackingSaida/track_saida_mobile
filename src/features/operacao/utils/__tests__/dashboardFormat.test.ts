import assert from "node:assert/strict";
import { personInitials } from "../../../../utils/personName";
import {
  barPercent,
  baseDayAge,
  formatInteger,
  formatPercent,
  ratioPercent,
  taxaSaidaPercent,
} from "../dashboardFormat";

assert.equal(personInitials("Abacate Matheus Alves da Silva"), "AM");
assert.equal(personInitials("Anderson Oliveira"), "AO");
assert.equal(personInitials("João"), "JO");
assert.equal(personInitials(""), "?");
assert.equal(personInitials("Maria de Souza"), "MS");

assert.equal(formatInteger(1076), "1.076");
assert.equal(formatInteger(0), "0");
assert.equal(formatPercent(98.4), "98,4%");
assert.equal(formatPercent(101.1), "101,1%");

assert.equal(ratioPercent(0, 1076), 0);
assert.equal(ratioPercent(23, 1076), 2.1);
assert.equal(ratioPercent(613, 618), 99.2);
assert.equal(ratioPercent(1076, 1064), 101.1);
assert.equal(ratioPercent(10, 0), null);

assert.equal(taxaSaidaPercent(613, 618), 99.2);
assert.equal(taxaSaidaPercent(10, 0), null);

assert.equal(barPercent(23, 1076), 2.1);
assert.equal(barPercent(200, 100), 100);

assert.equal(baseDayAge("2026-09-02", new Date(2026, 8, 2)), "today");
assert.equal(baseDayAge("2026-09-01", new Date(2026, 8, 2)), "recent");
assert.equal(baseDayAge("2026-08-31", new Date(2026, 8, 2)), "recent");
assert.equal(baseDayAge("2026-08-28", new Date(2026, 8, 2)), "older");

console.log("dashboardFormat + personInitials ok");
