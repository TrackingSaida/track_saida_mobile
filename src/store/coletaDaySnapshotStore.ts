import * as FileSystem from "expo-file-system/legacy";
import { create } from "zustand";
import type { BaseItem } from "../features/operacao/basesApi";
import type {
  ColetaOperacionalConfig,
  SituacaoBaseColeta,
  TotaisColetaBase,
} from "../features/operacao/coletasApi";
import { hojeOperacaoLocal } from "../features/operacao/utils/coletaSituacaoUi";

const SNAPSHOT_FILE = "coleta_day_snapshot.json";
const SNAPSHOT_VERSION = 1 as const;

export type ColetaBaseLocalState = {
  totaisLocais: TotaisColetaBase;
  pendentesLeitura: number;
  finalizadaLocal: boolean;
  idExecucao?: number | null;
  modoFinalizar?: "coletado" | "sem_volume";
};

export type ColetaDaySnapshot = {
  version: typeof SNAPSHOT_VERSION;
  dataOperacao: string;
  subBase: string;
  savedAt: string;
  config: ColetaOperacionalConfig | null;
  bases: BaseItem[];
  situacaoItens: SituacaoBaseColeta[];
  estadoPorBaseId: Record<number, ColetaBaseLocalState>;
};

type ColetaDaySnapshotState = {
  snapshot: ColetaDaySnapshot | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  saveSnapshot: ( partial: Omit<ColetaDaySnapshot, "version" | "savedAt">) => Promise<void>;
  patchEstadoBase: (baseId: number, patch: Partial<ColetaBaseLocalState>) => Promise<void>;
  clear: () => Promise<void>;
};

function snapshotPath(): string {
  return `${FileSystem.documentDirectory || ""}${SNAPSHOT_FILE}`;
}

const TOTAIS_VAZIOS: TotaisColetaBase = { total: 0, shopee: 0, mercado_livre: 0, avulso: 0 };

export function emptyBaseLocalState(): ColetaBaseLocalState {
  return {
    totaisLocais: { ...TOTAIS_VAZIOS },
    pendentesLeitura: 0,
    finalizadaLocal: false,
    idExecucao: null,
  };
}

async function readDisk(): Promise<ColetaDaySnapshot | null> {
  try {
    const path = snapshotPath();
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as ColetaDaySnapshot;
    if (!parsed || parsed.version !== SNAPSHOT_VERSION) return null;
    if (!Array.isArray(parsed.bases) || !Array.isArray(parsed.situacaoItens)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeDisk(snapshot: ColetaDaySnapshot): Promise<void> {
  await FileSystem.writeAsStringAsync(snapshotPath(), JSON.stringify(snapshot));
}

export const useColetaDaySnapshotStore = create<ColetaDaySnapshotState>((set, get) => ({
  snapshot: null,
  hydrated: false,

  hydrate: async () => {
    const snap = await readDisk();
    set({ snapshot: snap, hydrated: true });
  },

  saveSnapshot: async (partial) => {
    const prev = get().snapshot;
    const next: ColetaDaySnapshot = {
      version: SNAPSHOT_VERSION,
      dataOperacao: partial.dataOperacao,
      subBase: partial.subBase,
      savedAt: new Date().toISOString(),
      config: partial.config,
      bases: partial.bases,
      situacaoItens: partial.situacaoItens,
      estadoPorBaseId: {
        ...(prev?.dataOperacao === partial.dataOperacao ? prev.estadoPorBaseId : {}),
        ...partial.estadoPorBaseId,
      },
    };
    await writeDisk(next);
    set({ snapshot: next, hydrated: true });
  },

  patchEstadoBase: async (baseId, patch) => {
    const current = get().snapshot;
    if (!current) return;
    const prev = current.estadoPorBaseId[baseId] || emptyBaseLocalState();
    const nextEstado = { ...prev, ...patch };
    if (patch.totaisLocais) {
      nextEstado.totaisLocais = { ...prev.totaisLocais, ...patch.totaisLocais };
    }
    const next: ColetaDaySnapshot = {
      ...current,
      savedAt: new Date().toISOString(),
      estadoPorBaseId: {
        ...current.estadoPorBaseId,
        [baseId]: nextEstado,
      },
    };
    await writeDisk(next);
    set({ snapshot: next });
  },

  clear: async () => {
    try {
      await FileSystem.deleteAsync(snapshotPath(), { idempotent: true });
    } catch {
      /* ignore */
    }
    set({ snapshot: null });
  },
}));

/** Snapshot válido para o dia operacional corrente (mesmo dataOperacao + sub_base). */
export function snapshotDoDiaAtual(
  snapshot: ColetaDaySnapshot | null,
  dataOperacao: string = hojeOperacaoLocal(),
  subBase?: string | null
): ColetaDaySnapshot | null {
  if (!snapshot) return null;
  if ((snapshot.dataOperacao || "").slice(0, 10) !== dataOperacao.slice(0, 10)) return null;
  if (subBase != null && String(subBase).trim()) {
    const expected = String(subBase).trim();
    const got = String(snapshot.subBase || "").trim();
    if (got && got !== expected) return null;
  }
  return snapshot;
}
