# Modelo de ameaças do desktop

**English:** [THREAT_MODEL.md](THREAT_MODEL.md)

Comportamento atual do shell no branch `epic/finish-secure-test-2026-10-19` (revisão em 2026-10-19). O texto da fase de plano descrevia `origin/main` em `0dec4f3`. Este arquivo substitui aquele retrato.

Relacionado: [README](../README.pt_BR.md), [instalação](INSTALL.pt_BR.md), [exceção de auditoria](AUDIT_EXCEPTION.pt_BR.md).

O núcleo do bridge continua em `zero-bridge` (`3a442f8` quando isto foi conferido). Fatos daquele repositório estão marcados como **bridge**.

## Ativos

- O token de cada lançamento e o arquivo `0600` em `userData/tokens`.
- O processo iniciado como `--agent-cmd`.
- As pastas que o operador expõe ao agente.
- A janela que carrega a UI do bridge e as notificações nativas.
- O lockfile e os pacotes Linux.

## Atores

- Conteúdo na `BrowserWindow`. Um bug de script na UI do bridge pode chamar `window.zb`. Esse frame é o remetente que o shell aceita.
- Outro usuário local que consiga conectar no TCP de loopback ou ler um arquivo de token com modo frouxo.
- O operador no teclado, inclusive DevTools.
- O lockfile, os scripts de instalação e os arquivos que o operador baixa à mão.

O shell não escuta fora do loopback.

## Fronteiras

```
renderer (UI do bridge) --preload window.zb--> processo principal
principal --spawn argv + arquivo de token--> zero-bridge --listen 127.0.0.1:porta
principal --POST /v1/login--> cookie zb_session e loadURL
principal --diálogo / bandeja / Notification--> SO
```

`IPC_CHANNELS` em `src/types.ts` é a allowlist. `src/ipcGuard.ts` rejeita um remetente cujo id de `webContents` ou de frame não é a janela principal, e rejeita um payload que não tem a forma daquele canal. `zb:launch` só pode trazer um `workspaceRoot` opcional. Os binários vêm de `ZB_BRIDGE_BIN` / `ZB_AGENT_BIN` (`src/bins.ts`). Testes: `tests/ipcGuard.test.ts`.

Um script hostil que já roda no frame principal passa na checagem de remetente. O limite são as regras de payload.

Uma chamada rejeitada é contada no processo principal como `ipc rejected channel=<nome> reason=<código> count=<n>` (`src/ipcLog.ts`). A linha não tem payload nem caminho. **Verificado:** `tests/ipcLog.test.ts`. O destino padrão é `console.error`.

## STRIDE

### Renderer e preload

| | |
| --- | --- |
| Spoofing | O remetente precisa ser o frame principal. **Verificado:** `acceptIncoming`. |
| Tampering | O payload de launch não nomeia binário, porta nem caminho do token. **Verificado:** `tests/ipcGuard.test.ts`. |
| Vazamento | `rendererLaunchView` descarta `token` e `tokenPath`. **Verificado:** `tests/token.test.ts`. |
| Elevação | `spawn` usa os binários da allowlist. A página não escolhe o arquivo. **Verificado:** `src/bins.ts`. |

A janela define `contextIsolation`, `sandbox` e `nodeIntegration: false`. Arquivos soltos são lidos com `webUtils.getPathForFile` no preload, não com um caminho inventado pela página.

### Navegação, CSP, permissões, fuses

| | |
| --- | --- |
| Spoofing | `navigationDecision` nega toda URL enquanto `currentUrl` é nulo e, depois, só permite a origem do sidecar. `will-navigate` e `will-redirect` usam a mesma função. **Verificado:** `tests/shellPolicy.test.ts`. |
| Tampering | `window.open` é negado. **Verificado.** |
| Elevação | Os handlers de permissão da página negam. **Verificado.** |
| Vazamento | `withShellCsp` define `default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`. **Verificado.** |

`loadURL` não emite `will-navigate`. O shell chama isso para a origem do sidecar depois do login, e para uma página de erro `data:`. O HTML do erro é escapado (`src/errorPage.ts`).

O pacote aplica os sete fuses do Electron em `package.json` `build.electronFuses`, espelhados por `src/electron.fuses.ts`. Um teste compara os dois. Os fuses valem para o app empacotado, não para `npx electron` no desenvolvimento.

Nenhum handler de protocolo está registrado. `zero-bridge://` continua desligado.

### Pasta de trabalho

As raízes vêm de `GET /v1/info` com bearer (`src/workspaceRoots.ts`). Lista vazia não abre o diálogo. `pathAllowed` usa `realpath`, então um symlink que sai da raiz é recusado. **Verificado:** `tests/folderPicker.test.ts`. O primeiro lançamento ainda não tem raízes, então um `workspaceRoot` vindo da página é recusado até um lançamento seguinte.

### Sidecar e token

| | |
| --- | --- |
| Spoofing | `--listen` é `127.0.0.1:<porta>`. A porta `0` pede uma porta ao SO e não vira `8765`. **Verificado:** `tests/sidecarHealth.test.ts`. |
| Tampering | `spawn` recebe um array de argv. O token vai em `--token-file`, não como valor de argv. **Verificado:** `tests/token.test.ts` lê o argv gravado. |
| Vazamento | O login é `POST /v1/login` só em `127.0.0.1`. O cookie é gravado pelo processo principal. **Verificado:** `tests/sessionLogin.test.ts`. O teste unitário não abre o Electron. |
| Negação de serviço | `/health` é consultado sem token. Stdout não é sinal de saúde. O stderr vira `port-in-use`, `bad-token`, `agent-not-found` ou `crashed`, e a janela mostra esse estado. **Verificado.** |
| Elevação | `chmod` `0700` e depois `0600`. Falha apaga o diretório e lança erro. **Verificado.** O diretório padrão é `userData/tokens` (`src/tokenDir.ts`). |

`sanitizeEnv` ainda copia `process.env` e só apaga `ZERO_BRIDGE_TOKEN`. Essa herança segue aberta (issue de allowlist de ambiente no desktop). `unixSocket` continua sem leitura. Sair pela bandeja chama `controller.kill` e depois `app.quit` (`tests/tray.test.ts`). `before-quit` é async; o Electron pode sair antes dessa promise. **Suposição.**

### Notificações

O preload lê o texto de `section.perm` e envia `zb:permission-request`. O processo principal remove `<>&"'` e quebras de linha e limita o título a 80 caracteres. Janela em foco não mostra notificação. **Verificado:** `tests/notifications.test.ts`. O título ainda nasce no DOM da página, então uma UI comprometida pode pedir uma notificação cujo texto só é limitado por essa limpeza.

### Cadeia de suprimento

Não há dependências de produção. `npm audit --omit=dev` está limpo. O lockfile tem um aviso aceito, `GHSA-hp3w-g68c-fv3c` (`sprintf-js@1.1.3`, via `electron-builder`), registrado em [AUDIT_EXCEPTION.pt_BR.md](AUDIT_EXCEPTION.pt_BR.md) com revisão em 2027-01-19. `npm run audit` falha em qualquer outro id. Scripts de instalação ficam desligados, salvo `--allow-scripts`. Não há auto-update. Os alvos Linux são AppImage e deb. macOS e Windows ficam para depois; não são gerados aqui.

## Cobertura (2026-10-19)

`node --test --experimental-test-coverage --import tsx/esm tests/*.test.ts`

| escopo | linha | ramo | funções |
| --- | ---: | ---: | ---: |
| arquivos carregados | 96,01% | 85,77% | 87,39% |
| `src/sidecar.ts` | 100% | 93,06% | 96,30% |

`src/main.ts` e `src/preload.ts` ficam fora dessa medição porque importam o Electron. O e2e carrega a UI real, o cartão de permissão e o log da notificação com a janela oculta. Nesta máquina o binário do Electron não está presente (`ignore-scripts`), então os três testes são pulados. O CI (`.github/workflows/check.yml`) roda `npm ci --allow-scripts` e `npm run test:e2e`. Esse workflow não foi executado a partir deste worktree.

## Ainda aberto

1. O ambiente do processo filho é herdado, fora `ZERO_BRIDGE_TOKEN`.
2. O listen é TCP loopback, não o Unix socket do bridge.
3. Um script no frame principal é um remetente confiável. As regras de payload e a limpeza limitam isso; não tiram essa confiança.
4. Não há auto-update assinado. Não há pacote macOS nem Windows.
5. O sidecar não é reiniciado depois de um crash.
6. `before-quit` pode não esperar o `kill`.
