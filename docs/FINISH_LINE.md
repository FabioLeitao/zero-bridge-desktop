# Finish line

**Português (Brasil):** [FINISH_LINE.pt_BR.md](FINISH_LINE.pt_BR.md)

Exit check for [FabioLeitao/zero-bridge#57](https://github.com/FabioLeitao/zero-bridge/issues/57). The rows are product checks. They do not name a UI toolkit. Nothing in this table is marked ready. A row stays open until a commit, a test, or a doc proves the whole bullet. macOS and Windows stay on [desktop #10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10) and count only after a test on that operating system.

The port contract, including the IPC table, is [PORT_SPEC.md](PORT_SPEC.md) ([pt-BR](PORT_SPEC.pt_BR.md)). [Desktop #18](https://github.com/FabioLeitao/zero-bridge-desktop/issues/18) is the later spike. It does not start on this branch. Electron package flags are not a row here.

Related: [README.md](../README.md) ([pt-BR](../README.pt_BR.md)), [INSTALL.md](INSTALL.md) ([pt-BR](INSTALL.pt_BR.md)), [THREAT_MODEL.md](THREAT_MODEL.md) ([pt-BR](THREAT_MODEL.pt_BR.md)), [AUTO_UPDATE.md](AUTO_UPDATE.md) ([pt-BR](AUTO_UPDATE.pt_BR.md)).

The icon work is [desktop #12](https://github.com/FabioLeitao/zero-bridge-desktop/issues/12). It is not a row of #57 and it is not implemented here.

## Useful

| item | evidence | gap |
| --- | --- | --- |
| Open the app, pick a folder, chat, see the session list | `tests/e2e/app.spec.ts` loads the bridge UI, sends one line, and expects a permission card. It does not pick a folder and it does not assert a session list. The suite skips when `node_modules/electron/path.txt` is missing. It was not run on this branch. `cec4ffc` adds `passEnv` so a real agent can receive a provider key, proxy, or certificate path. That is not this flow. | Not proven. [desktop #13](https://github.com/FabioLeitao/zero-bridge-desktop/issues/13) |
| Native notification while the window is hidden | `tests/notifications.test.ts` uses an injected notification factory. `tests/e2e/app.spec.ts` hides the window and expects the string `write` in a log file. Neither shows an operating-system notification, and the e2e was not run here. | Not proven. Already [desktop #8](https://github.com/FabioLeitao/zero-bridge-desktop/issues/8) |
| Quitting stops the bridge, with no orphan process and no stale socket | `2f7aa7a` and `tests/tray.test.ts` call the quit callback. `src/sidecar.ts` removes the token directory on kill. Nothing asserts the child pid is gone, and nothing removes a unix socket. [THREAT_MODEL.md](THREAT_MODEL.md) still says `before-quit` may return before `kill` finishes. | Not proven. [desktop #14](https://github.com/FabioLeitao/zero-bridge-desktop/issues/14) |
| Someone who is not the author can install and use it from the README alone | `npm run dist` in a clean worktree wrote the AppImage, the deb, `SHA256SUMS.txt`, and a CycloneDX SBOM. `npm run verify:linux-package` opened the `zero-bridge` window and a sidecar from `shell-config.json`. [README.md](../README.md) and [INSTALL.md](INSTALL.md) say how to check the checksum and start the shell. | No release hosts the files. The package does not contain the Go bridge. `.github/workflows/check.yml` does not run `dist`. [desktop #15](https://github.com/FabioLeitao/zero-bridge-desktop/issues/15). |

## Portable

| item | evidence | gap |
| --- | --- | --- |
| Linux packages build from a clean checkout and run without a dev toolchain | Same command. electron-builder downloaded fpm and the AppImage tool into its cache. The extracted `zero-bridge-desktop` binary opened under Xvfb without Node. | The Go bridge is still a separate binary. macOS and Windows are not built. [desktop #15](https://github.com/FabioLeitao/zero-bridge-desktop/issues/15). |
| No hard-coded user path; state, config, and logs follow XDG on Linux and the platform convention elsewhere | `src/paths.ts` puts `shell-config.json` and `window-bounds.json` under the injected user-data path and `shell.log` under the injected logs path. The token directory and `bridge.sock` are `$XDG_RUNTIME_DIR/zero-bridge` at mode `0700`, or `<tmpdir>/zero-bridge-<uid>` when that variable is absent. A symlink, another owner, or a mode other than `0700` is refused. A missing user-data path throws and does not build a home path (`tests/paths.test.ts`). Stored lines go through `src/redactLog.ts`. On Linux, Electron's userData is `$XDG_CONFIG_HOME/zero-bridge-desktop` or `~/.config/zero-bridge-desktop`. | Shell directories are tested. Bridge state remains [#61](https://github.com/FabioLeitao/zero-bridge/issues/61). macOS and Windows are not claimed ([desktop #10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10)). |
| Local transport without a TCP port where the OS allows it; Windows named pipe stays a documented refusal | `c866000` and `tests/unixPage.test.ts` log in and read `/` and `/v1/info` from a fake bridge listening on a unix socket. The token is not in the path. `tests/listen.test.ts` still checks the `unix:` argument and loopback TCP. Bridge `ResolveListen` refuses `npipe:` (`bridge/internal/server/listen.go`). | Not proven as a full host load: the HTTP over the socket is tested, and the call that binds the page to that socket is not executed by the unit test. Named pipe stays [#54](https://github.com/FabioLeitao/zero-bridge/issues/54). Bridge socket mode stays in closed [#21](https://github.com/FabioLeitao/zero-bridge/issues/21). |
| macOS and Windows | No workflow, no package, no test on those systems. | Not proven. [desktop #10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10) |

## Agnostic

| item | evidence | gap |
| --- | --- | --- |
| A second, non-Zero ACP agent works end to end, and the result is written down | No desktop test launches an agent other than `acpfake`. | Not proven. [zero-bridge #38](https://github.com/FabioLeitao/zero-bridge/issues/38) |
| Agent command, arguments, and profile come from configuration only. No Zero-only name in the protocol layer or in shell text aimed at the user | `shell-config.json` sets `agentArgs` and `profile` (`src/shellConfig.ts`). The sidecar passes one `--agent-arg` per item and `--profile` when set, and it passes `--agent-arg acp` when `agentArgs` is absent (`src/sidecar.ts`). An empty list passes none. Shell menu and error strings say `zero-bridge`, the product name. [INSTALL.md](INSTALL.md) documents the fields and uses the `acpfake` test double as the example. | Proven for the shell. [desktop #17](https://github.com/FabioLeitao/zero-bridge-desktop/issues/17). |
| OpenAI-compatible ingress and A2A ingress do not assume which agent is behind the bridge | No desktop code speaks those ingresses. | Not proven here. OpenAI ingress is [zero-bridge #34](https://github.com/FabioLeitao/zero-bridge/issues/34). A2A ingress tests are [zero-bridge #50](https://github.com/FabioLeitao/zero-bridge/issues/50). |

## Compatible

These rows are in #57. Issues already exist on the bridge. This repo does not add another.

| item | evidence | gap |
| --- | --- | --- |
| ACP methods the bridge uses are documented, with the protocol version that was tested | `protocolVersion` 1 appears in bridge code (`bridge/internal/server/server.go`, `bridge/internal/acpclient`). No desktop doc lists the method set. | Not proven. [zero-bridge #58](https://github.com/FabioLeitao/zero-bridge/issues/58) |
| Contract tests run against the fake agent in CI and against a real agent locally | Desktop CI builds `cmd/acpfake` for e2e. No recorded run against a real agent. | Not proven. [zero-bridge #59](https://github.com/FabioLeitao/zero-bridge/issues/59) |
| A bridge or agent that is too old or too new fails with a clear message, not a hang | No desktop test. | Not proven. [zero-bridge #60](https://github.com/FabioLeitao/zero-bridge/issues/60) |
