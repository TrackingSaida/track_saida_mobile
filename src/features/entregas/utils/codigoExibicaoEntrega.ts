/** Rótulo amigável do avulso quando a API envia; senão o código interno. */
export function codigoExibicaoEntrega(item: {
  codigo?: string | null;
  codigo_exibicao?: string | null;
  id_saida?: number;
}): string {
  const amigavel = String(item.codigo_exibicao ?? "").trim();
  if (amigavel) return amigavel;
  const codigo = String(item.codigo ?? "").trim();
  if (codigo) return codigo;
  if (item.id_saida != null) return `Pedido ${item.id_saida}`;
  return "";
}
