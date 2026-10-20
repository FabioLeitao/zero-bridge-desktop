# Especificação de porte do shell

**English:** [PORT_SPEC.md](PORT_SPEC.md)

Este é o contrato que um shell posterior precisa cumprir. A árvore deste branch é o host atual. A [desktop #18](https://github.com/FabioLeitao/zero-bridge-desktop/issues/18) é um spike depois que este MVP for mergeado. Este documento não inicia esse spike e não acrescenta um segundo toolkit.

As verificações de produto estão em [FINISH_LINE.pt_BR.md](FINISH_LINE.pt_BR.md) ([English](FINISH_LINE.md)). As regras de suprimento estão em [AUTO_UPDATE.pt_BR.md](AUTO_UPDATE.pt_BR.md) ([English](AUTO_UPDATE.md)). O modelo de ameaças está em [THREAT_MODEL.pt_BR.md](THREAT_MODEL.pt_BR.md) ([English](THREAT_MODEL.md)).

Os nomes abaixo são o comportamento. Um porte pode usar outros tipos, desde que os testes recusem os mesmos casos. Flags de fuse do Electron não fazem parte deste contrato.

## IPC

O host é o processo que sobe a bridge. A página é o documento da UI. Um único helper confere o remetente e o payload em toda chamada de entrada. Uma chamada só é aceita quando tudo isto vale:

- O remetente é a janela do host, e o frame é o frame dessa janela. Os dois ids são inteiros maiores que zero e batem com o registro que o host tem da janela.
- A origem do frame é a origem do sidecar. Essa origem é `http://127.0.0.1:<porta>/` em TCP, ou `zb://bridge/` quando o listen é um socket unix absoluto. Origem nula é recusada. Qualquer outra origem é recusada.
- O canal está na tabela. Canal desconhecido é recusado.
- O payload bate com a linha. Um registro de recusa guarda o canal, um motivo fixo e uma contagem. Não guarda o payload, um caminho nem um token.

| canal | direção | payload |
| --- | --- | --- |
| `zb:launch` | página para o host | Ausente, ou um objeto vazio. Chaves proibidas: `bridgeBin`, `agentBin`, `tokenDir`, `port`, `token`, `tokenPath`, `unixSocket`, `workspaceRoot`. Qualquer outra chave é recusada. O host resolve os binários da própria config ou do próprio ambiente. |
| `zb:quit` | página para o host | Sem payload. |
| `zb:folder-drop` | página para o host | De uma a oito strings. Cada string vai de 1 a 4096 caracteres e não contém NUL. O caminho vem da API de queda do sistema operacional. A página não pode fornecer um caminho arbitrário. |
| `zb:fetch-workspace-roots` | página para o host | Sem payload. O host devolve raízes que ele já buscou com o bearer. O token não vai para a página. |
| `zb:permission-request` | página para o host | Exatamente `toolTitle`, `sessionId` e `reqId`. Cada um vai de 1 a 200 caracteres e não contém NUL. |
| `zb:pick-workspace` | página para o host | Sem payload. |
| `zb:state` | host para a página | Não é chamada de entrada. |
| `zb:tray` | só o host | Chamada de entrada é recusada. O host é dono da bandeja. |
| `zb:permission-focus` | host para a página | Não é chamada de entrada. |

Oráculo atual: `src/ipcGuard.ts`, `tests/ipcGuard.test.ts`, `tests/ipcOrigin.test.ts`.

## Aceite que o porte ainda precisa cumprir

Uma linha é comportamento exigido. O commit e o teste são a prova atual, não uma exigência de toolkit. Uma linha marcada como não provada continua aberta. `Closes` não é usado aqui.

| tema | comportamento exigido | prova atual | em aberto |
| --- | --- | --- | --- |
| IPC | A tabela acima, inclusive remetente ruim e payload ruim em cada canal de entrada | `40ee2a1`, `9ac5adc`, `21a8d8e`, `04f931e`, `fa1f406`; `tests/ipcGuard.test.ts`, `tests/ipcOrigin.test.ts` | Um script que já roda no frame do host continua sendo esse remetente |
| Token | O resultado para a página não tem token nem caminho de token. O arquivo do token é `0600` num diretório `0700` nos dados do host. Falha de modo aborta o lançamento. Argv e logs não contêm o token | `2f15118`; `tests/token.test.ts` | |
| Sidecar | A porta `0` fica efêmera e não vira `8765`. `GET /health` não leva token. As falhas `port-in-use`, `bad-token` e `agent-not-found` mostram uma página de erro escapada, sem token. O ambiente do filho é uma allowlist mais os nomes de `passEnv`. `ZB_FAKE_*` fica desligado quando o app está empacotado. O listen TCP continua em loopback. Um listen `unix:` absoluto faz login e carrega a UI por esse socket, sem proxy TCP | `93056c9`, `7722495`, `c02f4f9`, `2fc9e3b`, `c866000`, `cec4ffc`, `8d40f4d`; `tests/sidecarHealth.test.ts`, `tests/childEnv.test.ts`, `tests/listen.test.ts`, `tests/unixPage.test.ts` | A ligação do host que serve `zb://bridge/` não é executada pelo teste unitário |
| Política da página | CSP é `default-src 'self'` mais `base-uri`, `form-action`, `frame-ancestors` e `object-src` em `none`. A página não concede permissão a si mesma. Navegação e redirecionamento são negados até existir a origem do sidecar, e negados quando a origem de destino difere. `window.open` é negado | `278de5d`, `fa1f406`, `9ac5adc`; `tests/shellPolicy.test.ts` | Flags de fuse do Electron num pacote gerado não são esta linha. Ficam na [desktop #6](https://github.com/FabioLeitao/zero-bridge-desktop/issues/6) e não são estendidas neste branch |
| Pasta | As raízes vêm de `GET /v1/info` com bearer guardado pelo host. Lista vazia ou falha não abre o diálogo de pasta. `realpath` recusa symlink para fora, caminho fora e `..`, e aceita caminho dentro. `--workspace-root` usa essa checagem. Pasta largada usa a mesma checagem | `b06c125`, `21a8d8e`, `d430374`, `d21d6ee`; `tests/folderPicker.test.ts`, `tests/workspaceLaunch.test.ts`, `tests/dropPaths.test.ts` | |
| Bandeja e janela | Sair para o sidecar e depois encerra o app. O texto da notificação é o título da ferramenta, limitado, sem marcação. Janela oculta notifica; janela em foco não. Um segundo lançamento foca o primeiro. Os limites da janela fazem ida e volta. Iniciar com o login fica desligado salvo opt-in do operador, sem privilégio extra. `zero-bridge://` continua sem registro | `2f7aa7a`, `38eac54`; `tests/tray.test.ts`, `tests/notifications.test.ts`, `tests/shellLife.test.ts`, `tests/loginItem.test.ts` | Nenhum teste mostra que o pid do filho sumiu ou que o caminho de um socket unix foi removido. [Desktop #14](https://github.com/FabioLeitao/zero-bridge-desktop/issues/14) |
| Config e logs | O host lê os caminhos da bridge e do agente de uma config local ou do próprio ambiente, nunca do IPC da página. Um binário da config é arquivo comum, do usuário, sem escrita de grupo ou de outros. Os logs omitem o token, o conteúdo do arquivo de token, `Authorization` e valores de cookie. Config ruim mostra uma página de erro e não deixa o processo sem janela. Os textos da bandeja e da notificação existem em inglês e em português do Brasil. O idioma segue o locale do SO e o padrão é inglês | `51ded90`, `e38572b`, `e675eba`, `059bfc7`, `2d6793c`; `tests/shellConfig.test.ts`, `tests/redactLog.test.ts`, `tests/shellLocale.test.ts` | |
| Suprimento | Não limpar a exceção de auditoria com upgrade forçado. Qualquer aviso fora da exceção registrada falha o gate. Auto-update verifica uma assinatura antes de substituir. Até lá, a instalação manda trocar o pacote à mão e não há canal | `18a7adf`, `ded6f60`; `docs/AUTO_UPDATE.md` | A verificação da assinatura não existe. [Desktop #9](https://github.com/FabioLeitao/zero-bridge-desktop/issues/9) |
| macOS e Windows | Não declarados. Um teste naquele sistema operacional é exigido antes de declarar qualquer um | nenhum | [Desktop #10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10) |

Refs #18
