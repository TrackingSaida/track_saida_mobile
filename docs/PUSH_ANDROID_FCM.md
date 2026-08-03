# Push Android (FCM) — obrigatório para APK/AAB

Sem FCM configurado, o app pode ter permissão de notificação e **ainda assim não obter `ExpoPushToken`**. Nesse caso o backend loga `fechamento_push_sem_token` e o motoboy só vê o fechamento entrando em **Meus fechamentos**.

## Checklist

1. Criar/usar projeto Firebase com o package `br.com.trackingsaidas.mobile`.
2. Baixar `google-services.json` e colocar na raiz do app mobile.
3. Em `app.json`: `"googleServicesFile": "./google-services.json"` (já configurado).
4. No Firebase, cadastrar SHA-1 do keystore de **release da Play**:
   `A7:E4:48:EA:B1:4C:52:CB:50:E6:95:1A:50:BD:A2:7D:F2:C9:09:AF`
   (arquivo local: `credentials/android/release.jks`, alias `trackingsaidas`).
5. FCM V1 no Expo Credentials (já feito no projeto).
6. No EAS, usar o keystore da Play (`release.jks`) — não o `@acsilva__*.jks`.
7. Gerar **novo** build: `eas build -p android --profile production`
8. Instalar, logar como motoboy, aceitar notificações.
9. API após login: `push_register_ok ... motoboy_id=...`
10. Ao gerar fechamento: `fechamento_push_ok` (não `fechamento_push_sem_token`).

## Diagnóstico rápido

| Log | Significado |
|-----|-------------|
| `push_register_ok` | Token gravado no backend |
| `fechamento_push_sem_token` | Sem token ativo para o motoboy |
| `fechamento_push_ok` | Expo aceitou o envio |
| `expo_push_ticket_error` | Expo/FCM rejeitou (credencial, DeviceNotRegistered, etc.) |

No Logcat do aparelho, filtre por `[push]`:

- `[push] register ok` → cliente registrou
- `[push] falha ao obter ExpoPushToken` → quase sempre FCM/`google-services` ausente ou mal configurado
