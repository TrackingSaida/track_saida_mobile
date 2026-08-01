/** Navega a partir do payload de push (data.type). */
export function navigateFromPushData(
  navigation: { navigate: (...args: any[]) => void } | null,
  data: Record<string, unknown> | null | undefined
): void {
  if (!navigation || !data) return;
  const type = String(data.type || "");

  try {
    switch (type) {
      case "fechamento_pronto":
      case "fechamento_reajustado": {
        const id = Number(data.fechamento_id);
        if (Number.isFinite(id) && id > 0) {
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
        const id = Number(data.aviso_id);
        if (Number.isFinite(id) && id > 0) {
          navigation.navigate("Mais", {
            screen: "AvisoDetail",
            params: { avisoId: id },
          });
        } else {
          navigation.navigate("Mais", { screen: "Avisos" });
        }
        break;
      }
      case "pacotes_atribuidos":
      case "atraso_d1":
        navigation.navigate("Home", {
          screen: "EntregasList",
          params: { initialTab: "pendentes", todosPendentes: true },
        });
        break;
      case "bloqueio_ausencia": {
        const idSaida = Number(data.id_saida);
        if (Number.isFinite(idSaida) && idSaida > 0) {
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
        navigation.navigate("Home", {
          screen: "ConferenciaSaida",
          params: {
            initialAba: "reconferir",
            motoboyId: Number.isFinite(motoboyId) ? motoboyId : undefined,
            dataRef: typeof data.data_ref === "string" ? data.data_ref : undefined,
          },
        });
        break;
      }
      default:
        break;
    }
  } catch {
    // navegação best-effort
  }
}
