import assert from "node:assert/strict";
import { test } from "node:test";
import { formatApiError } from "../formatApiError";

test("formatApiError le detail objeto do scan e evita [object Object]", () => {
  const err = {
    isAxiosError: true,
    response: {
      data: {
        detail: {
          code: "MANUAL_CODE_ENTRY_FORBIDDEN",
          message: "Digitar código manualmente não é permitido para este entregador.",
        },
      },
    },
  };
  assert.equal(
    formatApiError(err, "Erro ao processar leitura"),
    "Digitar código manualmente não é permitido para este entregador."
  );
});

test("formatApiError usa fallback quando detail não tem mensagem", () => {
  const err = {
    isAxiosError: true,
    response: {
      data: { detail: { code: "X" } },
    },
  };
  assert.equal(formatApiError(err, "Código não encontrado ou erro ao processar."), "Código não encontrado ou erro ao processar.");
});
