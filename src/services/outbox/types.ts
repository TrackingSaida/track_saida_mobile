import type { EntregueBody } from "../../features/entregas/api";

export type OutboxActionKind = "entregue" | "ausente";

export type OutboxPhotoEntry = {
  localUri: string;
  uploadedKeys?: string[];
  status: "pending" | "uploaded" | "failed";
};

export type OutboxActionState = "pending" | "syncing" | "failed" | "done";

export type OutboxDeliveryAction = {
  actionId: string;
  clientActionId: string;
  kind: OutboxActionKind;
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
