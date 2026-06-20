import { Alert } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import { getBiometricEnabled } from "../services/settingsService";

export async function offerBiometricAfterLogin(
  setBiometricEnabled: (enabled: boolean) => Promise<void>,
  onContinue: () => void
) {
  const [compatible, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  const alreadyEnabled = await getBiometricEnabled();
  if (!compatible || !enrolled || alreadyEnabled) {
    onContinue();
    return;
  }
  Alert.alert(
    "Login por biometria",
    "Deseja ativar login por biometria? Na próxima vez você poderá entrar com impressão digital ou Face ID.",
    [
      { text: "Não", style: "cancel" as const, onPress: onContinue },
      {
        text: "Sim",
        onPress: async () => {
          await setBiometricEnabled(true);
          onContinue();
        },
      },
    ]
  );
}
