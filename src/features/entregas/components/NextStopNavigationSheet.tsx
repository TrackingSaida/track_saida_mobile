import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import { useThemeColors } from "../../../theme/colors";
import type { GroupedStop } from "../utils/routeUtils";
import { getStopAddressLineFromGroup } from "../utils/routeUtils";
import {
  getDestinationLabel,
  getNavigationOptions,
  openNavigationToStop,
  resolveGroupNavigationTarget,
  type NavigationApp,
  type GeocodedCoordsMap,
} from "../utils/externalNavigation";

export interface NextStopNavigationSheetProps {
  visible: boolean;
  group: GroupedStop | null;
  stopNumber: number;
  totalStops: number;
  geocodedCoords?: GeocodedCoordsMap;
  onContinue: () => void;
  onClose: () => void;
}

export default function NextStopNavigationSheet({
  visible,
  group,
  stopNumber,
  totalStops,
  geocodedCoords = {},
  onContinue,
  onClose,
}: NextStopNavigationSheetProps) {
  const colors = useThemeColors();
  const navTarget = group ? resolveGroupNavigationTarget(group, geocodedCoords) : null;
  const destinationLabel = navTarget ? getDestinationLabel(navTarget) : null;
  const navOptions = useMemo(() => getNavigationOptions(), []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.45)",
          justifyContent: "flex-end",
        },
        sheet: {
          backgroundColor: colors.backgroundCard,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: Platform.OS === "ios" ? 28 : 20,
        },
        title: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 },
        subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
        address: { fontSize: 15, color: colors.text, lineHeight: 22, marginBottom: 8 },
        destLabel: {
          fontSize: 13,
          fontWeight: "600",
          color: colors.primary,
          marginBottom: 12,
        },
        pedidos: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
        navBtn: {
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 10,
          backgroundColor: colors.inputBackground,
          marginBottom: 8,
          borderWidth: 1,
          borderColor: colors.separator,
        },
        navBtnText: { fontSize: 16, fontWeight: "600", color: colors.text },
        primaryBtn: {
          paddingVertical: 14,
          borderRadius: 10,
          backgroundColor: colors.primary,
          alignItems: "center",
          marginTop: 4,
        },
        primaryBtnText: { fontSize: 16, fontWeight: "700", color: colors.primaryContrast },
        cancelBtn: {
          paddingVertical: 12,
          alignItems: "center",
          marginTop: 4,
        },
        cancelBtnText: { fontSize: 15, color: colors.textSecondary },
      }),
    [colors]
  );

  const handleNav = async (app: NavigationApp) => {
    if (!group) return;
    const needsConfirm =
      navTarget?.mode === "address" ||
      (navTarget?.mode === "coords" && navTarget.precision === "geocoded");
    await openNavigationToStop(group.representativeDelivery, app, {
      geocodedCoords,
      skipApproximateConfirm: !needsConfirm,
    });
    onClose();
  };

  const canNavigate =
    navTarget &&
    (navTarget.mode === "coords" || (navTarget.mode === "address" && navTarget.address));

  if (!group) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>Próxima parada</Text>
          <Text style={styles.subtitle}>
            Parada {stopNumber} de {totalStops}
          </Text>
          <Text style={styles.address}>{getStopAddressLineFromGroup(group)}</Text>
          <Text style={styles.pedidos}>
            📦 {group.deliveries.length} pedido{group.deliveries.length !== 1 ? "s" : ""}
          </Text>

          {destinationLabel && (
            <Text style={styles.destLabel}>{destinationLabel}</Text>
          )}

          {canNavigate ? (
            navOptions.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={styles.navBtn}
                onPress={() => void handleNav(opt.id)}
              >
                <Text style={styles.navBtnText}>{opt.label}</Text>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.pedidos}>Endereço indisponível para navegação.</Text>
          )}

          <TouchableOpacity style={styles.primaryBtn} onPress={onContinue}>
            <Text style={styles.primaryBtnText}>Continuar no mapa</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
