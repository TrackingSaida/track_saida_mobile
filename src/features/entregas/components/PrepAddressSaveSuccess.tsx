import React, { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useThemeColors } from "../../../theme/colors";

export interface PrepAddressSaveSuccessProps {
  summaryLines: string[];
  remaining: number;
  onNext: () => void;
  onDone: () => void;
}

export default function PrepAddressSaveSuccess({
  summaryLines,
  remaining,
  onNext,
  onDone,
}: PrepAddressSaveSuccessProps) {
  const colors = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { flex: 1, padding: 24, justifyContent: "center" },
        iconRow: { alignItems: "center", marginBottom: 16 },
        title: {
          fontSize: 20,
          fontWeight: "800",
          color: colors.success,
          textAlign: "center",
          marginBottom: 16,
        },
        summaryBox: {
          backgroundColor: colors.inputBackground,
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: colors.inputBorder,
        },
        summaryLine: { fontSize: 16, color: colors.text, lineHeight: 22 },
        remaining: {
          fontSize: 15,
          color: colors.warning,
          fontWeight: "600",
          textAlign: "center",
          marginBottom: 24,
        },
        doneText: {
          fontSize: 15,
          color: colors.textSecondary,
          textAlign: "center",
          marginBottom: 24,
        },
        btn: {
          backgroundColor: colors.primary,
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 12,
        },
        btnText: { color: colors.primaryContrast, fontSize: 17, fontWeight: "700" },
        btnGhost: { alignItems: "center", paddingVertical: 12 },
        btnGhostText: { fontSize: 16, color: colors.textSecondary },
      }),
    [colors]
  );

  const allDone = remaining <= 0;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>✓ Endereço salvo com sucesso</Text>
      <View style={styles.summaryBox}>
        {summaryLines.filter(Boolean).map((line, i) => (
          <Text key={`${i}-${line}`} style={styles.summaryLine}>
            {line}
          </Text>
        ))}
      </View>
      {allDone ? (
        <>
          <Text style={styles.doneText}>Todos os pacotes com endereço informado.</Text>
          <TouchableOpacity style={styles.btn} onPress={onDone}>
            <Text style={styles.btnText}>Concluir</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.remaining}>
            Restam {remaining} pacote{remaining !== 1 ? "s" : ""} sem endereço
          </Text>
          <TouchableOpacity style={styles.btn} onPress={onNext}>
            <Text style={styles.btnText}>Próximo pacote</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnGhost} onPress={onDone}>
            <Text style={styles.btnGhostText}>Voltar à preparação</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
