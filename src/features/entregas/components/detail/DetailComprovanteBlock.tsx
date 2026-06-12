import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from "react-native";
import { useThemeColors } from "../../../../theme/colors";
import DetailInfoBlock from "./DetailInfoBlock";

type Props = {
  thumbUri: string | null;
  loading: boolean;
  onPressThumb?: () => void;
};

export default function DetailComprovanteBlock({ thumbUri, loading, onPressThumb }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        emptyRow: { flexDirection: "row", alignItems: "center", gap: 8 },
        emptyText: { fontSize: 14, color: colors.textSecondary, flex: 1 },
        thumbWrap: { borderRadius: 12, overflow: "hidden", alignSelf: "flex-start" },
        thumb: { width: 120, height: 120, borderRadius: 12 },
        thumbPlaceholder: {
          width: 120,
          height: 120,
          borderRadius: 12,
          backgroundColor: colors.inputBackground,
          alignItems: "center",
          justifyContent: "center",
        },
        hint: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
      }),
    [colors]
  );

  return (
    <DetailInfoBlock title="Comprovante" icon="camera-outline">
      {loading ? (
        <View style={styles.emptyRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.emptyText}>Carregando imagem…</Text>
        </View>
      ) : thumbUri ? (
        <>
          <TouchableOpacity
            style={styles.thumbWrap}
            onPress={onPressThumb}
            disabled={!onPressThumb}
            activeOpacity={0.85}
          >
            <Image source={{ uri: thumbUri }} style={styles.thumb} />
          </TouchableOpacity>
          {onPressThumb ? <Text style={styles.hint}>Toque para ampliar</Text> : null}
        </>
      ) : (
        <View style={styles.emptyRow}>
          <Text style={styles.emptyText}>Nenhuma imagem registrada</Text>
        </View>
      )}
    </DetailInfoBlock>
  );
}
