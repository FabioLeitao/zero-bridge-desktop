# zero-bridge-desktop

Shell desktop do zero-bridge. O processo principal do Electron sobe o bridge em Go como sidecar em loopback, carrega essa UI e fica com a bandeja, as notificações e a geometria da janela.

**English:** [README.md](README.md)

## Rodar (dev)

```bash
npm ci
npm run check
npm run build
```

Esse `npm ci` não baixa o binário do Electron. O `.npmrc` define `ignore-scripts=true`. Instale o binário só quando for abrir a janela:

```bash
npm ci --allow-scripts
```

O shell lê os binários de `ZB_BRIDGE_BIN` e `ZB_AGENT_BIN` (o e2e usa `ZB_E2E_BRIDGE_BIN` e `ZB_E2E_AGENT_BIN`). A página não escolhe o executável. Veja [docs/INSTALL.pt_BR.md](docs/INSTALL.pt_BR.md).

## Segurança

- `contextIsolation`, `sandbox` e `nodeIntegration: false`.
- Cada canal IPC confere o frame do remetente e o payload. `zb:launch` não aceita caminho de binário.
- O token de lançamento fica no processo principal. O arquivo é `0600` em `userData/tokens` (`0700`). Falha de `chmod` aborta o lançamento.
- A porta `0` continua efêmera. A saúde é `GET /health` sem token. Falha mostra uma página de erro com o texto escapado.
- O shell define CSP, nega permissão pedida pela página e nega navegação enquanto a origem do sidecar não existe.
- Sair pela bandeja encerra o sidecar. O texto da notificação é limpo no processo principal.

A exceção de auditoria do `sprintf-js` está em [docs/AUDIT_EXCEPTION.pt_BR.md](docs/AUDIT_EXCEPTION.pt_BR.md). O modelo de ameaças está em [docs/THREAT_MODEL.pt_BR.md](docs/THREAT_MODEL.pt_BR.md).

## Testes

`npm test` roda a suíte unitária (72 testes em 2026-10-19). `npm run check` é lint, o gate da exceção de auditoria e essa suíte.

Cobertura de `node --test --experimental-test-coverage --import tsx/esm tests/*.test.ts` em 2026-10-19:

| escopo | linha | ramo | funções |
| --- | ---: | ---: | ---: |
| arquivos carregados | 96,01% | 85,77% | 87,39% |
| `src/sidecar.ts` | 100% | 93,06% | 96,30% |

`src/main.ts` e `src/preload.ts` importam o Electron, então essa medição não os carrega. O e2e é `npm run test:e2e` depois de `npm ci --allow-scripts`. Sem o binário, os três testes ficam pulados. O CI roda a suíte em `.github/workflows/check.yml`.
