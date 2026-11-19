import * as FileSystem from "expo-file-system/legacy";
import { getMotivosAusencia } from "../api";
import type { MotivoAusencia } from "../types";
import { isOnline } from "../../../services/outbox/networkStatus";

const CACHE_FILE = "motivos_ausencia_cache_v1.json";

let memoryCache: MotivoAusencia[] = [];

function cachePath(): string {
  return `${FileSystem.documentDirectory}${CACHE_FILE}`;
}

async function readDiskCache(): Promise<MotivoAusencia[]> {
  try {
    const path = cachePath();
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(path);
    const parsed = JSON.parse(raw) as MotivoAusencia[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeDiskCache(list: MotivoAusencia[]): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(cachePath(), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Busca motivos online e atualiza cache; offline (ou falha) usa última lista salva. */
export async function getMotivosAusenciaCached(): Promise<MotivoAusencia[]> {
  const online = await isOnline();
  if (online) {
    try {
      const list = await getMotivosAusencia();
      if (Array.isArray(list) && list.length > 0) {
        memoryCache = list;
        void writeDiskCache(list);
        return list;
      }
    } catch {
      /* cai no cache */
    }
  }
  if (memoryCache.length > 0) return memoryCache;
  const disk = await readDiskCache();
  if (disk.length > 0) {
    memoryCache = disk;
    return disk;
  }
  return [];
}
