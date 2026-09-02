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
import { CAMERA_HARDWARE_RELEASE_MS } from "../services/photoFlowUtils";
import { persistCapturedPhoto } from "../services/deliveryPhotoService";
import { savePendingCaptureUri } from "../services/deliveryPhotoDraft";
import { usePhotoCaptureStore } from "../store/photoCaptureStore";

export default function InAppPhotoCaptureModal() {
  const insets = useSafeAreaInsets();
  const active = usePhotoCaptureStore((s) => s.modalVisible);
  const complete = usePhotoCaptureStore((s) => s.complete);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setCameraReady(false);
      setCapturing(false);
      busyRef.current = false;
      return;
    }
    const timer = setTimeout(() => setCameraReady(true), CAMERA_HARDWARE_RELEASE_MS);
    return () => clearTimeout(timer);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    if (permission && !permission.granted && permission.canAskAgain) {
      void requestPermission();
    }
  }, [active, permission, requestPermission]);

  const handleCancel = () => {
    if (busyRef.current) return;
    complete(null);
  };

  const handleShutter = async () => {
    if (busyRef.current || capturing) return;
    const camera = cameraRef.current;
    if (!camera) return;
    busyRef.current = true;
    setCapturing(true);
    try {
      const picture = await camera.takePictureAsync({
        quality: 0.55,
        exif: false,
        base64: false,
        shutterSound: false,
      });
      if (!picture?.uri) {
        complete(null);
        return;
      }
      const persisted = await persistCapturedPhoto(picture.uri);
      await savePendingCaptureUri(persisted.uri);
      complete(persisted);
    } catch (e) {
      console.warn("[InAppPhotoCapture] falha ao capturar", e);
      complete(null);
    } finally {
      busyRef.current = false;
      setCapturing(false);
    }
  };

  const permissionDenied = permission && !permission.granted;

  return (
    <Modal
      visible={active}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={handleCancel}
    >
      <View style={styles.root}>
        {cameraReady && !permissionDenied ? (
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.placeholder]} />
        )}

        <View style={[styles.topBar, { paddingTop: Math.max(12, insets.top) }]}>
          <TouchableOpacity onPress={handleCancel} disabled={capturing} style={styles.topBtn}>
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
            style={[styles.shutter, capturing && styles.shutterDisabled]}
            onPress={() => void handleShutter()}
            disabled={capturing || !cameraReady || !!permissionDenied}
            accessibilityLabel="Tirar foto"
          >
            {capturing ? (
              <ActivityIndicator color="#111" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </TouchableOpacity>
        </View>
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
});
