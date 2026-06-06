import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, Alert } from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { useMotoboyPrefsStore } from "../../../store/motoboyPrefsStore";
import type { EntregaListItem } from "../types";
import type { AddressFormValues } from "./AddressForm";
import AddressQuickForm, { type QuickFormFlowState } from "./AddressQuickForm";
import { getStopAddressLine, getStopPedidoLabel } from "../utils/routeUtils";

interface RouteEditAddressSheetProps {
  visible: boolean;
  delivery: EntregaListItem | null;
  onSave: (values: AddressFormValues) => Promise<void>;
  onClose: () => void;
}

function deliveryToFreeText(d: EntregaListItem): string {
  const parts = [d.endereco, d.numero, d.bairro, d.cep].filter(Boolean);
  if (parts.length > 0) return parts.join(", ");
  return d.endereco_formatado ?? "";
}

export default function RouteEditAddressSheet({
  visible,
  delivery,
  onSave,
  onClose,
}: RouteEditAddressSheetProps) {
  const colors = useThemeColors();
  const cidadePadrao = useMotoboyPrefsStore((s) => s.cidadePadrao);
  const estadoPadrao = useMotoboyPrefsStore((s) => s.estadoPadrao);
  const [flowState, setFlowState] = useState<QuickFormFlowState>("idle");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "flex-end",
        },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingTop: 16,
          maxHeight: "90%",
          minHeight: 420,
          height: "85%",
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          marginBottom: 4,
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text },
        subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
        closeText: { fontSize: 16, color: colors.textSecondary },
        formWrap: { flex: 1, minHeight: 300 },
      }),
    [colors]
  );

  if (!delivery) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.title}>Editar endereço</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {getStopPedidoLabel(delivery)} · {delivery.codigo || "—"}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {getStopAddressLine(delivery)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.formWrap}>
            <AddressQuickForm
              delivery={delivery}
              flowState={flowState}
              cidadePadrao={cidadePadrao}
              estadoPadrao={estadoPadrao}
              initialFreeText={deliveryToFreeText(delivery)}
              hidePackageCard
              showInputActions={false}
              submitLabel="Salvar endereço"
              onFlowStateChange={setFlowState}
              onSaveAndNext={onSave}
              onDictate={() =>
                Alert.alert("Indisponível", "Use o campo de texto para editar o endereço.")
              }
              onOcr={() =>
                Alert.alert("Indisponível", "Use o campo de texto para editar o endereço.")
              }
              onCancel={onClose}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
