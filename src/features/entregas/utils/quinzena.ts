/**
 * Retorna as datas (YYYY-MM-DD) da quinzena atual e da anterior.
 * Quinzena 1 = dias 1-15; quinzena 2 = dias 16 até o fim do mês.
 * Ordem: mais recente primeiro.
 */
export function getDiasQuinzenaAtualEAnterior(): string[] {
  const now = new Date();
  const ano = now.getFullYear();
  const mes = now.getMonth();
  const dia = now.getDate();

  const dias: string[] = [];

  function addDias(anoA: number, mesA: number, inicio: number, fim: number) {
    for (let d = fim; d >= inicio; d--) {
      const data = new Date(anoA, mesA, d);
      if (data > now) continue;
      const y = data.getFullYear();
      const m = String(data.getMonth() + 1).padStart(2, "0");
      const day = String(data.getDate()).padStart(2, "0");
      dias.push(`${y}-${m}-${day}`);
    }
  }

  const ultimoDiaMesAtual = new Date(ano, mes + 1, 0).getDate();

  if (dia <= 15) {
    addDias(ano, mes, 1, 15);
    const mesAnterior = mes === 0 ? 11 : mes - 1;
    const anoAnterior = mes === 0 ? ano - 1 : ano;
    const ultimoDiaAnterior = new Date(anoAnterior, mesAnterior + 1, 0).getDate();
    addDias(anoAnterior, mesAnterior, 16, ultimoDiaAnterior);
  } else {
    addDias(ano, mes, 16, ultimoDiaMesAtual);
    addDias(ano, mes, 1, 15);
  }

  return dias;
}

export function formatarDiaParaExibicao(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${date.getDate()} de ${meses[date.getMonth()]}`;
}

export function getQuinzenaAtualIntervalo(): { inicio: string; fim: string } {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();
  const inicioDia = hoje.getDate() <= 15 ? 1 : 16;
  const inicio = new Date(ano, mes, inicioDia);
  const yI = inicio.getFullYear();
  const mI = String(inicio.getMonth() + 1).padStart(2, "0");
  const dI = String(inicio.getDate()).padStart(2, "0");
  const yF = hoje.getFullYear();
  const mF = String(hoje.getMonth() + 1).padStart(2, "0");
  const dF = String(hoje.getDate()).padStart(2, "0");
  return {
    inicio: `${yI}-${mI}-${dI}`,
    fim: `${yF}-${mF}-${dF}`,
  };
}
