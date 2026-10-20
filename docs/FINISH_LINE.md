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
| Someone who is not the author can install and use it from the README alone | [INSTALL.md](INSTALL.md) shows an AppImage and a deb command. [README.md](../README.md) is a dev checkout (`npm ci`, Go binaries, `ZB_BRIDGE_BIN`). `.github/workflows/check.yml` runs `npm run check`, `build`, and `test:e2e`. It does not build a package. `npm run dist:dir` was not run. | Not proven. [desktop #15](https://github.com/FabioLeitao/zero-bridge-desktop/issues/15). Bridge [#26](https://github.com/FabioLeitao/zero-bridge/issues/26) is closed and is not this proof. |

## Portable

| item | evidence | gap |
| --- | --- | --- |
| Linux packages build from a clean checkout and run without a dev toolchain | Same as the install row. No package artifact and no test that the AppImage starts without Node or Go. | Not proven. [desktop #15](https://github.com/FabioLeitao/zero-bridge-desktop/issues/15) |
| No hard-coded user path; state, config, and logs follow XDG on Linux and the platform convention elsewhere | The shell uses `app.getPath("userData")` for `shell-config.json`, `window-bounds.json`, and `tokens` (`src/main.ts`, `src/tokenDir.ts`). No test asserts that directory. The shell has no default log directory. Bridge state uses `XDG_STATE_HOME` (`bridge/cmd/zero-bridge/main.go`). | Not proven. Bridge half is [#61](https://github.com/FabioLeitao/zero-bridge/issues/61). Shell half is [desktop #16](https://github.com/FabioLeitao/zero-bridge-desktop/issues/16). macOS and Windows are not claimed ([desktop #10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10)). |
| Local transport without a TCP port where the OS allows it; Windows named pipe stays a documented refusal | `c866000` and `tests/unixPage.test.ts` log in and read `/` and `/v1/info` from a fake bridge listening on a unix socket. The token is not in the path. `tests/listen.test.ts` still checks the `unix:` argument and loopback TCP. Bridge `ResolveListen` refuses `npipe:` (`bridge/internal/server/listen.go`). | Not proven as a full host load: the HTTP over the socket is tested, and the call that binds the page to that socket is not executed by the unit test. Named pipe stays [#54](https://github.com/FabioLeitao/zero-bridge/issues/54). Bridge socket mode stays in closed [#21](https://github.com/FabioLeitao/zero-bridge/issues/21). |
| macOS and Windows | No workflow, no package, no test on those systems. | Not proven. [desktop #10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10) |

## Agnostic

| item | evidence | gap |
| --- | --- | --- |
| A second, non-Zero ACP agent works end to end, and the result is written down | No desktop test launches an agent other than `acpfake`. | Not proven. [zero-bridge #38](https://github.com/FabioLeitao/zero-bridge/issues/38) |
| Agent command, arguments, and profile come from configuration only. No Zero-only name in the protocol layer or in shell text aimed at the user | The bridge accepts `--agent-cmd`, repeated `--agent-arg`, and `--profile` (`bridge/cmd/zero-bridge/main_test.go`). The default profile in that file is `zero`. The shell always appends `--agent-arg` `acp` and never passes `--profile` (`src/sidecar.ts`). Shell menu strings say `zero-bridge`, which is the product name. [INSTALL.md](INSTALL.md) tells the reader the agent is `zero acp`. | Not proven for the shell. [desktop #17](https://github.com/FabioLeitao/zero-bridge-desktop/issues/17). Bridge slice [#15](https://github.com/FabioLeitao/zero-bridge/issues/15) is closed and does not configure this shell. |
| OpenAI-compatible ingress and A2A ingress do not assume which agent is behind the bridge | No desktop code speaks those ingresses. | Not proven here. OpenAI ingress is [zero-bridge #34](https://github.com/FabioLeitao/zero-bridge/issues/34). A2A ingress tests are [zero-bridge #50](https://github.com/FabioLeitao/zero-bridge/issues/50). |

## Compatible

These rows are in #57. Issues already exist on the bridge. This repo does not add another.

| item | evidence | gap |
| --- | --- | --- |
| ACP methods the bridge uses are documented, with the protocol version that was tested | `protocolVersion` 1 appears in bridge code (`bridge/internal/server/server.go`, `bridge/internal/acpclient`). No desktop doc lists the method set. | Not proven. [zero-bridge #58](https://github.com/FabioLeitao/zero-bridge/issues/58) |
| Contract tests run against the fake agent in CI and against a real agent locally | Desktop CI builds `cmd/acpfake` for e2e. No recorded run against a real agent. | Not proven. [zero-bridge #59](https://github.com/FabioLeitao/zero-bridge/issues/59) |
| A bridge or agent that is too old or too new fails with a clear message, not a hang | No desktop test. | Not proven. [zero-bridge #60](https://github.com/FabioLeitao/zero-bridge/issues/60) |
