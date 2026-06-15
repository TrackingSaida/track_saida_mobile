import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { useThemeColors } from "../../../../theme/colors";
import DetailInfoBlock from "./DetailInfoBlock";

type Props = {
  thumbUris: string[];
  loading: boolean;
  onPressThumb?: (index: number) => void;
};

export default function DetailComprovanteBlock({ thumbUris, loading, onPressThumb }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        emptyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        emptyText: { fontSize: 14, color: colors.textSecondary, flex: 1 },
        thumbRow: { flexDirection: "row", gap: 10 },
        thumbWrap: { borderRadius: 12, overflow: "hidden" },
        thumb: { width: 120, height: 120, borderRadius: 12 },
        hint: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
      }),
    [colors]
  );

  return (
    <DetailInfoBlock title="Comprovante" icon="camera-outline">
      {loading ? (
        <View style={styles.emptyRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.emptyText}>Carregando imagens…</Text>
        </View>
      ) : thumbUris.length > 0 ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
            {thumbUris.map((uri, index) => (
              <TouchableOpacity
                key={`${uri.slice(0, 32)}-${index}`}
                style={styles.thumbWrap}
                onPress={onPressThumb ? () => onPressThumb(index) : undefined}
                disabled={!onPressThumb}
                activeOpacity={0.85}
              >
                <Image source={{ uri }} style={styles.thumb} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          {onPressThumb ? (
            <Text style={styles.hint}>
              {thumbUris.length > 1 ? "Toque em uma foto para ampliar" : "Toque para ampliar"}
            </Text>
          ) : null}
        </>
      ) : (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>Nenhuma imagem registrada</Text>
        </View>
      )}
    </DetailInfoBlock>
  );
}
