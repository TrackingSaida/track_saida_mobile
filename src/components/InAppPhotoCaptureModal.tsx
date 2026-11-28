import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CAMERA_HARDWARE_RELEASE_MS,
  PHOTO_PIPELINE_TIMEOUT_MS,
  createPhotoAttemptId,
  pickComprovantePictureSize,
} from "../services/photoFlowUtils";
import {
  persistCapturedPhoto,
  preparePhoto,
} from "../services/deliveryPhotoService";
import { savePendingCaptureUri } from "../services/deliveryPhotoDraft";
import { setRouteTrackingProfile } from "../services/location/locationService";
import { trackBaixaFotoStage } from "../services/telemetry/photoPipelineTelemetry";
import { usePhotoCaptureStore } from "../store/photoCaptureStore";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function InAppPhotoCaptureModal() {
  const insets = useSafeAreaInsets();
  const active = usePhotoCaptureStore((s) => s.modalVisible);
  const processing = usePhotoCaptureStore((s) => s.processing);
  const complete = usePhotoCaptureStore((s) => s.complete);
  const setProcessing = usePhotoCaptureStore((s) => s.setProcessing);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setCameraReady(false);
      setCapturing(false);
      setPictureSize(undefined);
      busyRef.current = false;
      void setRouteTrackingProfile("route");
      return;
    }
    void setRouteTrackingProfile("photo");
    const timer = setTimeout(() => setCameraReady(true), CAMERA_HARDWARE_RELEASE_MS);
    return () => {
      clearTimeout(timer);
      void setRouteTrackingProfile("route");
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [active, permission, requestPermission]);

  const handleCameraReady = async () => {
    const camera = cameraRef.current;
    if (!camera) return;
    try {
      const sizes = await camera.getAvailablePictureSizesAsync();
      const chosen = pickComprovantePictureSize(sizes);
      if (chosen) setPictureSize(chosen);
    } catch (e) {
      console.warn("[InAppPhotoCapture] pictureSize indisponível", e);
    }
  };

  const handleCancel = () => {
    if (busyRef.current || processing) return;
    const scope = usePhotoCaptureStore.getState().getCaptureScope();
    const attemptId = scope?.attemptId || createPhotoAttemptId();
    void trackBaixaFotoStage({
      stage: "pipeline_abort",
      attempt_id: attemptId,
      source: "camera",
      kind: scope?.kind,
      id_saida: scope?.idSaida ?? null,
      client_action_id: scope?.clientActionId ?? null,
      flushNow: true,
    });
    complete({ ok: false, reason: "cancel" });
  };

  const handleShutter = async () => {
    if (busyRef.current || capturing || processing) return;
    const camera = cameraRef.current;
    if (!camera) return;

    const scope = usePhotoCaptureStore.getState().getCaptureScope();
    const attemptId = scope?.attemptId || createPhotoAttemptId();
    const kind = scope?.kind ?? null;
    const idSaida = scope?.idSaida ?? null;
    const clientActionId = scope?.clientActionId ?? null;
    const pipelineStarted = Date.now();

    busyRef.current = true;
    setCapturing(true);
    setProcessing(true);

    void trackBaixaFotoStage({
      stage: "shutter_start",
      attempt_id: attemptId,
      source: "camera",
      kind,
      id_saida: idSaida,
      client_action_id: clientActionId,
    });

    const failTimeout = () => {
      void trackBaixaFotoStage({
        stage: "pipeline_timeout",
        attempt_id: attemptId,
        source: "camera",
        kind,
        id_saida: idSaida,
        client_action_id: clientActionId,
        duration_ms: Date.now() - pipelineStarted,
        error_code: "TIMEOUT",
        flushNow: true,
      });
      complete({
        ok: false,
        reason: "timeout",
        message:
          "O processamento da foto demorou mais que o esperado.\nTente novamente.",
        errorCode: "TIMEOUT",
      });
    };

    try {
      const picture = await Promise.race([
        camera.takePictureAsync({
          quality: 0.55,
          exif: false,
          base64: false,
          shutterSound: false,
        }),
        sleep(PHOTO_PIPELINE_TIMEOUT_MS).then(() => {
          throw Object.assign(new Error("timeout"), { name: "PhotoPipelineTimeout" });
        }),
      ]);

      if (!picture?.uri) {
        void trackBaixaFotoStage({
          stage: "capture_fail",
          attempt_id: attemptId,
          source: "camera",
          kind,
          id_saida: idSaida,
          client_action_id: clientActionId,
          duration_ms: Date.now() - pipelineStarted,
          error_code: "EMPTY_URI",
          flushNow: true,
        });
        complete({
          ok: false,
          reason: "error",
          message: "Não foi possível capturar a foto. Tente novamente.",
          errorCode: "EMPTY_URI",
        });
        return;
      }

      const persisted = await persistCapturedPhoto(picture.uri);
      await savePendingCaptureUri(persisted.uri, scope);

      void trackBaixaFotoStage({
        stage: "capture_done",
        attempt_id: attemptId,
        source: "camera",
        kind,
        id_saida: idSaida,
        client_action_id: clientActionId,
        duration_ms: Date.now() - pipelineStarted,
      });

      const remaining = Math.max(
        1_000,
        PHOTO_PIPELINE_TIMEOUT_MS - (Date.now() - pipelineStarted)
      );
      const prepared = await Promise.race([
        preparePhoto(persisted.uri, undefined, {
          attemptId,
          clientActionId,
          kind,
          idSaida,
          source: "camera",
          trackStages: true,
        }),
        sleep(remaining).then(() => {
          throw Object.assign(new Error("timeout"), { name: "PhotoPipelineTimeout" });
        }),
      ]);

      complete({ ok: true, photo: prepared });
    } catch (e) {
      if (e instanceof Error && e.name === "PhotoPipelineTimeout") {
        failTimeout();
        return;
      }
      console.warn("[InAppPhotoCapture] falha ao capturar/processar", e);
      void trackBaixaFotoStage({
        stage: "capture_fail",
        attempt_id: attemptId,
        source: "camera",
        kind,
        id_saida: idSaida,
        client_action_id: clientActionId,
        duration_ms: Date.now() - pipelineStarted,
        error_code: "CAPTURE_FAIL",
        flushNow: true,
      });
      complete({
        ok: false,
        reason: "error",
        message: "Não foi possível processar a foto. Tente novamente.",
        errorCode: "CAPTURE_FAIL",
      });
    } finally {
      busyRef.current = false;
      setCapturing(false);
      setProcessing(false);
    }
  };

  const permissionDenied = permission && !permission.granted;
  const busy = capturing || processing;

  return (
    <Modal
      visible={active}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      <View style={styles.root}>
        {cameraReady && !permissionDenied ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            pictureSize={pictureSize}
            onCameraReady={() => {
              void handleCameraReady();
            }}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
        )}

        <View style={[styles.topBar, { paddingTop: Math.max(12, insets.top) }]}>
          <TouchableOpacity onPress={handleCancel} disabled={busy} style={styles.topBtn}>
            <Text style={styles.topBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Foto do comprovante</Text>
          <View style={styles.topBtn} />
        </View>

        {permissionDenied ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionText}>Permita o uso da câmera para tirar a foto.</Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={() => void requestPermission()}>
              <Text style={styles.permissionBtnText}>Permitir câmera</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.bottomBar, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
          <Text style={styles.hint}>Aponte para o comprovante e toque no botão</Text>
          <TouchableOpacity
            style={[styles.shutter, busy && styles.shutterDisabled]}
            onPress={() => void handleShutter()}
            disabled={busy || !cameraReady || !!permissionDenied}
            accessibilityLabel="Tirar foto"
          >
            {busy ? (
              <ActivityIndicator color="#111" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>
        </View>

        {processing ? (
          <View style={styles.processingOverlay} pointerEvents="auto">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.processingText}>Processando foto…</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  placeholder: { backgroundColor: "#000" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  topBtn: { minWidth: 88 },
  topBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  title: { color: "#fff", fontSize: 16, fontWeight: "700" },
  permissionBox: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    zIndex: 3,
  },
  permissionText: { color: "#fff", fontSize: 16, textAlign: "center", marginBottom: 16 },
  permissionBtn: {
    backgroundColor: "#0d6efd",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    },
  permissionBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingTop: 16,
  },
  hint: { color: "#fff", fontSize: 14, marginBottom: 16, textAlign: "center" },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  shutterDisabled: { opacity: 0.7 },
  shutterInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  processingText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
