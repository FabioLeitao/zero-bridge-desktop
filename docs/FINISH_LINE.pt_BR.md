# Linha de chegada

**English:** [FINISH_LINE.md](FINISH_LINE.md)

Teste de saída da [FabioLeitao/zero-bridge#57](https://github.com/FabioLeitao/zero-bridge/issues/57). As linhas são verificações de produto. Elas não nomeiam um toolkit de UI. Nada nesta tabela está marcado como pronto. Uma linha continua aberta até um commit, um teste ou um documento provar o item inteiro. macOS e Windows seguem na [desktop #10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10) e só contam com teste naquele sistema operacional.

O contrato de porte, inclusive a tabela de IPC, está em [PORT_SPEC.pt_BR.md](PORT_SPEC.pt_BR.md) ([English](PORT_SPEC.md)). A [desktop #18](https://github.com/FabioLeitao/zero-bridge-desktop/issues/18) é o spike posterior. Ela não começa neste branch. Flags de pacote do Electron não são linha aqui.

Relacionado: [README.pt_BR.md](../README.pt_BR.md) ([English](../README.md)), [INSTALL.pt_BR.md](INSTALL.pt_BR.md) ([English](INSTALL.md)), [THREAT_MODEL.pt_BR.md](THREAT_MODEL.pt_BR.md) ([English](THREAT_MODEL.md)), [AUTO_UPDATE.pt_BR.md](AUTO_UPDATE.pt_BR.md) ([English](AUTO_UPDATE.md)).

O ícone é a [desktop #12](https://github.com/FabioLeitao/zero-bridge-desktop/issues/12). Não é linha da #57 e não foi implementado aqui.

## Útil

| item | evidência | lacuna |
| --- | --- | --- |
| Abrir o app, escolher uma pasta, conversar, ver a lista de sessões | `tests/e2e/app.spec.ts` carrega a UI da bridge, envia uma linha e espera um cartão de permissão. Não escolhe pasta e não confere a lista de sessões. A suíte é pulada quando falta `node_modules/electron/path.txt`. Não rodou neste branch. `cec4ffc` acrescenta `passEnv` para um agente real receber chave de provedor, proxy ou caminho de certificado. Isso não é este fluxo. | Não provado. [desktop #13](https://github.com/FabioLeitao/zero-bridge-desktop/issues/13) |
| Notificação nativa com a janela oculta | `tests/notifications.test.ts` usa uma fábrica injetada. `tests/e2e/app.spec.ts` oculta a janela e espera a string `write` num arquivo de log. Nenhum dos dois mostra uma notificação do sistema, e o e2e não rodou aqui. | Não provado. Já é a [desktop #8](https://github.com/FabioLeitao/zero-bridge-desktop/issues/8) |
| Sair do app para a bridge, sem processo órfão e sem socket velho | `2f7aa7a` e `tests/tray.test.ts` chamam o callback de sair. `src/sidecar.ts` apaga o diretório do token no kill. Nada confere se o pid do filho sumiu, e nada apaga um socket unix. [THREAT_MODEL.pt_BR.md](THREAT_MODEL.pt_BR.md) ainda diz que `before-quit` pode voltar antes do `kill`. | Não provado. [desktop #14](https://github.com/FabioLeitao/zero-bridge-desktop/issues/14) |
| Quem não é o autor instala e usa só com o README | [INSTALL.pt_BR.md](INSTALL.pt_BR.md) mostra comando de AppImage e de deb. [README.pt_BR.md](../README.pt_BR.md) é um checkout de desenvolvimento (`npm ci`, binários Go, `ZB_BRIDGE_BIN`). `.github/workflows/check.yml` roda `npm run check`, `build` e `test:e2e`. Não gera pacote. `npm run dist:dir` não rodou. | Não provado. [desktop #15](https://github.com/FabioLeitao/zero-bridge-desktop/issues/15). A [#26](https://github.com/FabioLeitao/zero-bridge/issues/26) da bridge está fechada e não é esta prova. |

## Portátil

| item | evidência | lacuna |
| --- | --- | --- |
| Pacotes Linux saem de um checkout limpo e rodam sem toolchain de desenvolvimento | Igual à linha de instalação. Não há artefato de pacote nem teste de que o AppImage sobe sem Node ou Go. | Não provado. [desktop #15](https://github.com/FabioLeitao/zero-bridge-desktop/issues/15) |
| Sem caminho de usuário fixo; estado, config e logs seguem XDG no Linux e a convenção da plataforma nos demais | O shell usa `app.getPath("userData")` para `shell-config.json`, `window-bounds.json` e `tokens` (`src/main.ts`, `src/tokenDir.ts`). Nenhum teste confere esse diretório. O shell não tem diretório de log padrão. O estado da bridge usa `XDG_STATE_HOME` (`bridge/cmd/zero-bridge/main.go`). | Não provado. A metade da bridge é a [#61](https://github.com/FabioLeitao/zero-bridge/issues/61). A metade do shell é a [desktop #16](https://github.com/FabioLeitao/zero-bridge-desktop/issues/16). macOS e Windows não são declarados ([desktop #10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10)). |
| Transporte local sem porta TCP onde o SO permite; named pipe do Windows continua recusa documentada | `c866000` e `tests/unixPage.test.ts` fazem login e leem `/` e `/v1/info` de uma bridge falsa escutando num socket unix. O token não vai no caminho. `tests/listen.test.ts` ainda confere o argumento `unix:` e o TCP em loopback. `ResolveListen` da bridge recusa `npipe:` (`bridge/internal/server/listen.go`). | Não provado como carga completa do host: o HTTP sobre o socket está testado, e a chamada que liga a página a esse socket não é executada pelo teste unitário. Named pipe segue na [#54](https://github.com/FabioLeitao/zero-bridge/issues/54). O modo do socket continua na [#21](https://github.com/FabioLeitao/zero-bridge/issues/21), fechada. |
| macOS e Windows | Sem workflow, sem pacote, sem teste nesses sistemas. | Não provado. [desktop #10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10) |

## Agnóstico

| item | evidência | lacuna |
| --- | --- | --- |
| Um segundo agente ACP, que não seja o Zero, funciona de ponta a ponta, e o resultado fica registrado | Nenhum teste do desktop sobe um agente que não seja o `acpfake`. | Não provado. [zero-bridge #38](https://github.com/FabioLeitao/zero-bridge/issues/38) |
| Comando, argumentos e perfil do agente vêm só da configuração. Nenhum nome exclusivo do Zero na camada de protocolo nem no texto do shell voltado ao usuário | A bridge aceita `--agent-cmd`, `--agent-arg` repetido e `--profile` (`bridge/cmd/zero-bridge/main_test.go`). O perfil padrão nesse arquivo é `zero`. O shell sempre acrescenta `--agent-arg` `acp` e nunca passa `--profile` (`src/sidecar.ts`). Os textos do menu dizem `zero-bridge`, que é o nome do produto. [INSTALL.md](INSTALL.md) diz ao leitor que o agente é `zero acp`. | Não provado no shell. [desktop #17](https://github.com/FabioLeitao/zero-bridge-desktop/issues/17). A fatia [#15](https://github.com/FabioLeitao/zero-bridge/issues/15) da bridge está fechada e não configura este shell. |
| O ingress compatível com OpenAI e o A2A não assumem qual agente está atrás da bridge | Nenhum código do desktop fala com esses ingressos. | Não provado aqui. O ingress OpenAI é a [zero-bridge #34](https://github.com/FabioLeitao/zero-bridge/issues/34). Os testes do ingress A2A são a [zero-bridge #50](https://github.com/FabioLeitao/zero-bridge/issues/50). |

## Compatível

Estas linhas estão na #57. As issues já existem na bridge. Este repositório não abre outra.

| item | evidência | lacuna |
| --- | --- | --- |
| O conjunto de métodos ACP que a bridge usa está documentado, com a versão do protocolo testada | `protocolVersion` 1 aparece no código da bridge (`bridge/internal/server/server.go`, `bridge/internal/acpclient`). Nenhum doc do desktop lista o conjunto de métodos. | Não provado. [zero-bridge #58](https://github.com/FabioLeitao/zero-bridge/issues/58) |
| Testes de contrato rodam contra o agente fake no CI e contra um agente real localmente | O CI do desktop constrói `cmd/acpfake` para o e2e. Não há execução registrada contra um agente real. | Não provado. [zero-bridge #59](https://github.com/FabioLeitao/zero-bridge/issues/59) |
| Bridge ou agente velho ou novo demais falha com mensagem clara, sem travar | Sem teste no desktop. | Não provado. [zero-bridge #60](https://github.com/FabioLeitao/zero-bridge/issues/60) |
