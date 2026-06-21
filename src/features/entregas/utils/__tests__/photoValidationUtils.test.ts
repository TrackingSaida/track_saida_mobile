/** Testes de validação de fotos na conclusão de entrega. */
import {
  canConfirmWithPhotos,
  countSentPhotos,
  meetsRequiredPhotoRule,
} from "../photoValidationUtils";

describe("photoValidationUtils", () => {
  it("countSentPhotos", () => {
    expect(
      countSentPhotos([
        { status: "sent" },
        { status: "error" },
        { status: "idle" },
      ])
    ).toBe(1);
  });

  it("meetsRequiredPhotoRule exige 1 sent quando obrigatória", () => {
    expect(meetsRequiredPhotoRule([{ status: "sent" }], true)).toBe(true);
    expect(meetsRequiredPhotoRule([{ status: "error" }], true)).toBe(false);
    expect(meetsRequiredPhotoRule([], false)).toBe(true);
  });

  it("canConfirmWithPhotos permite extras em error se já há 1 sent", () => {
    expect(
      canConfirmWithPhotos(
        [{ status: "sent" }, { status: "error" }],
        true
      ).ok
    ).toBe(true);
  });

  it("canConfirmWithPhotos bloqueia sem foto adicionada", () => {
    expect(canConfirmWithPhotos([], true).ok).toBe(false);
  });

  it("canConfirmWithPhotos permite idle pendente de upload", () => {
    expect(canConfirmWithPhotos([{ status: "idle" }], true).ok).toBe(true);
  });
});
