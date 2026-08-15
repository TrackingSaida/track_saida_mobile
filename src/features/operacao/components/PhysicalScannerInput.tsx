import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../../theme/colors";

const IDLE_SUBMIT_MS = 220;

type Props = {
  active: boolean;
  disabled?: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onScan: (codigo: string) => void | Promise<void>;
  children?: React.ReactNode;
};

export default function PhysicalScannerInput({
  active,
  disabled = false,
  title,
  subtitle,
  onClose,
  onScan,
  children,
}: Props) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef(false);
  const activeRef = useRef(active);
  const disabledRef = useRef(disabled);
  const [buffer, setBuffer] = useState("");
  const [processing, setProcessing] = useState(false);

  activeRef.current = active;
  disabledRef.current = disabled;

  const focusInput = useCallback(() => {
    if (!activeRef.current || disabledRef.current || processingRef.current) return;
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!active) {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      setBuffer("");
      return;
    }
    const timer = setTimeout(focusInput, 120);
    return () => clearTimeout(timer);
  }, [active, focusInput]);

  useEffect(
    () => () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    },
    []
  );

  const submit = useCallback(
    async (raw: string) => {
      const codigo = String(raw || "").replace(/[\r\n\t]+/g, "").trim();
      if (!codigo || !activeRef.current || disabledRef.current || processingRef.current) return;
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
      processingRef.current = true;
      setProcessing(true);
      setBuffer("");
      try {
        await onScan(codigo);
      } finally {
        processingRef.current = false;
        setProcessing(false);
        setTimeout(focusInput, 80);
      }
    },
    [focusInput, onScan]
  );

  const handleChangeText = useCallback(
    (value: string) => {
      if (!activeRef.current || disabledRef.current || processingRef.current) return;
      const hasTerminator = /[\r\n\t]/.test(value);
      const normalized = value.replace(/[\r\n\t]+/g, "");
      setBuffer(normalized);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (hasTerminator) {
        void submit(normalized);
        return;
      }
      idleTimerRef.current = setTimeout(() => {
        void submit(normalized);
      }, IDLE_SUBMIT_MS);
    },
    [submit]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: Math.max(16, insets.top),
          paddingHorizontal: 20,
          paddingBottom: Math.max(20, insets.bottom),
        },
        header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
        closeText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
        headerSpacer: { width: 64 },
        content: { flex: 1, justifyContent: "center", gap: 16 },
        iconWrap: {
          alignSelf: "center",
          width: 76,
          height: 76,
          borderRadius: 38,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primarySoft,
        },
        title: { color: colors.text, fontSize: 22, fontWeight: "800", textAlign: "center" },
        subtitle: {
          color: colors.textSecondary,
          fontSize: 14,
          lineHeight: 20,
          textAlign: "center",
        },
        capture: {
          borderWidth: 2,
          borderColor: processing ? colors.primary : colors.inputBorder,
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          paddingVertical: 20,
          paddingHorizontal: 16,
          alignItems: "center",
          gap: 8,
        },
        captureTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
        captureValue: { color: colors.textSecondary, fontSize: 13, textAlign: "center" },
        input: { position: "absolute", width: 1, height: 1, opacity: 0.01 },
        footer: { gap: 10 },
      }),
    [colors, insets.bottom, insets.top, processing]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar leitor">
          <Text style={styles.closeText}>← Fechar</Text>
        </Pressable>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="barcode-outline" size={38} color={colors.primary} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <Pressable style={styles.capture} onPress={focusInput}>
          {processing ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="radio-outline" size={26} color={colors.primary} />
          )}
          <Text style={styles.captureTitle}>
            {processing ? "Processando leitura…" : "Aguardando leitura…"}
          </Text>
          <Text style={styles.captureValue}>
            {buffer ? "Recebendo código…" : "Aponte o leitor para a etiqueta e acione o gatilho."}
          </Text>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={buffer}
            onChangeText={handleChangeText}
            onSubmitEditing={() => void submit(buffer)}
            onBlur={() => setTimeout(focusInput, 100)}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            showSoftInputOnFocus={false}
            editable={active && !disabled}
            accessibilityLabel="Captura do leitor físico"
          />
        </Pressable>
      </View>

      {children ? <View style={styles.footer}>{children}</View> : null}
    </View>
  );
}
