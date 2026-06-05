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
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { geocodeAddress } from "../utils/geocode";
import { parseVoiceToAddresses } from "../utils/ocrAddress";
import type { EntregaListItem } from "../types";

const GEOCODE_CONCURRENCY = 10;

interface BulkMatch {
  line: string;
  ids: number[];
}

interface RouteBulkImportSheetProps {
  visible: boolean;
  pendingDeliveries: EntregaListItem[];
  routeOrder: number[];
  onAddIds: (ids: number[]) => void;
  onClose: () => void;
}

async function geocodeLinesParallel(
  lines: string[],
  pending: EntregaListItem[],
  routeOrder: number[]
): Promise<BulkMatch[]> {
  const inRoute = new Set(routeOrder);
  const available = pending.filter((d) => !inRoute.has(d.id_saida));
  const results: BulkMatch[] = [];

  for (let i = 0; i < lines.length; i += GEOCODE_CONCURRENCY) {
    const chunk = lines.slice(i, i + GEOCODE_CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (line) => {
        const geo = await geocodeAddress(line);
        if (!geo) return { line, ids: [] as number[] };
        const ids = available
          .filter(
            (d) =>
              d.latitude != null &&
              d.longitude != null &&
              Math.abs(d.latitude - geo.latitude) < 0.008 &&
              Math.abs(d.longitude - geo.longitude) < 0.008
          )
          .map((d) => d.id_saida);
        return { line, ids };
      })
    );
    results.push(...chunkResults);
  }
  return results;
}

export default function RouteBulkImportSheet({
  visible,
  pendingDeliveries,
  routeOrder,
  onAddIds,
  onClose,
}: RouteBulkImportSheetProps) {
  const colors = useThemeColors();
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [preview, setPreview] = useState<BulkMatch[] | null>(null);

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
          maxHeight: "85%",
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 8 },
        hint: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
        input: {
          borderWidth: 1,
          borderColor: colors.inputBorder,
          borderRadius: 8,
          padding: 12,
          fontSize: 14,
          backgroundColor: colors.inputBackground,
          color: colors.text,
          minHeight: 120,
          textAlignVertical: "top",
          marginBottom: 12,
        },
        btn: {
          paddingVertical: 12,
          borderRadius: 8,
          alignItems: "center",
          backgroundColor: colors.primary,
          marginBottom: 8,
        },
        btnText: { fontSize: 15, fontWeight: "600", color: colors.primaryContrast },
        preview: { fontSize: 14, color: colors.text, marginBottom: 12 },
        close: { alignItems: "center", paddingVertical: 12 },
        closeText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors]
  );

  const extractLines = (raw: string): string[] => {
    const voiceCandidates = parseVoiceToAddresses(raw);
    if (voiceCandidates.length > 1) {
      return voiceCandidates.map((c) =>
        [c.rua, c.numero, c.bairro, c.cidade, c.estado, c.cep].filter(Boolean).join(", ")
      );
    }
    return raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  };

  const handlePreview = async () => {
    const lines = extractLines(text);
    if (lines.length === 0) {
      Alert.alert("Atenção", "Cole pelo menos um endereço por linha.");
      return;
    }
    setProcessing(true);
    try {
      const matches = await geocodeLinesParallel(lines, pendingDeliveries, routeOrder);
      setPreview(matches);
      const found = matches.filter((m) => m.ids.length > 0).length;
      if (found === 0) {
        Alert.alert("Nenhum pedido", "Nenhum pedido pendente corresponde aos endereços informados.");
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleAdd = () => {
    if (!preview) return;
    const ids = [...new Set(preview.flatMap((m) => m.ids))];
    if (ids.length === 0) return;
    onAddIds(ids);
    setText("");
    setPreview(null);
    onClose();
  };

  const foundCount = preview?.filter((m) => m.ids.length > 0).length ?? 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Importar endereços</Text>
          <Text style={styles.hint}>Um endereço por linha. Busca pedidos pendentes próximos.</Text>
          <TextInput
            style={styles.input}
            placeholder={"Rua A, 100\nRua B, 200"}
            placeholderTextColor={colors.placeholder}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.btn} onPress={handlePreview} disabled={processing}>
            {processing ? (
              <ActivityIndicator color={colors.primaryContrast} />
            ) : (
              <Text style={styles.btnText}>Analisar endereços</Text>
            )}
          </TouchableOpacity>
          {preview && foundCount > 0 && (
            <>
              <Text style={styles.preview}>
                {foundCount} endereço{foundCount !== 1 ? "s" : ""} com pedidos encontrados
              </Text>
              <TouchableOpacity style={styles.btn} onPress={handleAdd}>
                <Text style={styles.btnText}>Adicionar à rota</Text>
              </TouchableOpacity>
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
