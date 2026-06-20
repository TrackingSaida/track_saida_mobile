import assert from "node:assert/strict";
import { serviceCountForTab, serviceCountLabelForTab } from "../../utils/servico";

const summary = { pending: 14, absent: 0, finished: 97 };

assert.equal(serviceCountForTab("pendente", summary, 14), 14);
assert.notEqual(serviceCountForTab("pendente", summary, 14), 111);
assert.equal(serviceCountForTab("ausentes", summary, 5), 0);
assert.equal(serviceCountForTab("finalizadas", summary, 17), 17);
assert.equal(serviceCountLabelForTab("pendente", 14), "14 Pendentes");

console.log("serviceCountForTab tests OK");
