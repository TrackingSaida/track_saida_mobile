/** Navega a partir do payload de push (data.type). */
import { useAuthStore } from "../../store/authStore";
import { avisoFromPushData, useAvisosCacheStore } from "../../store/avisosCacheStore";
import { isAdminRole, isMotoboyRole } from "../../utils/role";

function formatYmdLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function navigateFromPushData(
  navigation: { navigate: (...args: any[]) => void } | null,
  data: Record<string, unknown> | null | undefined
): void {
  if (!navigation || !data) return;
  const type = String(data.type || "");
  const role = useAuthStore.getState().currentUser?.role as number | undefined;
  const motoboy = isMotoboyRole(role);

  try {
    switch (type) {
      case "fechamento_pronto":
      case "fechamento_reajustado":
      case "fechamento_pago": {
        const id = Number(data.fechamento_id);
        if (motoboy) {
          if (Number.isFinite(id) && id > 0) {
            navigation.navigate("FechamentoDetail", { idFechamento: id });
          } else {
            navigation.navigate("MeusFechamentos");
          }
        } else if (Number.isFinite(id) && id > 0) {
          navigation.navigate("Mais", {
            screen: "FechamentoDetail",
            params: { idFechamento: id },
          });
        } else {
          navigation.navigate("Mais", { screen: "MeusFechamentos" });
        }
        break;
      }
      case "aviso_base":
      case "aviso_urgente": {
        const preview = avisoFromPushData(data);
        if (preview) {
          useAvisosCacheStore.getState().upsert(preview);
        }
        const id = preview?.id ?? Number(data.aviso_id);
        if (motoboy) {
          if (Number.isFinite(id) && id > 0) {
            navigation.navigate("AvisoDetail", {
              avisoId: id,
              titulo: preview?.titulo || undefined,
              mensagem: preview?.mensagem || undefined,
              prioridade: preview?.prioridade || undefined,
            });
          } else {
            navigation.navigate("Avisos");
          }
        } else if (Number.isFinite(id) && id > 0) {
          navigation.navigate("Mais", {
            screen: "AvisoDetail",
            params: {
              avisoId: id,
              titulo: preview?.titulo || undefined,
              mensagem: preview?.mensagem || undefined,
              prioridade: preview?.prioridade || undefined,
            },
          });
        } else {
          navigation.navigate("Mais", { screen: "Avisos" });
        }
        break;
      }
      case "pacotes_atribuidos":
      case "atraso_d1":
        if (motoboy) {
          navigation.navigate("Tabs", {
            screen: "Entregas",
            params: { initialTab: "pendente", todosPendentes: true },
          });
        } else {
          navigation.navigate("Home", {
            screen: "EntregasList",
            params: { initialTab: "pendentes", todosPendentes: true },
          });
        }
        break;
      case "bloqueio_ausencia": {
        const idSaida = Number(data.id_saida);
        if (motoboy) {
          if (Number.isFinite(idSaida) && idSaida > 0) {
            navigation.navigate("EntregaDetail", { idSaida });
          } else {
            navigation.navigate("Tabs", { screen: "Inicio" });
          }
        } else if (Number.isFinite(idSaida) && idSaida > 0) {
          navigation.navigate("Home", {
            screen: "EntregaDetail",
            params: { idSaida },
          });
        } else {
          navigation.navigate("Home", { screen: "HomeInicio" });
        }
        break;
      }
      case "reconferir_saida": {
        const motoboyId = Number(data.motoboy_id);
        navigation.navigate("Operacao", {
          screen: "ConferenciaSaida",
          params: {
            initialAba: "reconferir",
            motoboyId: Number.isFinite(motoboyId) ? motoboyId : undefined,
            dataRef: typeof data.data_ref === "string" ? data.data_ref : undefined,
          },
        });
        break;
      }
      case "entrada_sem_saida": {
        const dia =
          typeof data.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.data)
            ? data.data
            : formatYmdLocal();
        if (isAdminRole(role)) {
          navigation.navigate("Gestao", { screen: "IndicadoresOperacao" });
        } else {
          navigation.navigate("Inicio", {
            screen: "ConsultaCodigos",
            params: { status: "NA_BASE", de: dia, ate: dia },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch {
    // navegação best-effort
  }
}
