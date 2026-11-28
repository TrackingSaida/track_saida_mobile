import type { EntregueBody } from "../../features/entregas/api";

export type OutboxActionKind =
  | "entregue"
  | "ausente"
  | "devolucao"
  | "coleta_leitura"
  | "coleta_finalizar";

export type OutboxPhotoEntry = {
  localUri: string;
  photoId?: string;
  uploadedKeys?: string[];
  status: "pending" | "uploaded" | "failed";
};

export function createPhotoId(): string {
  return `ph_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export type OutboxActionState = "pending" | "syncing" | "failed" | "done";

export type ColetaLeituraItemPayload = {
  codigo: string;
  servico: string;
  qr_payload_raw?: string;
  is_grande?: boolean;
};

export type OutboxDeliveryAction = {
  actionId: string;
  clientActionId: string;
  kind: OutboxActionKind;
  /** Entregas; vazio para ações de coleta. */
  idSaidas: number[];
  createdAt: number;
  attempts: number;
  state: OutboxActionState;
  lastError?: string;
  entregueBody?: EntregueBody;
  motivoId?: number;
  observacao?: string;
  photos: OutboxPhotoEntry[];
  fotoObrigatoria: boolean;
  /** PRD-020 coleta offline */
  baseId?: number;
  baseNome?: string;
  dataOperacao?: string;
  item?: ColetaLeituraItemPayload;
  idExecucao?: number;
  finalizarModo?: "coletado" | "sem_volume";
};

export type OutboxManifest = {
  version: 1;
  actions: OutboxDeliveryAction[];
};

export const OUTBOX_MANIFEST_KEY = "delivery_outbox_manifest_v1";
export const OUTBOX_DIR = "outbox/";

export function createActionId(): string {
  return `oa_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createClientActionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function isColetaOutboxKind(kind: OutboxActionKind): boolean {
  return kind === "coleta_leitura" || kind === "coleta_finalizar";
}
