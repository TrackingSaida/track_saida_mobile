import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Alert,
  FlatList,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { geocodeAddress } from "../utils/geocode";
import type { EntregaListItem } from "../types";
import EntregaCodigoHeader from "./EntregaCodigoHeader";
import { getStopPedidoLabel } from "../utils/routeUtils";

interface RouteQuickAddSheetProps {
  visible: boolean;
  pendingDeliveries: EntregaListItem[];
  routeOrder: number[];
  onAddIds: (ids: number[]) => void;
  onClose: () => void;
}

function normalizeAddr(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

function matchByAddress(
  query: string,
  pending: EntregaListItem[],
  routeOrder: number[]
): EntregaListItem[] {
  const q = normalizeAddr(query);
  if (!q) return [];
  const inRoute = new Set(routeOrder);
  return pending.filter((d) => {
    if (inRoute.has(d.id_saida)) return false;
    const addr = normalizeAddr(
      d.endereco_formatado || [d.endereco, d.numero, d.bairro, d.cep].filter(Boolean).join(" ")
    );
    const cep = (d.cep ?? "").replace(/\D/g, "");
    return addr.includes(q) || q.includes(addr) || (cep && q.includes(cep));
  });
}

export default function RouteQuickAddSheet({
  visible,
  pendingDeliveries,
  routeOrder,
  onAddIds,
  onClose,
}: RouteQuickAddSheetProps) {
  const colors = useThemeColors();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [matches, setMatches] = useState<EntregaListItem[]>([]);

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
          padding: 20,
          maxHeight: "80%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 8,
          padding: 12,
          fontSize: 16,
          backgroundColor: colors.inputBackground,
          color: colors.text,
          marginBottom: 12,
        },
        btn: {
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.primary,
          marginBottom: 12,
        },
        btnText: { fontSize: 15, fontWeight: "600", color: colors.primaryContrast },
        item: {
          padding: 12,
          borderRadius: 8,
          backgroundColor: colors.inputBackground,
          marginBottom: 8,
        },
        itemText: { fontSize: 14, color: colors.text },
        close: { alignItems: "center", paddingVertical: 12 },
        closeText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors]
  );

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      let results = matchByAddress(q, pendingDeliveries, routeOrder);
      if (results.length === 0 && /\d{5}-?\d{3}|\d{8}/.test(q)) {
        const geo = await geocodeAddress(q);
        if (geo) {
          results = pendingDeliveries.filter(
            (d) =>
              !routeOrder.includes(d.id_saida) &&
              d.latitude != null &&
              d.longitude != null &&
              Math.abs(d.latitude - geo.latitude) < 0.01 &&
              Math.abs(d.longitude - geo.longitude) < 0.01
          );
        }
      }
      setMatches(results);
      if (results.length === 0) {
        Alert.alert(
          "Nenhum pedido encontrado",
          "Busque por endereço ou CEP de pedidos pendentes já cadastrados."
        );
      }
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = (ids: number[]) => {
    onAddIds(ids);
    setQuery("");
    setMatches([]);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Adicionar parada</Text>
          <Text style={styles.hint}>
            Informe endereço ou CEP para localizar pedidos pendentes existentes.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Endereço ou CEP"
            placeholderTextColor={colors.placeholder}
            value={query}
            onChangeText={setQuery}
          />
          <TouchableOpacity style={styles.btn} onPress={handleSearch} disabled={searching}>
            {searching ? (
              <ActivityIndicator color={colors.primaryContrast} />
            ) : (
              <Text style={styles.btnText}>Buscar</Text>
            )}
          </TouchableOpacity>
          {matches.length > 0 && (
            <>
              <Text style={styles.hint}>{matches.length} pedido(s) encontrado(s)</Text>
              <FlatList
                data={matches}
                keyExtractor={(item) => String(item.id_saida)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.item}
                    onPress={() => handleAdd([item.id_saida])}
                  >
                    <Text style={styles.itemText}>{getStopPedidoLabel(item)}</Text>
                    <EntregaCodigoHeader
                      codigo={item.codigo}
                      servico={item.servico}
                      exibicao={item.exibicao}
                      data={item.data}
                      compact
                      style={{ marginTop: 4 }}
                    />
                    <Text style={[styles.itemText, { fontSize: 12, marginTop: 4 }]}>
                      {item.cliente || "—"}
                    </Text>
                  </TouchableOpacity>
                )}
              />
              {matches.length > 1 && (
                <TouchableOpacity
                  style={styles.btn}
                  onPress={() => handleAdd(matches.map((m) => m.id_saida))}
                >
                  <Text style={styles.btnText}>Adicionar todos à rota</Text>
                </TouchableOpacity>
              )}
            </>
          )}
          <TouchableOpacity style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
