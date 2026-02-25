# Chave da API do Google Maps (Android)

O app usa **Google Maps** na tela "Criar Rota" (mapa da rota). No build de produção (APK/AAB), a chave da API precisa estar configurada, senão o app fecha ao abrir essa tela com o erro:

`API key not found. Check that <meta-data android:name="com.google.android.geo.API_KEY" .../> is in AndroidManifest.xml`

## Como obter a API key

1. Acesse [Google Cloud Console](https://console.cloud.google.com/).
2. Crie um projeto ou selecione um existente.
3. Ative a **Maps SDK for Android**:
   - Menu **APIs e serviços** → **Biblioteca** → procure "Maps SDK for Android" → **Ativar**.
4. Crie uma chave:
   - **APIs e serviços** → **Credenciais** → **Criar credenciais** → **Chave de API**.
5. (Recomendado) Restrinja a chave:
   - Edite a chave → **Restrição de aplicativo** → **Aplicativos Android**.
   - Adicione o nome do pacote: `com.anonymous.track_saida_mobile`.
   - Para builds EAS, adicione o SHA-1 do certificado (em EAS: Project → Build credentials; ou use `keytool` no keystore).

## Onde configurar no projeto

**Opção A – Direto no app.json (desenvolvimento / teste)**  
Substitua `YOUR_GOOGLE_MAPS_ANDROID_API_KEY` em `app.json` pela sua chave:

```json
"android": {
  "config": {
    "googleMaps": {
      "apiKey": "SUA_CHAVE_AQUI"
    }
  }
}
```

**Opção B – Variável de ambiente (EAS Build, não commitar a chave)**  
1. No projeto já existe `app.config.js`, que lê a variável `GOOGLE_MAPS_ANDROID_API_KEY`.
2. No [EAS](https://expo.dev): **Project** → **Secrets** → adicione `GOOGLE_MAPS_ANDROID_API_KEY` com o valor da chave.
3. Faça um novo build; a chave será injetada automaticamente.

Depois de configurar a chave, gere um novo APK/AAB (por exemplo `eas build -p android --profile production`). O crash ao abrir "Criar Rota" / "Criar rota parcial" deve parar de ocorrer.
