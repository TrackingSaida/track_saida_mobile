import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import type { EntregaListItem } from "../types";
import {
  formatMotoboyHomeAddress,
  type MotoboyHomeAddress,
} from "../api";
import type { AddressFormValues } from "./AddressForm";
import AddressQuickForm, { type QuickFormFlowState } from "./AddressQuickForm";

type Props = {
  visible: boolean;
  initialAddress: MotoboyHomeAddress | null;
  confirming: boolean;
  onConfirm: (address: MotoboyHomeAddress) => void | Promise<void>;
  onCancel: () => void;
};

function motoboyHomeToFreeText(addr: MotoboyHomeAddress | null | undefined): string {
  if (!addr) return "";
  const parts = [addr.rua, addr.numero, addr.bairro, addr.cep].filter(Boolean);
  return parts.join(", ");
}

function addressFormToMotoboyHome(values: AddressFormValues): MotoboyHomeAddress {
  return {
    rua: values.rua.trim(),
    numero: values.numero.trim(),
    complemento: values.complemento.trim(),
    bairro: values.bairro.trim(),
    cidade: values.cidade.trim(),
    estado: values.estado.trim().toUpperCase().slice(0, 2),
    cep: values.cep.replace(/\D/g, "").slice(0, 8),
  };
}

function stubDeliveryFromHome(addr: MotoboyHomeAddress | null): EntregaListItem {
  return {
    id_saida: 0,
    codigo: null,
    status: "",
    exibicao: "Destino da rota",
    cliente: null,
    bairro: addr?.bairro ?? null,
    endereco: addr?.rua ?? null,
    numero: addr?.numero ?? null,
    cep: addr?.cep ?? null,
    cidade: addr?.cidade ?? null,
    estado: addr?.estado ?? null,
    complemento: addr?.complemento ?? null,
    contato: null,
    data: null,
    data_hora_entrega: null,
  };
}

export default function ConfirmRouteDestinationModal({
  visible,
  initialAddress,
  confirming,
  onConfirm,
  onCancel,
}: Props) {
  const colors = useThemeColors();
  const cidadePadrao = useMotoboyPrefsStore((s) => s.cidadePadrao);
  const estadoPadrao = useMotoboyPrefsStore((s) => s.estadoPadrao);
  const [flowState, setFlowState] = useState<QuickFormFlowState>("idle");
  const [deliveryStub, setDeliveryStub] = useState<EntregaListItem>(() =>
    stubDeliveryFromHome(initialAddress)
  );
  const [initialFreeText, setInitialFreeText] = useState(() =>
    motoboyHomeToFreeText(initialAddress)
  );

  useEffect(() => {
    if (!visible) return;
    setDeliveryStub(stubDeliveryFromHome(initialAddress));
    setInitialFreeText(motoboyHomeToFreeText(initialAddress));
    setFlowState("idle");
  }, [visible, initialAddress]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingTop: 18,
          maxHeight: "88%",
          minHeight: 420,
          height: "85%",
        },
        header: {
          paddingHorizontal: 20,
          marginBottom: 8,
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 6 },
        subtitle: {
          fontSize: 14,
          color: colors.textSecondary,
          marginBottom: 8,
          lineHeight: 20,
        },
        previewBox: {
          marginHorizontal: 20,
          backgroundColor: colors.background,
          borderRadius: 12,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.separator,
          marginBottom: 8,
        },
        previewText: { fontSize: 15, color: colors.text, lineHeight: 22 },
        emptyHint: {
          marginHorizontal: 20,
          fontSize: 14,
          color: colors.warning,
          marginBottom: 8,
          lineHeight: 20,
        },
        formWrap: { flex: 1, minHeight: 280 },
        confirmingOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
        },
        btnGhost: {
          paddingVertical: 12,
          alignItems: "center",
          marginTop: 4,
          marginBottom: 12,
        },
        btnGhostText: { color: colors.textSecondary, fontSize: 14, fontWeight: "600" },
        disabled: { opacity: 0.55 },
      }),
    [colors]
  );

  const preview = initialAddress ? formatMotoboyHomeAddress(initialAddress) : "";
  const busy = confirming || flowState === "saving";

  const handleSaveDestination = async (values: AddressFormValues) => {
    if (busy) return;
    const address = addressFormToMotoboyHome(values);
    await onConfirm(address);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Confirme o endereço de destino</Text>
            <Text style={styles.subtitle}>
              A rota será montada saindo do seu local atual e terminando neste endereço (sua casa).
              O endereço vale só para esta rota — não altera seu cadastro.
            </Text>
          </View>

          {!initialAddress ? (
            <Text style={styles.emptyHint}>
              Não encontramos um endereço completo no cadastro. Informe o destino da rota.
            </Text>
          ) : preview ? (
            <View style={styles.previewBox}>
              <Text style={styles.previewText}>{preview}</Text>
            </View>
          ) : null}

          <View style={[styles.formWrap, busy && styles.disabled]}>
            <AddressQuickForm
              delivery={deliveryStub}
              flowState={flowState}
              cidadePadrao={cidadePadrao}
              estadoPadrao={estadoPadrao}
              initialFreeText={initialFreeText}
              hidePackageCard
              showInputActions={false}
              submitLabel="Confirmar e gerar rota"
              onFlowStateChange={setFlowState}
              onSaveAndNext={(vals) => handleSaveDestination(vals)}
              onDictate={() =>
                Alert.alert("Indisponível", "Use o campo de texto para informar o endereço.")
              }
              onOcr={() =>
                Alert.alert("Indisponível", "Use o campo de texto para informar o endereço.")
              }
              onCancel={onCancel}
            />
          </View>

          <TouchableOpacity
            style={[styles.btnGhost, busy && styles.disabled]}
            disabled={busy}
            onPress={onCancel}
          >
            <Text style={styles.btnGhostText}>Voltar</Text>
          </TouchableOpacity>

          {confirming ? (
            <View style={styles.confirmingOverlay} pointerEvents="auto">
              <ActivityIndicator color="#fff" size="large" />
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
