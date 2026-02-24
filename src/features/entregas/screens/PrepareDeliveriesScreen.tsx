import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useThemeColors } from "../../../theme/colors";
import { useDeliveryStore } from "../../../store/deliveryStore";
import AddressForm, { type AddressFormValues, type AddressOrigem } from "../components/AddressForm";

type Props = NativeStackScreenProps<RootStackParamList, "PrepareDeliveries">;

export default function PrepareDeliveriesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        content: { padding: 24 },
        center: { flex: 1, justifyContent: "center", alignItems: "center" },
        header: { marginBottom: 24 },
        backText: { fontSize: 16, color: colors.primary, marginBottom: 8 },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        card: {
          backgroundColor: colors.backgroundCard,
          padding: 20,
          borderRadius: 12,
          marginBottom: 24,
          shadowColor: colors.shadowColor,
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        },
        totalLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
        totalValue: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 16 },
        row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
        label: { fontSize: 14, color: colors.textSecondary },
        value: { fontSize: 16, fontWeight: "600", color: colors.text },
        btnSequencia: {
          backgroundColor: colors.primary,
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 12,
        },
        btnDisabled: { opacity: 0.6 },
        btnSequenciaText: { color: colors.primaryContrast, fontSize: 18, fontWeight: "600" },
        btnLista: {
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.primary,
        },
        btnListaText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
        modalWrap: { flex: 1, backgroundColor: colors.backgroundCard },
        modalHeader: {
          paddingHorizontal: 24,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: colors.separator,
        },
        modalBackText: { fontSize: 16, color: colors.primary, marginBottom: 8 },
        modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text },
        modalSubtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
        codigoCard: {
          backgroundColor: colors.primary + "18",
          borderWidth: 2,
          borderColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 16,
          marginTop: 12,
          marginBottom: 8,
        },
        codigoLabel: { fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 4, textTransform: "uppercase" },
        codigoValue: { fontSize: 22, fontWeight: "800", color: colors.text },
      }),
    [colors]
  );
  const {
    pendingDeliveries,
    deliveriesWithAddress,
    deliveriesWithoutAddress,
    loadDeliveries,
    saveAddress,
    loading,
  } = useDeliveryStore();

  const [sequenciaAtiva, setSequenciaAtiva] = useState(false);
  const [sequenciaTotal, setSequenciaTotal] = useState(0);
  const [sequenciaIndex, setSequenciaIndex] = useState(0);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const total = pendingDeliveries.length;
  const comEndereco = deliveriesWithAddress.length;
  const semEndereco = deliveriesWithoutAddress.length;
  const atual = deliveriesWithoutAddress[0];

  const handleIniciarSequencia = () => {
    if (semEndereco === 0) {
      setSequenciaAtiva(false);
      return;
    }
    setSequenciaTotal(semEndereco);
    setSequenciaIndex(0);
    setSequenciaAtiva(true);
  };

  const handleSalvarEndereco = async (vals: AddressFormValues) => {
    if (!atual) return;
    await saveAddress(atual.id_saida, { ...vals, origem: "manual" as AddressOrigem });
    const nextIndex = sequenciaIndex + 1;
    setSequenciaIndex(nextIndex);
    if (nextIndex >= sequenciaTotal) {
      setSequenciaAtiva(false);
    }
  };

  const handleFecharSequencia = () => setSequenciaAtiva(false);

  if (loading && total === 0) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: Math.max(16, insets.top), paddingBottom: 24 }]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Preparar Rota</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.totalLabel}>Total de entregas</Text>
        <Text style={styles.totalValue}>{total}</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Com endereço</Text>
          <Text style={styles.value}>{comEndereco}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Sem endereço</Text>
          <Text style={styles.value}>{semEndereco}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.btnSequencia, semEndereco === 0 && styles.btnDisabled]}
        onPress={handleIniciarSequencia}
        disabled={semEndereco === 0}
      >
        <Text style={styles.btnSequenciaText}>Adicionar Endereços em Sequência</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnLista} onPress={() => navigation.navigate("EntregasList")}>
        <Text style={styles.btnListaText}>Ir para Pendentes</Text>
      </TouchableOpacity>

      <Modal visible={sequenciaAtiva && !!atual} animationType="slide">
        <View style={styles.modalWrap}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(16, insets.top) }]}>
            <TouchableOpacity onPress={handleFecharSequencia}>
              <Text style={styles.modalBackText}>← Fechar</Text>
            </TouchableOpacity>
            <View style={styles.codigoCard}>
              <Text style={styles.codigoLabel}>Código do pedido</Text>
              <Text style={styles.codigoValue}>{atual?.codigo ?? "—"}</Text>
            </View>
            <Text style={styles.modalTitle}>
              Entrega {sequenciaIndex + 1} de {sequenciaTotal}
            </Text>
            <Text style={styles.modalSubtitle}>{atual?.cliente ? `Destinatário: ${atual.cliente}` : ""}</Text>
          </View>
          {atual && (
            <AddressForm
              idSaida={atual.id_saida}
              initialValues={{
                destinatario: atual.cliente ?? "",
                rua: "",
                numero: "",
                complemento: "",
                bairro: atual.bairro ?? "",
                cidade: "",
                estado: "",
                cep: "",
              }}
              origem="manual"
              onSave={handleSalvarEndereco}
              enableOnlyDestinatarioShortcut={false}
              onCancel={handleFecharSequencia}
              submitLabel="Salvar e próximo"
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}
