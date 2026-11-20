import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../theme/colors";
import { space, radius } from "../../theme/spacing";
import { type as typo } from "../../theme/typography";

export type SettingsChoiceOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

type Props<T extends string> = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: SettingsChoiceOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
};

export default function SettingsChoiceSheet<T extends string>({
  visible,
  title,
  subtitle,
  options,
  selected,
  onSelect,
  onClose,
}: Props<T>) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

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
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          paddingHorizontal: space.lg,
          paddingTop: space.lg,
        },
        title: {
          fontSize: 18,
          fontWeight: "800",
          color: colors.text,
          marginBottom: space.xs,
        },
        subtitle: {
          fontSize: typo.bodySmall,
          color: colors.textSecondary,
          marginBottom: space.md,
          lineHeight: 18,
        },
        option: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: space.md,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
          gap: 12,
        },
        optionLast: { borderBottomWidth: 0 },
        radio: {
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: 2,
          borderColor: colors.separator,
          alignItems: "center",
          justifyContent: "center",
        },
        radioActive: { borderColor: colors.primary },
        radioDot: {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.primary,
        },
        textWrap: { flex: 1, minWidth: 0 },
        optionLabel: { fontSize: 16, fontWeight: "700", color: colors.text },
        optionLabelActive: { color: colors.primary },
        optionDesc: {
          fontSize: typo.bodySmall,
          color: colors.textSecondary,
          marginTop: 2,
          lineHeight: 17,
        },
        cancel: {
          marginTop: space.sm,
          alignItems: "center",
          paddingVertical: space.md,
        },
        cancelText: {
          fontSize: 16,
          color: colors.textSecondary,
          fontWeight: "600",
        },
      }),
    [colors]
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.box, { paddingBottom: Math.max(24, insets.bottom) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {options.map((opt, index) => {
            const active = opt.value === selected;
            const isLast = index === options.length - 1;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.option, isLast && styles.optionLast]}
                onPress={() => onSelect(opt.value)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.textWrap}>
                  <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                    {opt.label}
                  </Text>
                  {opt.description ? <Text style={styles.optionDesc}>{opt.description}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.cancel} onPress={onClose} accessibilityRole="button">
            <Text style={styles.cancelText}>Fechar</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
