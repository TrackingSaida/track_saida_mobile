import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import type { MaisStackParamList } from "../../../screens/MaisScreen";
import { getAviso, marcarAvisoLido, type AvisoItem } from "../api";
import { useAvisosUnreadStore } from "../../../store/avisosUnreadStore";

type Props = NativeStackScreenProps<MaisStackParamList, "AvisoDetail">;

const URL_RE = /https?:\/\/[^\s<>"']+/gi;

type MsgPart = { type: "text" | "link"; value: string };

function splitMessageLinks(message: string): MsgPart[] {
  const parts: MsgPart[] = [];
  const re = new RegExp(URL_RE.source, "gi");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(message)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: message.slice(last, match.index) });
    }
    parts.push({ type: "link", value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < message.length) {
    parts.push({ type: "text", value: message.slice(last) });
  }
  return parts.length ? parts : [{ type: "text", value: message }];
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function openSafeUrl(url: string) {
  if (!isSafeHttpUrl(url)) return;
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("Link", "Não foi possível abrir este link.");
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Link", "Não foi possível abrir este link.");
  }
}

export default function AvisoDetailScreen({ navigation, route }: Props) {
  const { avisoId } = route.params;
  const colors = useThemeColors();
  const [item, setItem] = useState<AvisoItem | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshUnread = useAvisosUnreadStore((s) => s.refresh);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const aviso = await getAviso(avisoId);
      setItem(aviso);
      if (!aviso.lido) {
        await marcarAvisoLido(avisoId);
        void refreshUnread();
      }
    } catch {
      setItem(null);
    } finally {
      setLoading(false);
    }
  }, [avisoId, refreshUnread]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const msgParts = useMemo(
    () => (item?.mensagem ? splitMessageLinks(item.mensagem) : []),
    [item?.mensagem]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        body: { padding: space.lg },
        title: { fontSize: 22, fontWeight: "800", color: colors.text },
        badge: {
          alignSelf: "flex-start",
          marginTop: 10,
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 8,
          backgroundColor: "#FEE2E2",
        },
        badgeText: { fontSize: 12, fontWeight: "800", color: "#B91C1C" },
        msg: { marginTop: 18, fontSize: 16, lineHeight: 24, color: colors.text },
        link: {
          color: colors.primary,
          textDecorationLine: "underline",
          fontWeight: "600",
        },
      }),
    [colors]
  );

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Aviso" onBack={() => navigation.goBack()} />
      {loading || !item ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>{item.titulo}</Text>
          {item.prioridade === "urgente" ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>URGENTE</Text>
            </View>
          ) : null}
          <Text style={styles.msg} selectable>
            {msgParts.map((part, idx) =>
              part.type === "link" ? (
                <Text
                  key={`l-${idx}`}
                  style={styles.link}
                  onPress={() => {
                    void openSafeUrl(part.value);
                  }}
                >
                  {part.value}
                </Text>
              ) : (
                <Text key={`t-${idx}`}>{part.value}</Text>
              )
            )}
          </Text>
        </ScrollView>
      )}
    </View>
  );
}
