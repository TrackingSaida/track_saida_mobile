import { formatDateLabel, formatYmd } from "./periodoConsulta";

/** Atalhos iguais aos de date-picker-dashboard.js no web. */
export type ColetaPeriodoPreset =
  | "hoje"
  | "ontem"
  | "semana"
  | "quinzena"
  | "quinzena_anterior"
  | "mes"
  | "ultimos15"
  | "ultimos30"
  | "ultimos45"
  | "personalizado";

export type ColetaPeriodo = {
  preset: ColetaPeriodoPreset;
  dataInicio: string;
  dataFim: string;
};

type PresetFixo = Exclude<ColetaPeriodoPreset, "personalizado">;

export const COLETA_PERIODO_PRESETS: { key: ColetaPeriodoPreset; label: string; icon?: "calendar-outline" }[] = [
  { key: "hoje", label: "Hoje" },
  { key: "ontem", label: "Ontem" },
  { key: "semana", label: "Semana atual" },
  { key: "quinzena", label: "Quinzena atual" },
  { key: "quinzena_anterior", label: "Quinzena anterior" },
  { key: "mes", label: "Mês atual" },
  { key: "ultimos15", label: "Últimos 15 dias" },
  { key: "ultimos30", label: "Últimos 30 dias" },
  { key: "ultimos45", label: "Últimos 45 dias" },
  { key: "personalizado", label: "Início e fim", icon: "calendar-outline" },
];

/** Mesma conta de getPresetRange no componente web, inclusive quinzena até o fim do bloco. */
export function intervaloPresetColeta(preset: PresetFixo, ref: Date = new Date()): { inicio: string; fim: string } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  let start: Date;
  let end: Date;
  switch (preset) {
    case "ontem":
      start = new Date(y, m, d - 1);
      end = new Date(y, m, d - 1);
      break;
    case "hoje":
      start = new Date(y, m, d);
      end = new Date(y, m, d);
      break;
    case "semana": {
      const day = ref.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start = new Date(y, m, d + diff);
      end = new Date(y, m, d + diff + 6);
      break;
    }
    case "quinzena":
      if (d > 15) {
        start = new Date(y, m, 16);
        end = new Date(y, m + 1, 0);
      } else {
        start = new Date(y, m, 1);
        end = new Date(y, m, 15);
      }
      break;
    case "quinzena_anterior":
      if (d > 15) {
        start = new Date(y, m, 1);
        end = new Date(y, m, 15);
      } else {
        start = new Date(y, m - 1, 16);
        end = new Date(y, m, 0);
      }
      break;
    case "mes":
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 0);
      break;
    case "ultimos15":
      start = new Date(y, m, d - 14);
      end = new Date(y, m, d);
      break;
    case "ultimos30":
      start = new Date(y, m, d - 29);
      end = new Date(y, m, d);
      break;
    case "ultimos45":
      start = new Date(y, m, d - 44);
      end = new Date(y, m, d);
      break;
    default:
      start = new Date(y, m, d);
      end = new Date(y, m, d);
  }
  return { inicio: formatYmd(start), fim: formatYmd(end) };
}

export function buildColetaPeriodo(preset: PresetFixo, ref: Date = new Date()): ColetaPeriodo {
  const intervalo = intervaloPresetColeta(preset, ref);
  return { preset, dataInicio: intervalo.inicio, dataFim: intervalo.fim };
}

export function periodoPersonalizado(inicio: string, fim: string): ColetaPeriodo {
  return { preset: "personalizado", dataInicio: inicio, dataFim: fim };
}

const ROTULO_PRESET: Partial<Record<ColetaPeriodoPreset, string>> = {
  hoje: "Hoje",
  ontem: "Ontem",
  semana: "Semana atual",
  quinzena: "Quinzena atual",
  quinzena_anterior: "Quinzena anterior",
  mes: "Mês atual",
  ultimos15: "Últimos 15 dias",
  ultimos30: "Últimos 30 dias",
  ultimos45: "Últimos 45 dias",
};

export function labelColetaPeriodo(periodo: ColetaPeriodo): string {
  if (periodo.dataInicio === periodo.dataFim) {
    if (periodo.preset === "hoje" || periodo.preset === "ontem") {
      return `${ROTULO_PRESET[periodo.preset]} (${formatDateLabel(periodo.dataFim)})`;
    }
    return formatDateLabel(periodo.dataFim);
  }
  const intervalo = `${formatDateLabel(periodo.dataInicio)} – ${formatDateLabel(periodo.dataFim)}`;
  const nome = ROTULO_PRESET[periodo.preset];
  return nome ? `${nome} (${intervalo})` : intervalo;
}
