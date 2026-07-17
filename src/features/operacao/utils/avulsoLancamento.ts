export const AVULSO_IDENT_MAX = 32;
export const AVULSO_QTD_MAX = 50;
export const AVULSO_IDENT_AJUDA = "Use nome curto da loja/cliente; evite telefone completo.";

export type ValidacaoAvulsoResult =
  | { ok: true; quantidade: number; identificacao: string | null }
  | { ok: false; message: string };

export function validarLancamentoAvulso(
  identificacao: string,
  quantidadeRaw: string
): ValidacaoAvulsoResult {
  const ident = identificacao.trim();
  if (ident.length > AVULSO_IDENT_MAX) {
    return {
      ok: false,
      message: `Identificação deve ter no máximo ${AVULSO_IDENT_MAX} caracteres.`,
    };
  }
  const qtd = Number(quantidadeRaw);
  if (!Number.isFinite(qtd) || qtd < 1) {
    return { ok: false, message: "Quantidade mínima é 1." };
  }
  const quantidade = Math.floor(qtd);
  if (quantidade > AVULSO_QTD_MAX) {
    return { ok: false, message: `Quantidade máxima é ${AVULSO_QTD_MAX}.` };
  }
  return { ok: true, quantidade, identificacao: ident || null };
}
