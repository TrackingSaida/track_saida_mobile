import assert from "node:assert/strict";
import { formatDetailDateTimeFull, formatDetailDateOnly } from "../detailFormatters";

assert.match(formatDetailDateTimeFull("2026-06-12T14:30:00") ?? "", /12\/06\/2026 às \d{2}:\d{2}/);
assert.equal(formatDetailDateOnly("2026-06-12"), "12/06/2026");
assert.equal(formatDetailDateTimeFull(null), null);

console.log("detail date formatters tests OK");
