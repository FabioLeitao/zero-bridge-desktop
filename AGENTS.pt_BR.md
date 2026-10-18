# Agentes

Inglês canônico. Espelho em português: [AGENTS.md](AGENTS.md).

Estas regras aplicam-se a todo agente que edita este repositório. Contribuidores humanos seguem [CONTRIBUTING.md](CONTRIBUTING.md). O plano de slices desktop segue [zero-bridge docs/plans/PLAN_ZERO_BRIDGE.md](https://github.com/FabioLeitao/zero-bridge/blob/main/docs/plans/PLAN_ZERO_BRIDGE.md).

## Papéis

O agente edita a árvore. O auditor revisa o commit. O operador decide escopo, push e visibilidade. Não faça push, abra pull request ou mude visibilidade sem ordem do operador.

## Regras duras

- O núcleo do bridge fica em `zero-bridge/bridge/`. Este repo só cuida do shell Electron, lifecycle, tray, notificações e folder picker.
- `contextIsolation` ligado, `sandbox` ligado, `nodeIntegration` desligado.
- O sidecar (`zero-bridge`) se liga em loopback apenas. O shell não expõe porta não-loopback.
- Nenhum segredo em argv, logs, URL, query string ou renderer.
- Preload expõe apenas allowlist de canais IPC. Nada de `require` direto no renderer.
- `npm audit --package-lock-only` é gate. Scripts de instalação bloqueados. `package-lock.json` é fonte da verdade.
- Commits assinados. Um commit é uma coisa. Não amende, resete ou rebasse sem pedido.
- Merge com `git merge --merge`. Squash e rebase são recusados.
- Ferramentas externas pinadas por versão. Nada instalado globalmente.

## Validação

`npm test` antes de commitar. Antes de pull request, rode também `npm run lint` e `npm audit --package-lock-only`.

Clones não instalam hooks. Rode `git config core.hooksPath .githooks` uma vez.

## Um commit

Um commit é uma mudança. Compila, testes cobrem, pode ser revertido sozinho. Stage por nome.

## Fluxo de slices

Trabalho vai para branch `epic/sN-slug`. O corpo do PR cita a issue com palavra de fechamento. A mensagem de commit não. Merge com `git merge --merge`.
