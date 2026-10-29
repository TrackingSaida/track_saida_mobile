import type { SituacaoBaseColeta } from "../coletasApi";

export function somarDiaIso(ymd: string): string {
  const partes = ymd.slice(0, 10).split("-").map(Number);
  const dt = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2] + 1));
  const mes = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mes}-${dia}`;
}

/** Dias do intervalo até hoje, inclusive. Dia futuro não entra. */
export function diasAteHoje(inicio: string, fim: string, hoje: string): string[] {
  const teto = fim < hoje ? fim : hoje;
  if (!inicio || teto < inicio) return [];
  const dias: string[] = [];
  let cursor = inicio;
  while (cursor <= teto && dias.length < 367) {
    dias.push(cursor);
    cursor = somarDiaIso(cursor);
  }
  return dias;
}

export function contarResumoColetas(itens: SituacaoBaseColeta[]): {
  pendentes: number;
  em_coleta: number;
  sem_volume: number;
  coletadas: number;
} {
  const resumo = { pendentes: 0, em_coleta: 0, sem_volume: 0, coletadas: 0 };
  itens.forEach((item) => {
    if (item.status === "em_coleta") resumo.em_coleta += 1;
    else if (item.status === "sem_volume") resumo.sem_volume += 1;
    else if (item.status === "coletado") resumo.coletadas += 1;
    else resumo.pendentes += 1;
  });
  return resumo;
}

function diaPendente(base: { id_base: number; base: string }, data: string): SituacaoBaseColeta {
  return {
    base_id: Number(base.id_base),
    base: base.base || "",
    data_operacao: data,
    status: "pendente",
    id_execucao: null,
    modo: null,
    total: 0,
    shopee: 0,
    mercado_livre: 0,
    avulso: 0,
    participantes: [],
    participando: false,
    pode_ajudar: false,
    pode_corrigir: false,
    sintetico: true,
  };
}

/**
 * Completa o período com um dia pendente para cada base ativa sem coleta.
 * A lista de execuções só traz dias já gravados.
 */
export function completarPendentesPeriodo(
  itens: SituacaoBaseColeta[],
  bases: Array<{ id_base: number; base: string }>,
  inicio: string,
  fim: string,
  hoje: string
): SituacaoBaseColeta[] {
  const dias = diasAteHoje(inicio, fim, hoje);
  if (!dias.length || !bases.length) return itens;
  const chaves = new Set(itens.map((item) => `${Number(item.base_id)}|${String(item.data_operacao || "").slice(0, 10)}`));
  const extras: SituacaoBaseColeta[] = [];
  bases.forEach((base) => {
    const id = Number(base.id_base);
    if (!id) return;
    dias.forEach((dia) => {
      const chave = `${id}|${dia}`;
      if (chaves.has(chave)) return;
      chaves.add(chave);
      extras.push(diaPendente(base, dia));
    });
  });
  return itens.concat(extras);
}
