# Como obter o log de erro (crash) no Android

Quando o app fecha sozinho (crash) no APK de produção, o Android registra o erro no **logcat**. Para ver o que aconteceu:

## 1. Ativar depuração USB no celular

1. Abra **Configurações** → **Sobre o telefone**.
2. Toque **7 vezes** em "Número da versão" até aparecer "Você agora é um desenvolvedor!".
3. Volte em **Configurações** → **Opções do desenvolvedor**.
4. Ative **Depuração USB**.

## 2. Instalar o ADB no computador

- **Windows:** baixe [Android SDK Platform-Tools](https://developer.android.com/studio/releases/platform-tools) e extraia; use a pasta no terminal.
- **macOS:** `brew install android-platform-tools`
- **Linux:** `sudo apt install adb` (Ubuntu/Debian)

## 3. Conectar o celular e reproduzir o crash

1. Conecte o celular ao PC com cabo USB.
2. No celular, quando aparecer "Permitir depuração USB?", toque em **Permitir**.
3. No computador, abra o terminal e confira a conexão:
   ```bash
   adb devices
   ```
4. **Deixe o terminal aberto** e no celular abra o app e faça o que faz o app fechar (ex.: Criar Rota → Criar rota parcial).
5. O crash será registrado no logcat em tempo real.

## 4. Ver o log no momento do crash

**Só erros e exceções (recomendado para crash):**
```bash
adb logcat AndroidRuntime:E *:S
```

**Tudo do app (React Native + JS):**
```bash
adb logcat ReactNative:V ReactNativeJS:V AndroidRuntime:E *:S
```

**Salvar o log em arquivo** (útil para enviar para alguém analisar):
```bash
adb logcat -d > logcat_crash.txt
```
O `-d` despeja o log atual (faça logo após o crash). Para ir gravando em tempo real até o crash:
```bash
adb logcat > logcat_crash.txt
```
Depois do crash, pressione Ctrl+C e abra `logcat_crash.txt`.

## 5. O que procurar no log

- **`FATAL EXCEPTION`** ou **`AndroidRuntime`** → exceção Java/nativa que derrubou o app.
- **`ReactNativeJS`** com mensagem de erro ou stack trace → erro em JavaScript/React.
- Trecho com **`track_saida_mobile`** ou o nome do pacote do app.

Envie o trecho do log desde a linha do erro até o fim do stack trace para quem for debugar.
