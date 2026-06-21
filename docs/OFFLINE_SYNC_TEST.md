# Testes manuais — offline-first entregas (v1.4.0)

## Pré-requisitos

- Backend v1.3+ com header `X-Client-Action-Id` (logs)
- App mobile v1.4.0
- Motoboy com rota ativa e entrega em `EM_ROTA`

## Matriz

| # | Cenário | Passos | Esperado |
|---|---------|--------|----------|
| 1 | Foto obrigatória, 1 foto | Adicionar 1 foto e confirmar | Entrega concluída; 1 foto no servidor |
| 2 | Foto obrigatória, 2 fotos, 2ª falha (modo avião após 1ª) | Online: confirmar com 2 fotos; simular falha na 2ª via offline antes do sync | Pode concluir com 1 foto (regra de negócio) |
| 3 | Confirmar offline | Modo avião → entregue com 1 foto | Modal fecha; banner “aguardando envio”; sync ao reconectar |
| 4 | Kill app com fila | Confirmar offline → matar app → reabrir | Banner persiste; sync continua |
| 5 | Refresh / rede | Durante sync instável | Não logout automático; fila retenta |
| 6 | Lote rota (3 pacotes) | Entregue na parada com foto | Fotos nos 3 `id_saida` |
| 7 | Ausente batch | Parada com 2+ pacotes | Dialog “só este / todos”; ausência enfileirada/sync |
| 8 | Re-sync duplicata | Entrega já no servidor | Fila conclui sem erro (`STATUS_FINALIZADO` OK) |

## Comandos úteis

```bash
# Typecheck mobile
cd track_saida_mobile && npx tsc --noEmit

# Testes unitários foto
npx jest src/features/entregas/utils/__tests__/photoValidationUtils.test.ts
```

## Logs Render (backend)

- `marcar_entregue client_action_id=...`
- `marcar_ausente client_action_id=...`
