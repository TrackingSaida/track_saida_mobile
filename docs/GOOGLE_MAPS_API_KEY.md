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

---

## Mapa em branco (sem tiles, só fundo bege e logo Google)

Se o app não fecha mais, mas o mapa não mostra ruas nem satélite, faça no **Google Cloud**:

### 1. Ativar a API correta

- **APIs e serviços** → **Biblioteca** → procure **"Maps SDK for Android"**.
- Clique e depois em **Ativar** (se ainda não estiver ativada).

### 2. Vincular faturamento (obrigatório)

O Google Maps exige que o projeto tenha **uma conta de faturamento vinculada**, mesmo para uso dentro da cota gratuita.

- Menu **Faturamento** (ou **Billing**) → **Vincular uma conta de faturamento**.
- Crie ou escolha uma conta; é preciso informar cartão, mas há **crédito gratuito** e cota gratuita mensal para Maps (geralmente suficiente para app de entregas).

Sem faturamento vinculado, a API key é aceita mas os **tiles do mapa não são entregues**, e a tela fica em branco.

### 3. Restrições da chave (se estiver usando)

Se na chave você ativou **"Restringir chave"** e escolheu **Restrições de API**:

- Inclua **"Maps SDK for Android"** na lista de APIs permitidas.
- Se só outras APIs estiverem listadas, o mapa não carrega.

Depois de ativar a API, vincular faturamento e (se aplicável) liberar "Maps SDK for Android" na chave, **não é necessário novo build**: abra de novo a tela do mapa no app (ou feche e reabra o app) e o mapa deve carregar.
