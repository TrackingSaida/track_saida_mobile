import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../../../theme/colors";
import type { EntregaListItem } from "../types";
import { deliveryAddressSummary } from "../utils/deliveryAddress";

interface PrepAddressExistsModalProps {
  visible: boolean;
  delivery: EntregaListItem | null;
  onEdit: () => void;
  onDismiss: () => void;
}

export default function PrepAddressExistsModal({
  visible,
  delivery,
  onEdit,
  onDismiss,
}: PrepAddressExistsModalProps) {
  const colors = useThemeColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.55)",
          justifyContent: "center",
          paddingHorizontal: 24,
        },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          padding: 20,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 16,
          elevation: 8,
        },
        header: {
          alignItems: "center",
          marginBottom: 16,
        },
        iconWrap: {
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: colors.primarySoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 12,
        },
        badge: {
          alignSelf: "center",
          backgroundColor: colors.primarySoft,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 20,
          marginBottom: 8,
        },
        badgeText: {
          fontSize: 11,
          fontWeight: "700",
          color: colors.primary,
          letterSpacing: 0.4,
          textTransform: "uppercase",
        },
        title: {
          fontSize: 18,
          fontWeight: "700",
          color: colors.text,
          textAlign: "center",
        },
        subtitle: {
          fontSize: 13,
          color: colors.textSecondary,
          textAlign: "center",
          marginTop: 6,
          lineHeight: 18,
        },
        sectionLabel: {
          fontSize: 11,
          fontWeight: "700",
          color: colors.textSecondary,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          marginBottom: 6,
          marginTop: 4,
        },
        codigoBox: {
          backgroundColor: colors.chipBackground,
          borderRadius: 10,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          marginBottom: 14,
        },
        codigoText: {
          fontSize: 16,
          fontWeight: "800",
          color: colors.text,
          letterSpacing: 0.3,
        },
        pedidoText: {
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 4,
        },
        addressBox: {
          flexDirection: "row",
          alignItems: "flex-start",
          backgroundColor: colors.inputBackground,
          borderRadius: 10,
          padding: 12,
          borderWidth: 1,
          borderColor: colors.inputBorder,
          gap: 10,
          marginBottom: 20,
        },
        addressText: {
          flex: 1,
          fontSize: 14,
          color: colors.text,
          lineHeight: 20,
        },
        btnPrimary: {
          backgroundColor: colors.primary,
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          marginBottom: 10,
        },
        btnPrimaryText: {
          fontSize: 15,
          fontWeight: "700",
          color: colors.primaryContrast,
        },
        btnOutline: {
          paddingVertical: 14,
          borderRadius: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.inputBorder,
          backgroundColor: colors.backgroundCard,
        },
        btnOutlineText: {
          fontSize: 15,
          fontWeight: "600",
          color: colors.textSecondary,
        },
      }),
    [colors]
  );

  if (!delivery) return null;

  const codigo = delivery.codigo?.trim() || `Pedido ${delivery.id_saida}`;
  const address = deliveryAddressSummary(delivery);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Já preparado</Text>
            </View>
            <Text style={styles.title}>Endereço já cadastrado</Text>
            <Text style={styles.subtitle}>
              Este pacote já possui endereço na rota. Você pode continuar escaneando ou
              editar o cadastro.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Pacote</Text>
          <View style={styles.codigoBox}>
            <Text style={styles.codigoText} selectable>
              {codigo}
            </Text>
            {delivery.codigo ? (
              <Text style={styles.pedidoText}>Pedido {delivery.id_saida}</Text>
            ) : null}
          </View>

          <Text style={styles.sectionLabel}>Endereço</Text>
          <View style={styles.addressBox}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <Text style={styles.addressText} selectable>
              {address}
            </Text>
          </View>

          <TouchableOpacity style={styles.btnPrimary} onPress={onEdit} activeOpacity={0.85}>
            <Text style={styles.btnPrimaryText}>Editar endereço</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnOutline} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.btnOutlineText}>Continuar escaneando</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
