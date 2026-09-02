import React, { useMemo } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useThemeColors } from "../../../theme/colors";
import { radius, space } from "../../../theme/spacing";
import { useSemanticTones, type SemanticKey } from "../../../theme/semantic";
import AppText from "../../../components/ui/AppText";
import { formatPersonName, personInitials } from "../../../utils/personName";
import { formatInteger } from "../utils/dashboardFormat";
import type { AcompanhamentoMotoboyItem } from "../acompanhamentoApi";
import { deriveStatus, fmtUltimaEntrega, type MotoboyStatusKey } from "../utils/acompanhamentoOperational";
import SegmentedProgressBar from "./SegmentedProgressBar";
import StatusBadge from "./StatusBadge";
import ServiceChip from "./ServiceChip";

const STATUS_SEMANTIC: Record<MotoboyStatusKey, SemanticKey> = {
  sem_entrega: "route",
  finalizado: "success",
  critico: "danger",
  em_andamento: "primary",
};

type Props = {
  row: AcompanhamentoMotoboyItem;
  onPress: () => void;
};

export default function MotoboyProgressCard({ row, onPress }: Props) {
  const colors = useThemeColors();
  const tones = useSemanticTones();
  const status = deriveStatus(row);
  const ultima = fmtUltimaEntrega(row.ultima_entrega);
  const name = formatPersonName(row.motoboy_nome || "");
  const initials = personInitials(name);
  const shopee = row.sum_shopee ?? 0;
  const ml = row.sum_mercado ?? 0;
  const avulso = row.sum_avulso ?? 0;
  const hasServicos = shopee + ml + avulso > 0;
  const entreguesLabel = `${formatInteger(row.entregues)} / ${formatInteger(row.pedidos)} entregues`;
  const subLabel = `${formatInteger(row.em_rota)} em rota · ${formatInteger(row.ausente_ou_ocorrencias)} ocorrências`;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: radius.md,
          padding: space.md,
          marginBottom: space.sm,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
        },
        top: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 8,
        },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: tones.primary.iconBg,
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        },
        initials: {
          fontSize: 13,
          fontWeight: "800",
          color: tones.primary.fg,
        },
        identity: {
          flex: 1,
          minWidth: 0,
        },
        nameRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 8,
        },
        name: {
          flex: 1,
          minWidth: 0,
          fontSize: 15,
          fontWeight: "800",
          color: colors.text,
        },
        meta: {
          fontSize: 14,
          fontWeight: "700",
          color: colors.text,
          marginTop: 4,
        },
        sub: {
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 2,
        },
        ultima: {
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 2,
        },
        bar: { marginTop: 10, marginBottom: 8 },
        chips: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
        },
      }),
    [colors, tones]
  );

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${status.label}, ${entreguesLabel}, ${subLabel}`}
    >
      <View style={styles.top}>
        <View style={styles.avatar} accessible={false}>
          <AppText style={styles.initials}>{initials}</AppText>
        </View>
        <View style={styles.identity}>
          <View style={styles.nameRow}>
            <AppText style={styles.name} numberOfLines={2}>
              {name}
            </AppText>
            <StatusBadge label={status.label} semantic={STATUS_SEMANTIC[status.key]} />
          </View>
          <AppText style={styles.meta} numberOfLines={1}>
            {entreguesLabel}
          </AppText>
          <AppText style={styles.sub} numberOfLines={1}>
            {subLabel}
          </AppText>
          {ultima.text ? (
            <AppText style={styles.ultima} numberOfLines={1}>
              {ultima.text}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.bar}>
        <SegmentedProgressBar
          total={row.pedidos}
          segments={[
            { value: row.entregues, color: tones.success.bar },
            { value: row.em_rota, color: tones.route.bar },
            { value: row.ausente_ou_ocorrencias, color: tones.danger.bar },
          ]}
        />
      </View>
      {hasServicos ? (
        <View style={styles.chips}>
          {shopee > 0 ? (
            <ServiceChip label="Shopee" value={shopee} semantic="marketplaceShopee" />
          ) : null}
          {ml > 0 ? <ServiceChip label="ML" value={ml} semantic="marketplaceML" /> : null}
          {avulso > 0 ? (
            <ServiceChip label="Avulso" value={avulso} semantic="marketplaceAvulso" />
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}
