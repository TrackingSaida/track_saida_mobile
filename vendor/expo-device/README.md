# expo-device (vendor fallback)

Stub JS para desenvolvimento/CI quando o registry npm estiver inacessível.
Em ambiente com rede, preferir `npx expo install expo-device` (~8.0.10 no SDK 54)
e remover este `file:` do package.json.

O client de telemetria também lê `Platform.constants` (Brand/Model/API) no Android.
