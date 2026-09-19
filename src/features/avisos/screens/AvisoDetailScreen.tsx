import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Linking,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import ScreenHeaderBar from "../../../components/ScreenHeaderBar";
import { useThemeColors } from "../../../theme/colors";
import { space } from "../../../theme/spacing";
import type { MaisStackParamList } from "../../../screens/MaisScreen";
import { getAviso, marcarAvisoLido, type AvisoItem } from "../api";
import { useAvisosUnreadStore } from "../../../store/avisosUnreadStore";
import { useAvisosCacheStore } from "../../../store/avisosCacheStore";

type Props = NativeStackScreenProps<MaisStackParamList, "AvisoDetail">;

const URL_RE = /https?:\/\/[^\s<>"']+/gi;
const RETRY_DELAYS_MS = [0, 400, 900];

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function previewFromRoute(
  avisoId: number,
  params: Props["route"]["params"]
): AvisoItem | null {
  const cached = useAvisosCacheStore.getState().get(avisoId);
  const titulo = String(params.titulo || cached?.titulo || "").trim();
  const mensagem = String(params.mensagem || cached?.mensagem || "").trim();
  if (!titulo && !mensagem && !cached) return null;
  return {
    id: avisoId,
    titulo: titulo || cached?.titulo || "Aviso",
    mensagem: mensagem || cached?.mensagem || "",
    prioridade: params.prioridade || cached?.prioridade || "normal",
    criado_em: cached?.criado_em,
    lido: cached?.lido ?? false,
    lido_em: cached?.lido_em,
  };
}

export default function AvisoDetailScreen({ navigation, route }: Props) {
  const { avisoId, titulo: tituloParam, mensagem: mensagemParam, prioridade: prioridadeParam } = route.params;
  const colors = useThemeColors();
  const routePreview = { avisoId, titulo: tituloParam, mensagem: mensagemParam, prioridade: prioridadeParam };
  const initialPreview = previewFromRoute(avisoId, routePreview);
  const [item, setItem] = useState<AvisoItem | null>(initialPreview);
  const [loading, setLoading] = useState(!initialPreview);
  const [loadError, setLoadError] = useState(false);
  const refreshUnread = useAvisosUnreadStore((s) => s.refresh);

  const load = useCallback(async () => {
    const preview = previewFromRoute(avisoId, {
      avisoId,
      titulo: tituloParam,
      mensagem: mensagemParam,
      prioridade: prioridadeParam,
    });
    if (preview) {
      setItem(preview);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setLoadError(false);
    for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
      if (RETRY_DELAYS_MS[i] > 0) await sleep(RETRY_DELAYS_MS[i]);
      try {
        const aviso = await getAviso(avisoId);
        setItem(aviso);
        useAvisosCacheStore.getState().upsert(aviso);
        setLoadError(false);
        setLoading(false);
        if (!aviso.lido) {
          await marcarAvisoLido(avisoId);
          void refreshUnread();
        }
        return;
      } catch {
        // tenta de novo
      }
    }
    setLoadError(true);
    setLoading(false);
    if (!preview) {
      setItem(null);
    }
  }, [avisoId, refreshUnread, tituloParam, mensagemParam, prioridadeParam]);

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
        errorBox: {
          marginTop: 16,
          padding: 12,
          borderRadius: 10,
          backgroundColor: "rgba(220,53,69,0.10)",
        },
        errorText: { fontSize: 14, color: colors.text, lineHeight: 20 },
        retryBtn: {
          marginTop: 12,
          alignSelf: "flex-start",
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 10,
          backgroundColor: colors.primary,
        },
        retryText: { color: colors.primaryContrast, fontWeight: "700" },
      }),
    [colors]
  );

  const showSpinner = loading && !item;

  return (
    <View style={styles.container}>
      <ScreenHeaderBar title="Aviso" onBack={() => navigation.goBack()} />
      {showSpinner ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : !item ? (
        <View style={styles.body}>
          <Text style={styles.errorText}>Não foi possível abrir este aviso agora.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Tentar de novo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={styles.title}>{item.titulo || "Aviso"}</Text>
          {item.prioridade === "urgente" ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>URGENTE</Text>
            </View>
          ) : null}
          {item.mensagem ? (
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
          ) : (
            <Text style={styles.msg}>A mensagem completa ainda está carregando.</Text>
          )}
          {loadError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>
                Não foi possível atualizar o aviso. A mensagem acima veio da notificação.
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => void load()}>
                <Text style={styles.retryText}>Tentar de novo</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
