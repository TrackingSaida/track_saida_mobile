import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TextInput,
  ScrollView,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import type { EntregaListItem } from "../types";
import { SERVICO_ORDER } from "../utils/servico";
import {
  routePriorityLabel,
  ROUTE_PRIORITY_NONE,
  type RoutePriority,
} from "../utils/routePriority";

interface RoutePriorityModalProps {
  visible: boolean;
  current: RoutePriority;
  packages?: EntregaListItem[];
  onClose: () => void;
  onSave: (priority: RoutePriority) => void;
}

export default function RoutePriorityModal({
  visible,
  current,
  packages = [],
  onClose,
  onSave,
}: RoutePriorityModalProps) {
  const colors = useThemeColors();
  const [draft, setDraft] = useState<RoutePriority>(current);
  const [pickPackage, setPickPackage] = useState(false);
  const [codigoQuery, setCodigoQuery] = useState("");

  const withAddress = useMemo(
    () => packages.filter((p) => p.possui_endereco || (p.latitude != null && p.longitude != null)),
    [packages]
  );

  const filteredPackages = useMemo(() => {
    const q = codigoQuery.trim().toLowerCase();
    if (!q) return withAddress;
    return withAddress.filter((p) => (p.codigo ?? "").toLowerCase().includes(q));
  }, [withAddress, codigoQuery]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "center",
          padding: 20,
        },
        box: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 12,
          padding: 16,
          maxHeight: "85%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        help: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
        btn: {
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 8,
          marginBottom: 8,
        },
        btnPrimary: { backgroundColor: colors.primary },
        btnOutline: {
          backgroundColor: colors.inputBackground,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        btnText: { fontSize: 15, fontWeight: "600", color: colors.primaryContrast, textAlign: "center" },
        btnOutlineText: { fontSize: 15, fontWeight: "600", color: colors.text, textAlign: "center" },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 8,
          padding: 10,
          color: colors.text,
          marginBottom: 10,
        },
        pkgRow: {
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        pkgCodigo: { fontSize: 15, fontWeight: "600", color: colors.text },
        pkgAddr: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
      }),
    [colors]
  );

  const openWithCurrent = () => {
    setDraft(current);
    setPickPackage(false);
    setCodigoQuery("");
  };

  const selectNone = () => {
    setDraft(ROUTE_PRIORITY_NONE);
    setPickPackage(false);
  };

  const selectService = (value: (typeof SERVICO_ORDER)[number]) => {
    setDraft({ type: "service", value });
    setPickPackage(false);
  };

  const selectDelivery = (item: EntregaListItem) => {
    setDraft({ type: "delivery", idSaida: item.id_saida });
    setPickPackage(false);
    onSave({ type: "delivery", idSaida: item.id_saida });
    onClose();
  };

  const isSelected = (p: RoutePriority) => {
    if (draft.type !== p.type) return false;
    if (p.type === "none") return draft.type === "none";
    if (p.type === "service" && draft.type === "service") return draft.value === p.value;
    return false;
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} onShow={openWithCurrent}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Priorizar por</Text>
          <Text style={styles.help}>
            A rota continua priorizando proximidade. O serviço escolhido será antecipado quando
            estiver na mesma região.
          </Text>

          {!pickPackage ? (
            <>
              <TouchableOpacity
                style={[styles.btn, isSelected(ROUTE_PRIORITY_NONE) ? styles.btnPrimary : styles.btnOutline]}
                onPress={selectNone}
              >
                <Text style={isSelected(ROUTE_PRIORITY_NONE) ? styles.btnText : styles.btnOutlineText}>
                  Nenhum {draft.type === "none" ? "✓" : ""}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.btn,
                  draft.type === "service" && draft.value === "Flex" ? styles.btnPrimary : styles.btnOutline,
                ]}
                onPress={() => selectService("Flex")}
              >
                <Text
                  style={
                    draft.type === "service" && draft.value === "Flex"
                      ? styles.btnText
                      : styles.btnOutlineText
                  }
                >
                  Mercado Livre / Flex {draft.type === "service" && draft.value === "Flex" ? "✓" : ""}
                </Text>
              </TouchableOpacity>
              {SERVICO_ORDER.filter((s) => s !== "Flex").map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.btn,
                    draft.type === "service" && draft.value === s ? styles.btnPrimary : styles.btnOutline,
                  ]}
                  onPress={() => selectService(s)}
                >
                  <Text
                    style={
                      draft.type === "service" && draft.value === s
                        ? styles.btnText
                        : styles.btnOutlineText
                    }
                  >
                    {s} {draft.type === "service" && draft.value === s ? "✓" : ""}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.btn, styles.btnOutline]}
                onPress={() => setPickPackage(true)}
              >
                <Text style={styles.btnOutlineText}>
                  Pacote específico{" "}
                  {draft.type === "delivery"
                    ? `✓ (${routePriorityLabel(draft, packages.find((p) => p.id_saida === draft.idSaida)?.codigo ?? undefined)})`
                    : ""}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary, { marginTop: 8 }]}
                onPress={() => {
                  onSave(draft);
                  onClose();
                }}
              >
                <Text style={styles.btnText}>Salvar preferência</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={onClose}>
                <Text style={styles.btnOutlineText}>Cancelar</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput
                style={styles.input}
                placeholder="Buscar código do pacote"
                placeholderTextColor={colors.textSecondary}
                value={codigoQuery}
                onChangeText={setCodigoQuery}
                autoCapitalize="characters"
              />
              <ScrollView style={{ maxHeight: 280 }}>
                {filteredPackages.map((item) => (
                  <TouchableOpacity
                    key={item.id_saida}
                    style={styles.pkgRow}
                    onPress={() => selectDelivery(item)}
                  >
                    <Text style={styles.pkgCodigo}>{item.codigo?.trim() || `#${item.id_saida}`}</Text>
                    <Text style={styles.pkgAddr} numberOfLines={1}>
                      {item.endereco_formatado || item.endereco || "—"}
                    </Text>
                  </TouchableOpacity>
                ))}
                {filteredPackages.length === 0 && (
                  <Text style={styles.help}>Nenhum pacote com endereço encontrado.</Text>
                )}
              </ScrollView>
              <TouchableOpacity
                style={[styles.btn, styles.btnOutline, { marginTop: 8 }]}
                onPress={() => setPickPackage(false)}
              >
                <Text style={styles.btnOutlineText}>Voltar</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
