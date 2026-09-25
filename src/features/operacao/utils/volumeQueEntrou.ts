/** Volume Coletas ∪ Entradas quando não há IDs (por serviço / fallback). */
export function volumeQueEntrouAprox(coletas: number, entradas: number): number {
  const c = Math.max(0, Number(coletas) || 0);
  const e = Math.max(0, Number(entradas) || 0);
  if (c === 0) return e;
  if (e === 0) return c;
  return c + e;
}

export function subtituloVolumeQueEntrou(coletas: number, entradas: number): string {
  const c = Math.max(0, Number(coletas) || 0);
  const e = Math.max(0, Number(entradas) || 0);
  return `Coletas ${c} · Entradas ${e}`;
}
