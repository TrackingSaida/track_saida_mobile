/**
 * Testes do fluxo de foto em disco / retomada.
 * Run: npx tsx src/services/__tests__/photoFlowUtils.test.ts
 */
import assert from "node:assert/strict";
import {
  isDraftFresh,
  isResumeWorthyDraft,
  mergePendingCaptureUri,
  parseAvulsoSource,
  parseTipoDocumento,
  pickLatestResumeItem,
  PHOTO_DRAFT_MAX_AGE_MS,
  resumeCopyForKind,
  shouldSkipImageResize,
  SKIP_RESIZE_MAX_BYTES,
  toResumeItem,
  type AvulsoPhotoDraft,
  type EntreguePhotoDraft,
} from "../photoFlowUtils";

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

check("shouldSkipImageResize abaixo do limite", () => {
  assert.equal(shouldSkipImageResize(120_000), true);
  assert.equal(shouldSkipImageResize(SKIP_RESIZE_MAX_BYTES), true);
  assert.equal(shouldSkipImageResize(SKIP_RESIZE_MAX_BYTES + 1), false);
  assert.equal(shouldSkipImageResize(0), false);
  assert.equal(shouldSkipImageResize(undefined), false);
});

check("isResumeWorthyDraft exige foto e rascunho fresco", () => {
  const now = Date.now();
  const entregue: EntreguePhotoDraft = {
    kind: "entregue",
    idSaida: 10,
    photoUris: ["file://a.jpg"],
    updatedAt: now,
  };
  assert.equal(isResumeWorthyDraft(entregue, now), true);
  assert.equal(isResumeWorthyDraft({ ...entregue, photoUris: [] }, now), false);
  assert.equal(
    isResumeWorthyDraft({ ...entregue, updatedAt: now - PHOTO_DRAFT_MAX_AGE_MS - 1 }, now),
    false
  );
});

check("avulso só retoma com foto", () => {
  const now = Date.now();
  const avulso: AvulsoPhotoDraft = {
    kind: "avulso",
    source: "scan",
    identificacao: "Loja",
    quantidade: "2",
    photos: [],
    updatedAt: now,
  };
  assert.equal(isResumeWorthyDraft(avulso, now), false);
  assert.equal(
    isResumeWorthyDraft({ ...avulso, photos: [{ id: "1", uri: "file://a.jpg" }] }, now),
    true
  );
});

check("mergePendingCaptureUri não duplica", () => {
  assert.deepEqual(mergePendingCaptureUri(["a"], "b"), ["a", "b"]);
  assert.deepEqual(mergePendingCaptureUri(["a"], "a"), ["a"]);
  assert.deepEqual(mergePendingCaptureUri(["a"], null), ["a"]);
});

check("toResumeItem e copy amigável", () => {
  const item = toResumeItem({
    kind: "entregue",
    idSaida: 7,
    photoUris: ["file://x.jpg"],
    updatedAt: Date.now(),
  });
  assert.ok(item);
  assert.equal(item?.idSaida, 7);
  assert.match(resumeCopyForKind("entregue").title, /Comprovante/i);
  assert.ok(!resumeCopyForKind("entregue").subtitle.toLowerCase().includes("scan"));
});

check("pickLatestResumeItem", () => {
  const latest = pickLatestResumeItem([
    {
      kind: "entregue",
      title: "a",
      subtitle: "a",
      idSaida: 1,
      updatedAt: 10,
    },
    {
      kind: "avulso",
      title: "b",
      subtitle: "b",
      source: "scan",
      updatedAt: 20,
    },
  ]);
  assert.equal(latest?.kind, "avulso");
});

check("parse helpers", () => {
  assert.equal(parseTipoDocumento("CPF"), "CPF");
  assert.equal(parseTipoDocumento("x"), "RG");
  assert.equal(parseAvulsoSource("saidas"), "saidas");
  assert.equal(parseAvulsoSource("scan"), "scan");
  assert.equal(isDraftFresh(Date.now()), true);
});

console.log("photoFlowUtils tests OK");
