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

O shell lê os binários de `ZB_BRIDGE_BIN` e `ZB_AGENT_BIN`. `shell-config.json` pode definir `passEnv`, uma lista de nomes de ambiente que o sidecar pode herdar, para um agente real ainda ver a chave do provedor, `HTTPS_PROXY` ou `SSL_CERT_FILE`. A comparação ignora maiúsculas, então `Path` no Windows equivale a `PATH`. Um nome é recusado quando começa com `LD_` ou `DYLD_`, ou quando é `NODE_OPTIONS`, `ELECTRON_RUN_AS_NODE`, ou contém `TOKEN`. A bridge copia para o agente o ambiente que recebe e só remove `ZERO_BRIDGE_TOKEN`. O harness sem pacote também pode definir `ZB_E2E_BRIDGE_BIN` e `ZB_E2E_AGENT_BIN`. Um app empacotado ignora toda variável `ZB_E2E_*`. A página não escolhe o executável. Veja [docs/INSTALL.pt_BR.md](docs/INSTALL.pt_BR.md).

## Segurança

- `contextIsolation`, `sandbox` e `nodeIntegration: false`.
- Cada canal IPC confere o frame do remetente e o payload. `zb:launch` não aceita caminho de binário.
- O token de lançamento fica no processo principal. O arquivo é `0600` em `userData/tokens` (`0700`). Falha de `chmod` aborta o lançamento.
- A porta `0` continua efêmera. A saúde é `GET /health` sem token. Falha mostra uma página de erro com o texto escapado.
- O shell define CSP, nega permissão pedida pela página e nega navegação enquanto a origem do sidecar não existe.
- Sair pela bandeja encerra o sidecar. O texto da notificação é limpo no processo principal.

A exceção de auditoria do `sprintf-js` está em [docs/AUDIT_EXCEPTION.pt_BR.md](docs/AUDIT_EXCEPTION.pt_BR.md). O modelo de ameaças está em [docs/THREAT_MODEL.pt_BR.md](docs/THREAT_MODEL.pt_BR.md). A tabela da linha de chegada está em [docs/FINISH_LINE.pt_BR.md](docs/FINISH_LINE.pt_BR.md). O contrato de porte está em [docs/PORT_SPEC.pt_BR.md](docs/PORT_SPEC.pt_BR.md). A atualização assinada, sem toolkit assumido, está em [docs/AUTO_UPDATE.pt_BR.md](docs/AUTO_UPDATE.pt_BR.md).

## Testes

`npm test` roda a suíte unitária (97 testes em 2026-10-20). `npm run check` é lint, o gate da exceção de auditoria e essa suíte.

Cobertura de `node --test --experimental-test-coverage --import tsx/esm tests/*.test.ts` em 2026-10-20. Na linha de base do plano, `origin.ts` estava em 100% de linhas e `sidecar.ts` em cerca de 97% de linhas / 63% de ramos. `main`, `preload`, `renderer`, `folderPicker`, `notifications`, `tray` e o arquivo de fuses estavam fora daquele relatório.

| módulo | linha | ramo | funções |
| --- | ---: | ---: | ---: |
| arquivos carregados | 96,93% | 88,03% | 88,54% |
| `ipcGuard.ts` | 97,93% | 82,22% | 100% |
| `bins.ts` | 100% | 100% | 100% |
| `shellPolicy.ts` | 100% | 86,67% | 100% |
| `workspaceRoots.ts` | 100% | 75,00% | 100% |
| `sidecar.ts` | 95,44% | 92,96% | 88,89% |
| `folderPicker.ts` | 87,01% | 90,91% | 80,00% |
| `notifications.ts` | 97,98% | 82,35% | 90,91% |
| `tray.ts` | 87,38% | 88,89% | 41,18% |
| `origin.ts` | 100% | 86,96% | 83,33% |
| `electron.fuses.ts` | 100% | 100% | 100% |
| `childEnv.ts` | 100% | 85,71% | 100% |
| `listenAddress.ts` | 100% | 92,31% | 100% |

A meta de 85% de linhas vale nesses módulos de lógica. A cobertura de funções de `tray.ts` conta as interfaces injetadas do Electron, que este processo não chama.

Não carregados, porque importam Electron ou o DOM: `src/main.ts`, `src/preload.ts`, `src/renderer.ts`. `npm run dist:dir` não rodou: `node_modules/electron` não tem binário (`ignore-scripts`), e o empacotamento baixaria esse binário.

O e2e é `npm run test:e2e` depois de `npm ci --allow-scripts`. Sem o binário, os três testes ficam pulados. O CI roda a suíte em `.github/workflows/check.yml`.

## Issues

| issue | commits |
| --- | --- |
| [#3](https://github.com/FabioLeitao/zero-bridge-desktop/issues/3) IPC | `40ee2a1`, `9ac5adc`, `21a8d8e`, `04f931e`, `fa1f406` |
| [#4](https://github.com/FabioLeitao/zero-bridge-desktop/issues/4) token | `2f15118` |
| [#5](https://github.com/FabioLeitao/zero-bridge-desktop/issues/5) sidecar | `93056c9`, `7722495`, `c02f4f9`, `2fc9e3b` |
| [#6](https://github.com/FabioLeitao/zero-bridge-desktop/issues/6) shell | `278de5d`, `fa1f406`. Os fuses estão travados no `package.json`; o diretório empacotado não foi gerado aqui |
| [#7](https://github.com/FabioLeitao/zero-bridge-desktop/issues/7) pasta | `b06c125`, `21a8d8e`, `d430374`, `d21d6ee` |
| [#8](https://github.com/FabioLeitao/zero-bridge-desktop/issues/8) bandeja | `2f7aa7a`, `38eac54` |
| [#9](https://github.com/FabioLeitao/zero-bridge-desktop/issues/9) suprimento | `18a7adf`. Auto-update assinado é uma nota de desenho em [docs/AUTO_UPDATE.pt_BR.md](docs/AUTO_UPDATE.pt_BR.md) |
| [#10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10) macOS/Windows | sem commit; só Linux |
| [#11](https://github.com/FabioLeitao/zero-bridge-desktop/issues/11) operação | `51ded90`, `e38572b`, `e675eba` |
