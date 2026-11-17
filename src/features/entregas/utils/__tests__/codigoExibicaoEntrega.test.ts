import assert from "node:assert/strict";
import { codigoExibicaoEntrega } from "../codigoExibicaoEntrega";

assert.equal(
  codigoExibicaoEntrega({
    codigo: "AVULSO-001583",
    codigo_exibicao: "teste • 06311-001",
  }),
  "teste • 06311-001"
);
assert.equal(
  codigoExibicaoEntrega({ codigo: "AVULSO-001583", codigo_exibicao: "  " }),
  "AVULSO-001583"
);
assert.equal(
  codigoExibicaoEntrega({ codigo: "BR2603333150841" }),
  "BR2603333150841"
);
assert.equal(codigoExibicaoEntrega({ id_saida: 42 }), "Pedido 42");

console.log("codigoExibicaoEntrega.test.ts: ok");
