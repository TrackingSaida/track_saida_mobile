import assert from "node:assert/strict";
import { buildOperacaoResumoRows, formatOperacaoDuration } from "../operacaoResumoUtils";
import type { EntregaListItem, EntregaHistoricoItem } from "../../types";

const base: EntregaListItem = {
  id_saida: 1,
  codigo: "BR123",
  status: "EM_ROTA",
  exibicao: "Pendente",
  cliente: "João",
  bairro: null,
  endereco: null,
  contato: null,
  data: "2026-06-13",
  data_hora_cadastro: "2026-06-13T00:12:00",
  data_hora_entrega: null,
};

const historico: EntregaHistoricoItem[] = [
  { id: 1, evento: "scan", timestamp: "2026-06-13T00:12:00", usuario_nome: "op1" },
  { id: 2, evento: "em_rota", timestamp: "2026-06-13T00:45:00", usuario_nome: "op1" },
];

assert.equal(formatOperacaoDuration("2026-06-13T00:12:00", "2026-06-13T01:10:00"), "58 min");

const pendente = buildOperacaoResumoRows(base, historico, new Date("2026-06-13T01:00:00"));
assert.ok(pendente.some((r) => r.label === "Entrada"));
assert.ok(pendente.some((r) => r.label === "Saiu para entrega"));
assert.ok(!pendente.some((r) => r.label === "Operacional atual"));

const entregue = buildOperacaoResumoRows(
  {
    ...base,
    exibicao: "Entregue",
    status: "ENTREGUE",
    data_hora_entrega: "2026-06-13T01:10:00",
    tentativa: 1,
  },
  [...historico, { id: 3, evento: "entregue", timestamp: "2026-06-13T01:10:00" }],
  new Date("2026-06-13T02:00:00")
);
assert.ok(entregue.some((r) => r.label === "Finalizada"));
assert.ok(entregue.some((r) => r.label === "Tempo na operação"));

console.log("operacaoResumoUtils tests OK");
