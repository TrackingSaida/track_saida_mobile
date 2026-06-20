import assert from "node:assert/strict";
import { formatEntradaDataBadge } from "../detailFormatters";

assert.equal(formatEntradaDataBadge("2026-06-12"), "12/06");
assert.equal(formatEntradaDataBadge("2026-06-12T10:00:00"), "12/06");
assert.equal(formatEntradaDataBadge(null), "—");
assert.equal(formatEntradaDataBadge(""), "—");
assert.equal(formatEntradaDataBadge("invalid"), "—");

console.log("formatEntradaDataBadge tests OK");
