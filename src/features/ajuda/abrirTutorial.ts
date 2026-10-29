import { Alert, Linking } from "react-native";
import { isOnline } from "../../services/outbox/networkStatus";
import { urlsDoVideo } from "./youtube";

async function abrirUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function abrirTutorial(youtubeVideoId: string): Promise<void> {
  const urls = urlsDoVideo(youtubeVideoId);
  if (!urls) {
    Alert.alert("Não foi possível abrir o vídeo", "O link deste tutorial é inválido.");
    return;
  }

  const online = await isOnline();
  if (!online) {
    Alert.alert("Sem conexão", "Conecte-se à internet para assistir ao tutorial.");
    return;
  }

  const abriu = await abrirUrl(urls.principal);
  if (abriu) return;

  Alert.alert("Não foi possível abrir o YouTube", "Você pode tentar pelo navegador.", [
    { text: "Cancelar", style: "cancel" },
    {
      text: "Abrir no navegador",
      onPress: () => {
        void abrirUrl(urls.reserva).then((ok) => {
          if (!ok) {
            Alert.alert("Não foi possível abrir o vídeo", "Tente novamente em instantes.");
          }
        });
      },
    },
  ]);
}
