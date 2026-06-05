import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet, Linking } from "react-native";
import { useThemeColors } from "../../../theme/colors";

interface GeocodeFailureSheetProps {
  visible: boolean;
  addressQuery: string;
  onEdit: () => void;
  onSaveWithoutCoords: () => void;
  onClose: () => void;
}

export default function GeocodeFailureSheet({
  visible,
  addressQuery,
  onEdit,
  onSaveWithoutCoords,
  onClose,
}: GeocodeFailureSheetProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "flex-end" },
        box: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          padding: 20,
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        message: { fontSize: 14, color: colors.textSecondary, marginBottom: 16, lineHeight: 20 },
        address: { fontSize: 14, color: colors.text, marginBottom: 20 },
        btn: {
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          backgroundColor: colors.primary,
          marginBottom: 8,
        },
        btnText: { fontSize: 16, fontWeight: "600", color: colors.primaryContrast },
        btnOutline: {
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.inputBorder,
          marginBottom: 8,
        },
        btnOutlineText: { fontSize: 16, color: colors.text },
        cancel: { alignItems: "center", paddingVertical: 12 },
        cancelText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors]
  );

  const openMap = () => {
    const q = encodeURIComponent(addressQuery);
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Endereço não localizado</Text>
          <Text style={styles.message}>
            Não conseguimos localizar este endereço no mapa. Você pode editar, salvar sem
            coordenada ou abrir no mapa externo.
          </Text>
          <Text style={styles.address} numberOfLines={3}>
            {addressQuery}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={onEdit}>
            <Text style={styles.btnText}>Editar endereço</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={onSaveWithoutCoords}>
            <Text style={styles.btnOutlineText}>Salvar sem coordenada</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={openMap}>
            <Text style={styles.btnOutlineText}>Escolher no mapa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
