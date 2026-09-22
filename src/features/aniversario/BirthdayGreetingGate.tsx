import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/authStore";
import { useThemeColors } from "../../theme/colors";
import { isMotoboyRole } from "../../utils/role";
import {
  getCurrentRouteName,
  rootNavigationRef,
} from "../../navigation/rootNavigation";
import { fetchAuthMeAniversario, type AniversarioGreeting } from "./api";
import { hasSeenBirthdayToday, markBirthdaySeenToday } from "./birthdayStorage";
import { listUrgentesPendentes } from "../avisos/api";

/** Rotas onde não devemos interromper o scanner. */
const SCAN_ROUTE_NAMES = new Set([
  "Scan",
  "DeliverScan",
  "LeituraSaidas",
  "LeituraColetas",
  "LeituraEntradas",
]);

function resolveUserId(
  claims: Record<string, unknown> | null | undefined,
  meId?: number
): number | null {
  if (typeof meId === "number" && Number.isFinite(meId)) return meId;
  const uid = claims?.uid;
  if (typeof uid === "number" && Number.isFinite(uid)) return uid;
  if (typeof uid === "string" && uid.trim() && Number.isFinite(Number(uid))) {
    return Number(uid);
  }
  return null;
}

export default function BirthdayGreetingGate() {
  const token = useAuthStore((s) => s.token);
  const claims = useAuthStore((s) => s.currentUser);
  const role = claims?.role;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const colors = useThemeColors();

  const [routeName, setRouteName] = useState("");
  const [greeting, setGreeting] = useState<AniversarioGreeting | null>(null);
  const [visible, setVisible] = useState(false);
  const userIdRef = useRef<number | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    const syncRoute = () => setRouteName(getCurrentRouteName());
    syncRoute();
    const unsub = rootNavigationRef.addListener("state", syncRoute);
    return unsub;
  }, []);

  const evaluate = useCallback(async () => {
    if (!token || shownRef.current) return;

    const me = await fetchAuthMeAniversario(token);
    const aniv = me?.aniversario;
    if (!aniv?.titulo || !aniv.mensagem) return;
    if (me?.must_change_password === true) return;

    const uid = resolveUserId(claims as Record<string, unknown> | null, me?.id);
    if (uid == null) return;
    userIdRef.current = uid;

    if (await hasSeenBirthdayToday(uid)) {
      shownRef.current = true;
      return;
    }

    const currentRoute = getCurrentRouteName();
    if (SCAN_ROUTE_NAMES.has(currentRoute)) {
      setGreeting(aniv);
      setVisible(false);
      return;
    }

    if (isMotoboyRole(role)) {
      try {
        const urgentes = await listUrgentesPendentes();
        if (urgentes.length > 0) {
          setGreeting(aniv);
          setVisible(false);
          return;
        }
      } catch {
        /* segue */
      }
    }

    await markBirthdaySeenToday(uid);
    shownRef.current = true;
    setGreeting(aniv);
    setVisible(true);
  }, [token, claims, role]);

  useEffect(() => {
    shownRef.current = false;
    setGreeting(null);
    setVisible(false);
    void evaluate();
  }, [evaluate]);

  // Saiu do scanner ou app voltou ao foreground: tenta de novo se ainda pendente.
  useEffect(() => {
    if (shownRef.current || !greeting || visible) return;
    if (SCAN_ROUTE_NAMES.has(routeName)) return;
    void evaluate();
  }, [routeName, greeting, visible, evaluate]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && !shownRef.current) void evaluate();
    });
    const t = setInterval(() => {
      if (!shownRef.current && greeting && !visible) void evaluate();
    }, 20_000);
    return () => {
      sub.remove();
      clearInterval(t);
    };
  }, [evaluate, greeting, visible]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        overlay: {
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingVertical: Math.max(16, insets.top),
        },
        scroll: { flexGrow: 0 },
        card: {
          backgroundColor: colors.backgroundCard,
          borderRadius: 16,
          paddingHorizontal: 20,
          paddingVertical: 20,
          maxHeight: windowHeight * 0.85,
        },
        title: {
          fontSize: 20,
          fontWeight: "800",
          color: colors.text,
          textAlign: "center",
          marginBottom: 14,
        },
        body: {
          fontSize: 15,
          color: colors.textSecondary,
          textAlign: "left",
          lineHeight: 22,
        },
        btn: {
          marginTop: 20,
          backgroundColor: colors.primary,
          borderRadius: 12,
          paddingVertical: 14,
          alignItems: "center",
        },
        btnText: {
          color: colors.primaryContrast,
          fontWeight: "800",
          fontSize: 16,
        },
      }),
    [colors, insets.top, windowHeight]
  );

  const onClose = () => {
    setVisible(false);
    setGreeting(null);
  };

  if (!greeting) return null;

  return (
    <Modal
      visible={visible && !SCAN_ROUTE_NAMES.has(routeName)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          bounces={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.title}>{greeting.titulo}</Text>
            <Text style={styles.body}>{greeting.mensagem}</Text>
            <TouchableOpacity style={styles.btn} onPress={onClose} accessibilityRole="button">
              <Text style={styles.btnText}>{greeting.botao || "OK"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
