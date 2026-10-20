# Shell port specification

**Português (Brasil):** [PORT_SPEC.pt_BR.md](PORT_SPEC.pt_BR.md)

This is the contract a later shell must meet. The tree on this branch is the current host. [Desktop #18](https://github.com/FabioLeitao/zero-bridge-desktop/issues/18) is a spike after this MVP is merged. This document does not start that spike and does not add a second toolkit.

The product checks live in [FINISH_LINE.md](FINISH_LINE.md) ([pt-BR](FINISH_LINE.pt_BR.md)). Supply rules live in [AUTO_UPDATE.md](AUTO_UPDATE.md) ([pt-BR](AUTO_UPDATE.pt_BR.md)). The threat model is [THREAT_MODEL.md](THREAT_MODEL.md) ([pt-BR](THREAT_MODEL.pt_BR.md)).

Names below are the behavior. A port may use other types as long as the tests still reject the same cases. Electron fuse flags are not part of this contract.

## IPC

The host is the process that spawns the bridge. The page is the UI document. One helper checks the sender and the payload on every incoming call. A call is accepted only when all of these hold:

- The sender is the host window, and the frame is that window's frame. Both ids are integers greater than zero and match the host's record of the window.
- The frame origin equals the sidecar origin. That origin is `http://127.0.0.1:<port>/` on TCP, or `zb://bridge/` when the listen is an absolute unix socket. A null origin is rejected. Any other origin is rejected.
- The channel is in the table. Unknown channels are rejected.
- The payload matches the row. A rejection record stores the channel, a fixed reason, and a count. It does not store the payload, a path, or a token.

| channel | direction | payload |
| --- | --- | --- |
| `zb:launch` | page to host | Absent, or an empty object. Forbidden keys: `bridgeBin`, `agentBin`, `tokenDir`, `port`, `token`, `tokenPath`, `unixSocket`, `workspaceRoot`. Any other key is rejected. The host resolves binaries from its own config or environment. |
| `zb:quit` | page to host | No payload. |
| `zb:folder-drop` | page to host | One to eight strings. Each string is 1 to 4096 characters and has no NUL. The path comes from the operating system's drop API. The page cannot supply an arbitrary path. |
| `zb:fetch-workspace-roots` | page to host | No payload. The host returns roots it already fetched with the bearer token. The token is not sent to the page. |
| `zb:permission-request` | page to host | Exactly `toolTitle`, `sessionId`, and `reqId`. Each is 1 to 200 characters and has no NUL. |
| `zb:pick-workspace` | page to host | No payload. |
| `zb:state` | host to page | Not an incoming call. |
| `zb:tray` | host only | An incoming call is rejected. The host owns the tray. |
| `zb:permission-focus` | host to page | Not an incoming call. |

Current oracle: `src/ipcGuard.ts`, `tests/ipcGuard.test.ts`, `tests/ipcOrigin.test.ts`.

## Acceptance the port must still meet

A row is required behavior. The commit and the test are the current proof, not a toolkit requirement. A row marked not proven is still open. `Closes` is not used here.

| topic | required behavior | current proof | open |
| --- | --- | --- | --- |
| IPC | The table above, including a bad sender and a bad payload on every incoming channel | `40ee2a1`, `9ac5adc`, `21a8d8e`, `04f931e`, `fa1f406`; `tests/ipcGuard.test.ts`, `tests/ipcOrigin.test.ts` | A script that already runs in the host frame is still that sender |
| Token | The page result has no token and no token path. The token file is `0600` under a `0700` directory in the host's data dir. A mode failure aborts the launch. Argv and logs do not contain the token | `2f15118`; `tests/token.test.ts` | |
| Sidecar | Port `0` stays ephemeral and is not rewritten to `8765`. `GET /health` has no token. Failures `port-in-use`, `bad-token`, and `agent-not-found` show an escaped error page with no token. The child environment is an allowlist plus `passEnv` names. `ZB_FAKE_*` is off when the app is packaged. TCP listen stays loopback. An absolute `unix:` listen logs in and loads the UI over that socket, with no TCP proxy | `93056c9`, `7722495`, `c02f4f9`, `2fc9e3b`, `c866000`, `cec4ffc`, `8d40f4d`; `tests/sidecarHealth.test.ts`, `tests/childEnv.test.ts`, `tests/listen.test.ts`, `tests/unixPage.test.ts` | The host binding that serves `zb://bridge/` is not executed by the unit test |
| Page policy | CSP is `default-src 'self'` plus `base-uri`, `form-action`, `frame-ancestors`, and `object-src` of `none`. The page cannot grant itself a permission. Navigation and redirects are denied until the sidecar origin exists, and denied when the target origin differs. `window.open` is denied | `278de5d`, `fa1f406`, `9ac5adc`; `tests/shellPolicy.test.ts` | Electron fuse flags on a built package are not this row. They stay [desktop #6](https://github.com/FabioLeitao/zero-bridge-desktop/issues/6) and are not extended on this branch |
| Workspace | Roots come from `GET /v1/info` with a bearer token held by the host. An empty or failed list does not open the folder dialog. `realpath` refuses a symlink out, a path outside, and `..`, and accepts a path inside. `--workspace-root` uses that check. A dropped folder uses the same check | `b06c125`, `21a8d8e`, `d430374`, `d21d6ee`; `tests/folderPicker.test.ts`, `tests/workspaceLaunch.test.ts`, `tests/dropPaths.test.ts` | |
| Tray and window | Quit stops the sidecar, then quits. Notification text is the sanitized tool title, capped, with markup stripped. A hidden window notifies; a focused window does not. A second launch focuses the first. Window bounds round-trip. Start at login stays off unless the operator opts in, with no extra privilege. `zero-bridge://` stays unregistered | `2f7aa7a`, `38eac54`; `tests/tray.test.ts`, `tests/notifications.test.ts`, `tests/shellLife.test.ts`, `tests/loginItem.test.ts` | No test shows the child pid is gone or that a unix socket path is removed. [Desktop #14](https://github.com/FabioLeitao/zero-bridge-desktop/issues/14) |
| Config and logs | The host reads bridge and agent paths from a local config or from its own environment, never from page IPC. A config binary is a regular file owned by the user, without group or other write. Logs omit the token, token-file contents, `Authorization`, and cookie values. A bad config shows an error page and does not leave the process without a window. Tray and notification strings exist in English and Brazilian Portuguese. The language follows the OS locale and defaults to English | `51ded90`, `e38572b`, `e675eba`, `059bfc7`, `2d6793c`; `tests/shellConfig.test.ts`, `tests/redactLog.test.ts`, `tests/shellLocale.test.ts` | |
| Supply | Do not clear the audit exception by force-upgrading. Any advisory outside the recorded exception fails the audit gate. Auto-update verifies a signature before replace. Until then, install docs say to replace the package by hand and there is no channel | `18a7adf`, `ded6f60`; `docs/AUTO_UPDATE.md` | The signature check does not exist. [Desktop #9](https://github.com/FabioLeitao/zero-bridge-desktop/issues/9) |
| macOS and Windows | Not claimed. A test on that operating system is required before either is claimed | none | [Desktop #10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10) |

Refs #18
