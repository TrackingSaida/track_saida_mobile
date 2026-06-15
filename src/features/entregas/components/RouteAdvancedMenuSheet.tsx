import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useThemeColors } from "../../../theme/colors";

type IoniconName = ComponentProps<typeof Ionicons>["name"];

type MenuItem = {
  key: string;
  label: string;
  icon: IoniconName;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

interface RouteAdvancedMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  onOptimize: () => void;
  onRestoreOriginal?: () => void;
  canRestoreOriginal?: boolean;
  onAddStop: () => void;
  onImport: () => void;
  onLocate: () => void;
  onToggleList: () => void;
  onIniciar?: () => void;
  listExpanded: boolean;
  optimizing?: boolean;
  iniciando?: boolean;
  canOptimize?: boolean;
  showPlanningActions?: boolean;
}

export default function RouteAdvancedMenuSheet({
  visible,
  onClose,
  onOptimize,
  onRestoreOriginal,
  canRestoreOriginal = false,
  onAddStop,
  onImport,
  onLocate,
  onToggleList,
  onIniciar,
  listExpanded,
  optimizing = false,
  iniciando = false,
  canOptimize = true,
  showPlanningActions = false,
}: RouteAdvancedMenuSheetProps) {
  const colors = useThemeColors();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.4)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 28,
        },
        handle: {
          width: 40,
          height: 4,
          borderRadius: 2,
          backgroundColor: colors.separator,
          alignSelf: "center",
          marginBottom: 12,
        },
        title: {
          fontSize: 16,
          fontWeight: "700",
          color: colors.text,
          marginBottom: 12,
        },
        item: {
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.separator,
        },
        itemDisabled: { opacity: 0.45 },
        itemIcon: { marginRight: 12 },
        itemLabel: { fontSize: 16, color: colors.text, flex: 1 },
        cancel: {
          marginTop: 8,
          paddingVertical: 14,
          alignItems: "center",
        },
        cancelText: { fontSize: 16, fontWeight: "600", color: colors.primary },
      }),
    [colors]
  );

  const items: MenuItem[] = [
    ...(showPlanningActions && onIniciar
      ? [
          {
            key: "iniciar",
            label: "Iniciar entrega",
            icon: "play-circle-outline" as IoniconName,
            onPress: onIniciar,
            loading: iniciando,
            disabled: iniciando || optimizing,
          },
        ]
      : []),
    ...(showPlanningActions
      ? [
          {
            key: "optimize",
            label: "Reotimizar rota completa",
            icon: "git-branch-outline" as IoniconName,
            onPress: onOptimize,
            loading: optimizing,
            disabled: !canOptimize || optimizing,
          },
          ...(onRestoreOriginal
            ? [
                {
                  key: "restore",
                  label: "Restaurar rota original",
                  icon: "refresh-outline" as IoniconName,
                  onPress: onRestoreOriginal,
                  disabled: !canRestoreOriginal || optimizing,
                },
              ]
            : []),
          {
            key: "locate",
            label: "Localizar pacote",
            icon: "scan-outline" as IoniconName,
            onPress: onLocate,
          },
        ]
      : []),
    {
      key: "add",
      label: "+ Parada",
      icon: "add-circle-outline",
      onPress: onAddStop,
    },
    {
      key: "import",
      label: "Importar",
      icon: "cloud-upload-outline",
      onPress: onImport,
    },
    ...(!listExpanded
      ? [
          {
            key: "list",
            label: "Lista da rota",
            icon: "list-outline" as IoniconName,
            onPress: onToggleList,
          },
        ]
      : []),
  ];

  const handleItem = (item: MenuItem) => {
    if (item.disabled || item.loading) return;
    onClose();
    item.onPress();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Mais opções</Text>
            {items.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={[styles.item, item.disabled && styles.itemDisabled]}
                onPress={() => handleItem(item)}
                disabled={item.disabled}
              >
                {item.loading ? (
                  <ActivityIndicator size="small" color={colors.text} style={styles.itemIcon} />
                ) : (
                  <Ionicons name={item.icon} size={22} color={colors.text} style={styles.itemIcon} />
                )}
                <Text style={styles.itemLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
