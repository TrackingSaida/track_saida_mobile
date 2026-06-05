import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme/colors";
import type { EntregaListItem } from "../types";
import AddressForm, { type AddressFormValues } from "./AddressForm";
import { getStopPedidoLabel } from "../utils/routeUtils";

interface RouteEditAddressSheetProps {
  visible: boolean;
  delivery: EntregaListItem | null;
  onSave: (values: AddressFormValues) => Promise<void>;
  onClose: () => void;
}

function deliveryToInitialValues(d: EntregaListItem): Partial<AddressFormValues> {
  return {
    destinatario: d.cliente ?? "",
    rua: d.endereco ?? "",
    numero: d.numero ?? "",
    complemento: "",
    bairro: d.bairro ?? "",
    cidade: "",
    estado: "",
    cep: d.cep ?? "",
  };
}

export default function RouteEditAddressSheet({
  visible,
  delivery,
  onSave,
  onClose,
}: RouteEditAddressSheetProps) {
  const colors = useThemeColors();
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
        },
        header: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          marginBottom: 8,
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text },
        subtitle: { fontSize: 13, color: colors.textSecondary },
        closeText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors]
  );

  if (!delivery) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Editar endereço</Text>
              <Text style={styles.subtitle}>
                {getStopPedidoLabel(delivery)} · {delivery.codigo || "—"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Fechar</Text>
            </TouchableOpacity>
          </View>
          <AddressForm
            idSaida={delivery.id_saida}
            initialValues={deliveryToInitialValues(delivery)}
            origem="manual"
            submitLabel="Salvar endereço"
            onSave={onSave}
            onCancel={onClose}
            showOcrVozIcons={false}
          />
        </View>
      </View>
    </Modal>
  );
}
