# Agents

English (canonical). Portuguese mirror: [AGENTS.pt_BR.md](AGENTS.pt_BR.md).

These rules apply to every coding agent that edits this repository. Human contributors follow [CONTRIBUTING.md](CONTRIBUTING.md). The desktop slice plan tracks [zero-bridge docs/plans/PLAN_ZERO_BRIDGE.md](https://github.com/FabioLeitao/zero-bridge/blob/main/docs/plans/PLAN_ZERO_BRIDGE.md).

## Roles

The agent edits the tree. The auditor reviews the commit. The operator decides scope, push, and visibility. Do not push, open a pull request, or change repository visibility unless the operator says so in the current conversation.

## Hard rules

- The bridge core stays in `zero-bridge/bridge/`. This repo only owns the Electron shell, lifecycle, tray, notifications, and folder picker.
- `contextIsolation` is on, `sandbox` is on, `nodeIntegration` is off.
- The sidecar (`zero-bridge`) binds loopback only. The shell never exposes a non-loopback port.
- No secrets in argv, logs, URL, query string, or renderer process.
- Electron preload exposes only an allowlist of IPC channels. No direct `require` in the renderer.
- `npm audit --package-lock-only` is a gate. Install scripts are blocked. `package-lock.json` is source of truth.
- Commits are signed. One commit is one thing. Do not amend, reset, or rebase unless requested.
- Merge with `git merge --merge`. Squash and rebase merges are refused.
- External tools are pinned by version. Nothing is installed globally for the gate.

## Validation

`npm test` is required before a commit. Before a pull request, also run `npm run lint` and `npm audit --package-lock-only`.

A clone does not install the hooks. Run `git config core.hooksPath .githooks` once.

## One commit

One commit is one change. It compiles, the tests that cover it pass, and it can be reverted by itself. Stage files by name.

## Slice flow

Work lands on a branch named `epic/sN-slug`. The pull request body names the issue with a closing keyword. The commit message does not. Merge with `git merge --merge`.
