/**
 * Testes de diagnóstico/retry do upload avulso.
 * Run: npx tsx src/services/__tests__/avulsoUploadDiagnostics.test.ts
 */
import assert from "node:assert/strict";
import {
  AVULSO_UPLOAD_MAX_ATTEMPTS,
  backoffMs,
  classifyStorageUploadFailure,
  classifyThrownUploadError,
  formatAvulsoUploadLog,
  friendlyAvulsoUploadMessage,
  isTransientHttpStatus,
  isTransientUploadFailure,
  parseStorageErrorXml,
  sanitizeTechnicalErrorText,
  summarizeObjectKey,
} from "../avulsoUploadDiagnostics";

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

check("parseStorageErrorXml extrai Code/Message do B2", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Error>
  <Code>InternalError</Code>
  <Message>internal incident</Message>
</Error>`;
  const parsed = parseStorageErrorXml(xml);
  assert.equal(parsed.code, "InternalError");
  assert.equal(parsed.message, "internal incident");
});

check("sanitizeTechnicalErrorText remove XML bruto", () => {
  const xml = `Upload recusado (500): <?xml version="1.0"?><Error><Code>InternalError</Code><Message>internal incident</Message></Error>`;
  const out = sanitizeTechnicalErrorText(xml);
  assert.ok(!out.includes("<?xml"));
  assert.ok(!out.includes("<Error>"));
  assert.match(out, /InternalError/i);
});

check("sanitizeTechnicalErrorText trata Network Error", () => {
  assert.equal(sanitizeTechnicalErrorText("Network Error"), "Falha de rede");
});

check("classifyStorageUploadFailure 500 é retryable sem XML na mensagem", () => {
  const xml = `<?xml version="1.0"?><Error><Code>InternalError</Code><Message>internal incident</Message></Error>`;
  const c = classifyStorageUploadFailure(500, xml);
  assert.equal(c.code, "STORAGE_TEMPORARY_ERROR");
  assert.equal(c.retryable, true);
  assert.equal(c.storageCode, "InternalError");
  assert.ok(!c.message.includes("<?xml"));
  assert.ok(!c.message.includes("<Error>"));
});

check("classifyStorageUploadFailure 403 não é retryable", () => {
  const c = classifyStorageUploadFailure(403, "<Error><Code>AccessDenied</Code></Error>");
  assert.equal(c.code, "STORAGE_FORBIDDEN");
  assert.equal(c.retryable, false);
});

check("isTransientHttpStatus cobre 5xx e timeout-like", () => {
  assert.equal(isTransientHttpStatus(500), true);
  assert.equal(isTransientHttpStatus(502), true);
  assert.equal(isTransientHttpStatus(503), true);
  assert.equal(isTransientHttpStatus(504), true);
  assert.equal(isTransientHttpStatus(400), false);
  assert.equal(isTransientHttpStatus(403), false);
});

check("isTransientUploadFailure para storage 500", () => {
  assert.equal(
    isTransientUploadFailure({
      stage: "storage_upload",
      httpStatus: 500,
      code: "STORAGE_TEMPORARY_ERROR",
    }),
    true
  );
  assert.equal(
    isTransientUploadFailure({
      stage: "storage_upload",
      httpStatus: 403,
      code: "STORAGE_FORBIDDEN",
    }),
    false
  );
});

check("friendly messages cobrem timeout/rede/sessão", () => {
  assert.match(friendlyAvulsoUploadMessage({ code: "TIMEOUT" }), /demorou/i);
  assert.match(friendlyAvulsoUploadMessage({ code: "NETWORK" }), /conexão/i);
  assert.match(friendlyAvulsoUploadMessage({ code: "SESSION_EXPIRED" }), /sessão/i);
});

check("classifyThrownUploadError Network Error axios-like", () => {
  const err = Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" });
  const c = classifyThrownUploadError(err, "presign");
  assert.equal(c.code, "NETWORK");
  assert.equal(c.retryable, true);
  assert.ok(!c.message.toLowerCase().includes("network error"));
});

check("backoff progressivo e max attempts", () => {
  assert.ok(backoffMs(1) < backoffMs(2));
  assert.ok(backoffMs(2) < backoffMs(3));
  assert.equal(AVULSO_UPLOAD_MAX_ATTEMPTS, 3);
});

check("summarizeObjectKey e log sem URL assinada", () => {
  const key = "saida/pending/lancar_avulso/abcdef0123456789abcdef0123456789.jpg";
  const short = summarizeObjectKey(key);
  assert.ok(short.includes("…"));
  assert.ok(!short.includes("X-Amz"));
  const line = formatAvulsoUploadLog({
    stage: "storage_upload",
    attempt: 2,
    status: 500,
    storage_code: "InternalError",
    duration_ms: 4210,
    object_key: key,
  });
  assert.match(line, /\[AVULSO_UPLOAD\]/);
  assert.match(line, /stage=storage_upload/);
  assert.match(line, /attempt=2/);
  assert.match(line, /status=500/);
  assert.match(line, /storage_code=InternalError/);
  assert.ok(!line.includes("https://"));
});

check("idempotência conceitual: reaproveitar key cached (simulado)", () => {
  const cache: Record<string, string> = {};
  const localId = "local-1";
  const uploadOnce = (id: string) => {
    if (cache[id]) return cache[id];
    cache[id] = `saida/pending/lancar_avulso/${id}.jpg`;
    return cache[id];
  };
  const first = uploadOnce(localId);
  const second = uploadOnce(localId);
  assert.equal(first, second);
  assert.equal(Object.keys(cache).length, 1);
});

console.log("avulsoUploadDiagnostics tests OK");
