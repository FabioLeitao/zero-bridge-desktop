# Modelo de ameaças do desktop

**English:** [THREAT_MODEL.md](THREAT_MODEL.md)

Revisão da fase de planejamento do shell Electron. Código revisado: `0dec4f3` (`origin/main` em 2026-10-19). Este documento não muda o comportamento em execução.

Relacionado: [README](../README.md), [instalação](INSTALL.pt_BR.md) ([English](INSTALL.md)), [regras do agente](../AGENTS.pt_BR.md) ([English](../AGENTS.md)).

O núcleo do bridge (HTTP, checagem do token, Host/Origin, CSP nas respostas que ele escreve) fica em `zero-bridge`. Fatos tirados daquele checkout estão marcados como **main do bridge** e citam `FabioLeitao/zero-bridge` em `3a442f8`. Esta suíte não os testa de novo.

## Ativos

- Token por lançamento e o arquivo `0600` que o guarda.
- O processo que o `spawn` inicia (`--agent-cmd` roda em seguida).
- Pastas de workspace que o operador aceita expor ao agente.
- A janela que carrega a UI do bridge e as notificações nativas.
- Os artefatos Linux empacotados e o lockfile do npm.

## Atores

- **Conteúdo web remoto** não é alvo. O shell não pode escutar fora do loopback.
- **Conteúdo dentro da `BrowserWindow`** (a UI do bridge, ou qualquer origem que a janela possa carregar). Um bug de script nessa UI consegue chamar `window.zb`.
- **Outro processo ou usuário local** que consiga conectar numa porta TCP de loopback ou ler um arquivo de token com modo errado.
- **O operador** no teclado, inclusive DevTools. Essa pessoa é confiável na máquina. O shell ainda não pode dar à página um jeito de iniciar um executável arbitrário.
- **Entradas de build e de atualização:** o lockfile, scripts de instalação e arquivos que o operador baixa à mão.

## Como ler os rótulos

- **Verificado:** um arquivo deste repositório (ou o arquivo citado do bridge) mostra o comportamento. `tsc --noEmit --rootDir .` nesta árvore reporta dois erros, citados abaixo. Teste que não chama a função não é evidência.
- **Suposição:** padrão do Electron ou do sistema, ou uma corrida que as definições de tipo não descrevem. Nenhum teste deste repo fixa isso.

## Fronteiras

```
renderer (UI do bridge) --preload window.zb--> processo main
main --spawn argv + arquivo de token + env--> sidecar zero-bridge --listen--> loopback
main --dialog / bandeja / Notification--> SO
main --fetch--> HTTP do sidecar
lockfile npm / electron-builder --> AppImage e deb empacotados
```

`src/types.ts` nomeia quatro canais. O preload e o `ipcMain` registram outros. Não existe uma allowlist única compartilhada pelos dois lados.

| Canal | Direção | Payload que o código aceita | Checagem do remetente | Checagem do payload |
| --- | --- | --- | --- | --- |
| `zb:launch` | invoke do renderer | `any`; binários e `tokenDir` com `String`, porta com `Number` | nenhuma | o caminho não é fixado num binário conhecido |
| `zb:state` | main para o renderer | `{state, url}` | n/a | a url é o que estiver em `currentUrl` |
| `zb:tray` | só declarado | sem handler | nenhuma | sem uso |
| `zb:quit` | send do renderer | nenhum | nenhuma | nenhuma |
| `zb:folder-drop` | invoke do renderer | `string[]` na declaração, sem conferir o tipo | nenhuma | teste de prefixo em `handleDrop` quando há raízes |
| `zb:fetch-workspace-roots` | invoke do renderer | nenhum | nenhuma | JSON de `GET /v1/capabilities` aceito se parsear |
| `zb:permission-request` | send do renderer | `any` | nenhuma | `sanitizeText` não é alcançável (ver notificações) |
| `zb:pick-workspace` | invoke do renderer | nenhum | nenhuma | resultado do diálogo e teste de prefixo; raízes vazias pulam o teste |
| `zb:permission-focus` | main para o renderer | `reqId`, `sessionId` | n/a | ids repassados como chegaram |

Nenhum teste envia um canal a partir de um segundo frame nem afirma uma rejeição. `tests/origin.test.ts` cobre só `src/origin.ts`.

## STRIDE

### Renderer e preload

| | |
| --- | --- |
| Spoofing | Qualquer script na janela pode chamar `window.zb`. O `ipcMain` nunca compara `event.sender` com `mainWindow.webContents`. **Verificado:** `src/preload.ts`, `src/main.ts`. |
| Tampering | `zb:launch` passa `bridgeBin`, `agentBin`, `port`, `tokenDir` e `workspaceRoot` para `SidecarController.launch`. **Verificado.** |
| Repudiation | Não há log de auditoria do IPC. **Verificado** (nenhum logger em `src/`). |
| Information disclosure | `launch` devolve `tokenPath` ao renderer. **Verificado:** valor de retorno em `src/main.ts`. A string do token não está nesse objeto. |
| Denial of service | `zb:quit` e uma queda do processo main são locais. **Verificado:** o handler existe. |
| Elevation | `spawn(bridgeBin, args)` com `shell` omitido executa esse arquivo. Uma página que chama `launch` escolhe o executável. **Verificado:** `src/sidecar.ts`. |

**Abuso:** a página carregada chama `zb.launch({ bridgeBin, agentBin, tokenDir, workspaceRoot })` com caminhos que ela escolhe. O processo main é quem deveria escolher os binários.

**Mitigação que existe:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` na única `BrowserWindow` (`src/main.ts`). Os tipos do Electron 41 dizem que `sandbox` é `true` por padrão desde o Electron 20, `nodeIntegration` é `false`, `nodeIntegrationInWorker` é `false` e `webSecurity` é `true`. A janela liga os três flags de forma explícita. `nodeIntegrationInSubFrames` fica sem valor; o comentário da propriedade não documenta o padrão. **Suposição:** omitido significa desligado.

**Lacuna:** o preload reintroduz launch, quit, caminhos de pasta e texto de notificação. O sandbox não restringe IPC. Não há teste de rejeição.

### Navegação, CSP, permissões, fuses

| | |
| --- | --- |
| Spoofing | `will-navigate` compara origens só depois que `currentUrl` existe. Enquanto é null, o handler retorna e não chama `preventDefault`. **Verificado.** |
| Tampering | `setWindowOpenHandler` sempre devolve `{ action: "deny" }`. **Verificado.** `webContents.loadURL` não emite `will-navigate` (comentário dos tipos do Electron 41). O app nunca chama `loadURL`. `scripts/smoke.mjs` chama, e esse script não é o app. |
| Information disclosure | `session.defaultSession.webRequest.onHeadersReceived` copia os cabeçalhos e não define nada. **Verificado.** Não remove um CSP que o bridge já tenha definido. |
| Elevation | Não há `setPermissionRequestHandler` nem `setPermissionCheckHandler`. **Verificado** pela ausência. Os comentários dos tipos do Electron 41 não dizem se o padrão concede ou nega. **Suposição:** a decisão é o padrão interno do Electron, não uma regra deste repo. |
| Denial of service | Um erro dentro de `will-navigate` (`new URL` numa string ruim) não é capturado. **Verificado:** a chamada não tem try/catch. O efeito na navegação é **suposição**. |

Não há handler de `will-redirect`, nem `will-attach-webview`, nem bloqueio em `webRequest` de URLs fora do loopback.

**CSP do bridge (main do bridge):** `bridge/internal/server/security.go` define `default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` nas respostas que passam por `writeSecurityHeaders`. Esse cabeçalho só vale depois que a janela está de fato mostrando uma resposta do bridge. Este shell não o adiciona.

**Fuses:** `src/electron.fuses.ts` não é importado. O `build` do `package.json` não define `electronFuses`. `@electron/fuses` aparece só como dependência transitiva do `electron-builder` no lockfile. **Verificado.** O objeto nesse arquivo não é a API de fuses (`EnableRunAsNode` e o restante). **Lacuna:** o empacotamento não liga os fuses. `RunAsNode`, argumentos de inspect e `NODE_OPTIONS` ficam como o Electron entrega.

**Protocolos e `file://`:** não há `protocol.register*`, nem `setAsDefaultProtocolClient`, nem handler de `open-url`. **Verificado.** A issue #25 diz que `zero-bridge://` fica desligado até ter um uso. `allowFileAccessFromFileUrls` em `electron.fuses.ts` não é aplicado. `navigateOnDragDrop` fica sem valor; os tipos do Electron 41 usam `false` como padrão. **Suposição:** um drop não navega. O caminho de drop que existe é IPC, abaixo.

**DevTools:** nada os desliga. **Suposição:** o atalho padrão ainda os abre para o operador local.

### Drop de pasta e o seletor

| | |
| --- | --- |
| Tampering | `zb:folder-drop` confia no renderer para a lista de caminhos. O preload não usa `webUtils.getPathForFile`. **Verificado.** |
| Elevation | `FolderPicker.pick` aceita qualquer diretório quando `allowedRoots` está vazio. **Verificado:** `src/folderPicker.ts`. `handleDrop` devolve null nesse caso (o drop é mais estrito que o diálogo). |
| Spoofing | As raízes vêm de `GET ${currentUrl}v1/capabilities` sem cabeçalho `Authorization`. **Verificado:** `src/main.ts`. |

**Contrato do bridge (main do bridge):** `GET /v1/capabilities` devolve modos do agente, não `workspaceRoots` (`handleCapabilities`). `workspaceRoots` está em `GET /v1/info`. Nenhum dos dois caminhos é público. `authorized` só dispensa o token em `/health`, `/`, `/app.js`, `/style.css`, status de auth e login. Um fetch sem bearer recebe 401, o `catch` do shell não grava nada, e o seletor então aceita qualquer diretório.

**Checagem de caminho:** `resolve` mais `startsWith(root + "/")` ou igualdade exata. `resolve` não segue symlink. **Verificado** (`path.resolve` do Node). Um symlink dentro de uma raiz pode apontar para fora dela. A forma com prefixo rejeita `/root-evil` quando a raiz é `/root`. **Verificado** pela condição. `tests/folderPicker.test.ts` repete esse teste de string no próprio teste e não chama `handleDrop` nem `pick`. O arquivo também falha ao carregar sob `node --test` porque `electron` não tem o export nomeado `dialog` fora do processo Electron.

`pick(mainWindow, dialog)` passa um segundo argumento que o método não declara. **Verificado:** erro TS2554 do `tsc`. Em execução um argumento extra é ignorado; o método usa o `dialog` que ele mesmo importa. **Suposição** se o arquivo for executado por um loader que pula o `tsc`.

### Processo sidecar

| | |
| --- | --- |
| Spoofing | O argumento de escuta é `127.0.0.1:${port}`. **Verificado.** Nenhum caminho passa um host fora do loopback. |
| Tampering | `spawn` recebe um array de argv. `shell: true` está ausente. O token vai em `--token-file`, não nas strings do argv. **Verificado.** |
| Information disclosure | `sanitizeEnv` copia `process.env` e apaga só `ZERO_BRIDGE_TOKEN`. **Verificado.** As outras variáveis (`LD_PRELOAD`, chaves de API no ambiente do pai) são herdadas. Erros de `chmod` são engolidos. **Verificado.** |
| Denial of service | `Number(opts.port \|\| env \|\| "0") \|\| 8765` transforma `0` em `8765`. **Verificado.** O helper de porta livre em `SidecarController` não roda nos launches que vêm do `ipcMain`. A URL usa essa mesma `port`, não `handle.port`. |
| Elevation | `--workspace-root` é acrescentado a partir de quem chamou, sem a checagem do `FolderPicker`. **Verificado.** `--public-origin` nunca é passado. `unixSocket` está no tipo das opções e nunca é lido. |
| Repudiation | stdout muda o estado para `running` no primeiro bloco. stderr é descartado. O comentário de health em `sidecar.ts` diz que uma checagem real sondaria `/health` e que a sonda não está implementada. **Verificado.** Os estados `port-in-use`, `bad-token` e `agent-not-found` existem no tipo e nunca são atribuídos. |

**Arquivo do token:** o diretório é `join(tokenDir, uuid)`, bits `0o700` / `0o600`, depois `chmod`. Se `tokenDir` é `""` (o fallback do `ipcMain` quando o renderer omite o campo), o diretório nasce no diretório de trabalho do processo. **Verificado.** `docs/INSTALL.md` fala em `$XDG_RUNTIME_DIR`. O código não lê essa variável. **Verificado:** os dois textos não batem.

**Ciclo de vida:** `kill` manda `SIGTERM`, espera 500 ms, depois `SIGKILL`, e apaga o diretório do token. `window-all-closed` e `before-quit` chamam isso. O item Quit da bandeja faz `webContents.send("zb:quit")`. O handler de quit é `ipcMain.on`, que não roda para um send *para* o renderer. **Verificado:** `src/tray.ts`. O renderer não escuta esse canal. **Lacuna:** o item da bandeja não para o sidecar.

`before-quit` é uma função `async`. **Suposição:** o Electron não espera essa promise, então o processo pode sair antes do `SIGTERM` terminar. Nenhum teste cobre isso.

**Queda:** `exit` marca `crashed` ou `stopped`. Nada reinicia o filho e nada carrega uma página de erro. **Verificado.**

**Escuta do bridge (main do bridge):** `origin/main` aceita `--listen unix:<caminho absoluto>` (`bridge/internal/server/unix_linux.go` está nesse main). Este shell sempre passa TCP. TCP em loopback continua sendo superfície local (qualquer usuário local conecta). O caminho de socket usaria `SO_PEERCRED` no bridge. Isso é lacuna do shell, não issue aberta do bridge: a #21 está fechada.

**Teste:** `tests/sidecar.test.ts` lança `process.execPath` como os dois binários, confere que a string do token tem pelo menos 32 caracteres e mata o filho. Não lê o argv, não faz `stat` do modo e não afirma que o token está ausente de um log. O nome do teste afirma essas checagens.

### Notificações

| | |
| --- | --- |
| Tampering | O renderer fornece `toolTitle`. **Verificado.** O processo main não lê o fluxo SSE do bridge. |
| Information disclosure | O corpo é `Permission requested: ${title}` depois de um filtro de caracteres. A saída do agente não é concatenada. **Verificado** o template. O filtro não chega a rodar. |

`onPermissionRequest` chama `sanitizeText(...)`. Esse nome não está no escopo; o método é `this.sanitizeText`. **Verificado:** erro TS2663 do `tsc`. Um loader que emite JS mesmo assim lança `ReferenceError` quando um evento de permissão chega, antes de `new Notification`. `tests/notifications.test.ts` refaz a expressão regular numa string local e não chama `onPermissionRequest`. O módulo falha ao importar sob `node --test` pelo mesmo motivo de export do Electron que os testes da bandeja.

O clique envia `reqId` e `sessionId` à página sem checagem de formato. **Verificado.**

O comportamento com a janela oculta está no fonte (`isVisible` e `isFocused`). Nenhum teste o aciona. O `test.skip` em `tests/e2e/app.spec.ts` diz que o caso de notificação precisa de um harness.

### Distribuição e cadeia de suprimentos

| | |
| --- | --- |
| Tampering | `npm ci` respeita `ignore-scripts=true` no `.npmrc`. **Verificado.** O `package.json` ainda tem um `postinstall` que chama `electron-builder`. Ele não roda a menos que alguém passe `--allow-scripts` (o comentário no `.npmrc` manda o desenvolvedor fazer isso). |
| Elevation | Não há `dependencies` de produção. `npm audit --omit=dev` em 2026-10-19 reportou 0 vulnerabilidades. O audit do lockfile (`npm audit --package-lock-only --audit-level=moderate`) reportou 8 issues moderate, todas via `electron-builder` → `sprintf-js` (GHSA-hp3w-g68c-fv3c). Negação de serviço em tempo de desenvolvimento num helper de log, não no bridge empacotado. |
| Spoofing | `publish` é `null`. Não há `electron-updater`. **Verificado.** Atualização é troca manual de arquivo (`docs/INSTALL.md`). |
| Repudiation | `scripts/checksums.mjs` calcula o hash da saída local em `dist/packages`. Não verifica assinatura. Não há configuração de notarização macOS nem de assinatura Windows. **Verificado** a ausência. Os alvos Linux no `package.json` são AppImage e deb. macOS e Windows não são alvos. A issue #26 diz que isso vira issues separadas; essas issues não existem (busca em 2026-10-19, nos dois repos). |

**Suposição:** um operador que baixa um AppImage de uma página sem assinatura não distingue esse arquivo de um build produzido por este repo, além de comparar um checksum que também veio do mesmo lugar.

## Casos de abuso (caminho mais curto)

1. O script da página chama `zb.launch` com um binário à escolha e um `workspaceRoot` à escolha. O main faz spawn. Sem checagem de remetente.
2. O script da página lê `tokenPath` no resultado do launch. O sandbox bloqueia `fs`, então a página ainda precisa de outro bug para ler o arquivo. O caminho continua na página não confiável. Se `tokenDir` estava vazio, o arquivo fica sob o diretório de trabalho.
3. O fetch das raízes devolve 401, `allowedRoots` continua vazio, e o operador (ou um script que consiga acionar o diálogo) pode escolher qualquer pasta. `zb:launch` também pode definir `--workspace-root` sem o seletor.
4. Qualquer navegação da janela antes de `currentUrl` existir não é cancelada por `will-navigate`. A janela hoje nunca chama `loadURL`, então o app não mostra a UI do bridge. Isso é um buraco funcional e significa que a guarda não foi testada.
5. Quit na bandeja não chama `SidecarController.kill`.
6. Um processo local escuta em `127.0.0.1:8765` antes do shell, ou fala com o bridge depois que ele sobe. O shell não trata "porta em uso" como estado e não exige `/health`.
7. Um symlink dentro de uma raiz permitida passa na checagem de prefixo.
8. Um instalador adulterado: os checksums nascem ao lado do artefato e nada confere uma chave.

## O que já está no lugar

| Controle | Evidência |
| --- | --- |
| Flags de isolamento na janela | webPreferences em `src/main.ts` |
| Popups negados | `setWindowOpenHandler` |
| Spawn sem shell; token fora do argv | array `args` em `src/sidecar.ts` |
| String de loopback em `--listen` | o mesmo arquivo |
| Trava de instância única | `app.requestSingleInstanceLock` em `src/main.ts` (sem teste) |
| Scripts de instalação desligados por padrão | `.npmrc` |
| Lockfile como fonte das dependências | `package-lock.json`; sem dependências de produção |
| Testes de unidade do helper de origem | `tests/origin.test.ts` |
| CSP da resposta do bridge, quando a janela mostra o bridge | `security.go` do bridge (não é este shell) |

## Lacunas a fechar neste shell

Ordem pelo que uma página hostil ou um processo local já pode tentar. Lacunas de empacotamento são reais e não são as cinco primeiras.

1. Tratar IPC como não confiável: checar o remetente, rejeitar formatos desconhecidos e parar de aceitar caminhos de binário vindos do renderer.
2. Parar de devolver `tokenPath`. Criar o diretório do token no diretório de runtime. Falhar fechado se o `chmod` falhar.
3. Usar porta efêmera ou escuta `unix:`. Montar `currentUrl` com a porta em que o filho realmente escutou. Sondar `/health`. Mapear falha de bind para os estados que o tipo já nomeia.
4. Falhar fechado nas raízes de workspace. Lê-las em `GET /v1/info` com o bearer. Comparar caminhos com checagem que entende symlink. Usar a mesma checagem em `--workspace-root`.
5. Definir um CSP do shell e um handler de permissão que nega. Cancelar navegação até a origem do sidecar existir, inclusive redirects. Aplicar fuses na hora do pacote.
6. Tirar o texto da notificação de um evento autenticado do bridge. Chamar o filtro. Limitar o tamanho. Fazer o Quit da bandeja chamar `kill`.
7. Aceitar uma pasta arrastada a partir do evento do sistema no processo main.
8. Entregar pacotes Linux e um e2e que abre, conversa, notifica e recolhe o filho. Assinar atualizações antes de existir auto-update.

Pacotes macOS e Windows, notarização e Authenticode ficam fora do trilho atual. Precisam de issues próprias quando houver máquina para rodá-los. Deep links continuam desligados.
