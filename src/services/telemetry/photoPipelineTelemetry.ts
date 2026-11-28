import {
  PHOTO_PIPELINE_TIMEOUT_MS,
  type PhotoFlowKind,
  type PhotoPipelineSource,
} from "../photoFlowUtils";
import { flushTelemetry, trackTelemetry } from "./telemetryClient";

export type FotoStageName =
  | "shutter_start"
  | "capture_done"
  | "capture_fail"
  | "prepare_start"
  | "prepare_done"
  | "prepare_fail"
  | "form_attached"
  | "pipeline_timeout"
  | "pipeline_abort";

export type TrackFotoStageInput = {
  stage: FotoStageName;
  attempt_id: string;
  source: PhotoPipelineSource;
  kind?: PhotoFlowKind | string | null;
  id_saida?: number | null;
  client_action_id?: string | null;
  duration_ms?: number | null;
  bytes_in?: number | null;
  bytes_out?: number | null;
  skipped_resize?: boolean | null;
  error_code?: string | null;
  /** Flush imediato (falha/timeout). */
  flushNow?: boolean;
};

export async function trackBaixaFotoStage(input: TrackFotoStageInput): Promise<void> {
  const props: Record<string, unknown> = {
    attempt_id: input.attempt_id,
    source: input.source,
    timeout_ms: PHOTO_PIPELINE_TIMEOUT_MS,
  };
  if (input.kind) props.kind = input.kind;
  if (typeof input.bytes_in === "number") props.bytes_in = input.bytes_in;
  if (typeof input.bytes_out === "number") props.bytes_out = input.bytes_out;
  if (typeof input.skipped_resize === "boolean") props.skipped_resize = input.skipped_resize;
  if (input.error_code) props.error_code = input.error_code;

  await trackTelemetry({
    event_name: "baixa_foto_stage",
    client_action_id: input.client_action_id ?? null,
    id_saida: input.id_saida ?? null,
    duration_ms: input.duration_ms ?? null,
    stage: input.stage,
    props,
  });

  if (input.flushNow) {
    void flushTelemetry();
  }
}
