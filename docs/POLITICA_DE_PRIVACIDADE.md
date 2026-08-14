# Política de Privacidade — ROTEVO (rascunho para publicação)

> **Status:** rascunho operacional. Preencha os placeholders `[...]` antes de
> publicar em URL HTTPS pública. Não invente dados jurídicos.

**Última atualização (rascunho):** [DATA_DE_VIGENCIA — ex.: 27/07/2026]  
**URL definitiva prevista:** `[URL_HTTPS_DA_POLITICA]`  
**Aplicativo:** ROTEVO (Android — `br.com.trackingsaidas.mobile`)

---

## 1. Identificação do aplicativo

O **ROTEVO** é um aplicativo móvel voltado à operação de entregas
last-mile (coleta, preparação de rota, navegação, registro de entrega e
ausência, comprovantes e consulta de pacotes).

## 2. Responsável pelo tratamento

| Campo | Valor |
|-------|--------|
| Responsável legal / controlador | `[RESPONSAVEL_LEGAL]` |
| Razão social (se aplicável) | `[RAZAO_SOCIAL]` |
| CNPJ (se aplicável) | `[CNPJ]` |
| E-mail de contato / privacidade | `[EMAIL_PRIVACIDADE]` |
| Canal para solicitações de titulares | `[CANAL_SOLICITACOES — e-mail ou formulário]` |

## 3. Dados coletados

Conforme o uso do aplicativo e da API associada, podem ser tratados:

| Categoria | Exemplos | Observação |
|-----------|----------|------------|
| Identificação / conta | Nome de usuário/login, identificadores de sessão, sub-base | Necessários à autenticação e ao escopo multi-tenant |
| Credenciais | Senha (enviada apenas no login); tokens armazenados de forma segura no dispositivo | Opção de “lembrar” credenciais no aparelho, se ativada pelo usuário |
| Localização aproximada | Inferência de cidade/região para sugestões e mapa | Em primeiro plano, mediante permissão |
| Localização exata | Coordenadas para mapa e navegação durante entregas | Em primeiro plano, mediante permissão |
| Localização em segundo plano | Coordenadas enquanto houver **rota ativa** | Somente após divulgação e permissão; uso no dispositivo para andamento da rota |
| Fotos | Comprovantes de entrega e de ausência | Captura/galeria; envio ao backend/armazenamento |
| Dados de entregas | Códigos, status, eventos, comprovantes | Operação e histórico |
| Endereços e destinatários | Endereços de entrega e dados operacionais associados | Necessários à execução das rotas |
| Dados técnicos mínimos | Logs de erro/diagnóstico do dispositivo ou SDKs, se gerados | `[CONFIRMAR_SE_HA_SDKS_DE_ANALYTICS]` |

Não vendemos dados pessoais.

## 4. Finalidades

Os dados são utilizados para:

- autenticação e manutenção de sessão;
- seleção de sub-base e isolamento operacional;
- preparação, otimização e execução de rotas;
- navegação e acompanhamento da rota ativa;
- registro de entrega e de ausência;
- comprovantes fotográficos;
- sincronização com o backend quando houver conexão;
- suporte e segurança da conta (alteração de senha, biometria opcional).

## 5. Localização (incluindo segundo plano)

- A localização em primeiro plano pode ser solicitada para mapa, cidade de busca
  e navegação.
- A localização em **segundo plano** é usada **somente durante uma rota ativa**,
  após ação clara do usuário (iniciar/retomar rota) e após uma **divulgação
  destacada** no aplicativo, seguida da permissão do sistema.
- O rastreamento em segundo plano **é encerrado** ao **finalizar** ou
  **cancelar** a rota.
- No comportamento atual do aplicativo, as coordenadas da rota ativa são
  utilizadas **no dispositivo** para navegação e andamento da rota. **Não**
  afirmamos transmissão contínua da localização ao servidor; se isso mudar no
  futuro, esta política será atualizada.
- Se a permissão de segundo plano for negada ou adiada (“Agora não”), a rota
  pode continuar, porém sem rastreamento em segundo plano.

## 6. Fotos e comprovantes

- O usuário pode capturar ou selecionar fotos para comprovante de entrega ou
  ausência.
- As imagens são enviadas à infraestrutura do serviço (backend e armazenamento
  de objetos, por exemplo B2), vinculadas à entrega correspondente.
- Regras de retenção e exclusão de arquivos: `[POLITICA_RETENCAO_FOTOS — a confirmar]`.

## 7. Compartilhamento e provedores

Os dados podem ser processados por provedores de infraestrutura necessários à
operação, incluindo, conforme aplicável:

- hospedagem da API (`[PROVEDOR_API — ex.: Render u outro]`);
- armazenamento de arquivos/comprovantes (`[PROVEDOR_STORAGE — ex.: Backblaze B2]`);
- mapas e geocodificação (Google Maps / serviços de mapa utilizados no app);
- eventual reconhecimento de fala do sistema operacional, quando o usuário usar
  ditado.

Esses provedores processam dados sob instruções e contratos aplicáveis. Não
compartilhamos dados para marketing de terceiros.

## 8. Segurança

- Comunicação com a API via **HTTPS**.
- Tokens e preferências sensíveis no dispositivo via armazenamento seguro
  (Secure Store), conforme implementação atual.
- Controles de acesso por autenticação e escopo de sub-base.
- Medidas adicionais: `[MEDIDAS_SEGURANCA_ADICIONAIS — a confirmar]`.

## 9. Retenção

Prazos de retenção de dados no servidor, logs e comprovantes:
`[PRAZOS_DE_RETENCAO — a confirmar com o responsável]`.

Dados locais (tokens, preferências, rascunhos) permanecem no aparelho até
logout, exclusão do aplicativo ou limpeza pelo usuário, conforme o caso.

## 10. Exclusão e direitos do titular

Hoje, o aplicativo permite logout e limpeza de sessão no dispositivo. Para
solicitar exclusão ou correção de dados tratados no backend:

1. Contate `[EMAIL_PRIVACIDADE]` / `[CANAL_SOLICITACOES]`.
2. Informe usuário/login e, se possível, sub-base.
3. O responsável avaliará a solicitação conforme a legislação aplicável
   (incluindo LGPD, quando cabível).

**Mecanismo automatizado de exclusão na conta:** `[EXISTE_OU_NAO — refletir situação atual]`.

## 11. Direitos do titular

Na medida aplicável à legislação vigente, o titular pode solicitar: confirmação
de tratamento, acesso, correção, anonimização, portabilidade, informação sobre
compartilhamentos e revogação de consentimento quando o tratamento se basear em
consentimento.

## 12. Uso por menores

O aplicativo é destinado a uso profissional por entregadores e operadores.
Não é direcionado a menores de 13 anos. `[POLITICA_MENORES — ajustar se houver regra interna]`.

## 13. Alterações desta política

Podemos atualizar esta política para refletir mudanças no aplicativo ou na
legislação. A data de vigência será atualizada. Alterações relevantes poderão
ser comunicadas pelo aplicativo, e-mail ou URL publicada.

## 14. Contato

- Privacidade: `[EMAIL_PRIVACIDADE]`
- Suporte operacional: `[EMAIL_SUPORTE]`
- Endereço postal (se aplicável): `[ENDERECO]`

---

## Checklist antes de publicar a URL

- [ ] Preencher todos os placeholders `[...]`
- [ ] Publicar em HTTPS acessível sem login
- [ ] Configurar `EXPO_PUBLIC_PRIVACY_POLICY_URL` no EAS (e rebuild se necessário)
- [ ] Conferir link em **Mais → Privacidade → Política de Privacidade**
- [ ] Alinhar declarações da Play Console (Segurança dos dados / BG location) com este texto
