# Desktop threat model

**Português (Brasil):** [THREAT_MODEL.pt_BR.md](THREAT_MODEL.pt_BR.md)

Current shell behavior on branch `epic/finish-secure-test-2026-10-19` (reviewed 2026-10-19). The plan-phase text described `origin/main` at `0dec4f3`. This file replaces that picture.

Related: [README](../README.md), [install](INSTALL.md), [audit exception](AUDIT_EXCEPTION.md).

The bridge core stays in `zero-bridge` (`3a442f8` when this was checked). Facts from that tree are marked **bridge**.

## Assets

- The per-launch token and its `0600` file under `userData/tokens`.
- The process spawned as `--agent-cmd`.
- Workspace paths the operator exposes to the agent.
- The window that loads the bridge UI, and native notifications.
- The lockfile and the Linux packages.

## Actors

- Content in the `BrowserWindow`. A script bug in the bridge UI can call `window.zb`. That frame is the sender the shell accepts.
- Another local user who can connect to loopback TCP or read a token file with a loose mode.
- The operator at the keyboard, including DevTools.
- The lockfile, install scripts, and files the operator downloads by hand.

The shell does not listen off loopback.

## Boundaries

```
renderer (bridge UI) --preload window.zb--> main process
main --spawn argv + token file--> zero-bridge --listen 127.0.0.1:port
main --POST /v1/login--> cookie zb_session, then loadURL
main --dialog / tray / Notification--> OS
```

`src/types.ts` `IPC_CHANNELS` is the allowlist. `src/ipcGuard.ts` rejects a sender whose `webContents` id or frame routing id is not the main window, and rejects a payload that is not the shape of that channel. `zb:launch` may carry only an optional `workspaceRoot`. Binaries come from `ZB_BRIDGE_BIN` / `ZB_AGENT_BIN` (`src/bins.ts`). Tests: `tests/ipcGuard.test.ts`.

A hostile script that already runs in the main frame passes the sender check. The payload rules are the limit.

A rejected call is counted in the main process as `ipc rejected channel=<name> reason=<code> count=<n>` (`src/ipcLog.ts`). The line has no payload and no path. **Verified:** `tests/ipcLog.test.ts`. The default sink is `console.error`.

## STRIDE

### Renderer and preload

| | |
| --- | --- |
| Spoofing | Sender must match the main frame. **Verified:** `acceptIncoming`. |
| Tampering | Launch payload cannot name a binary, port, or token path. **Verified:** `tests/ipcGuard.test.ts`. |
| Information disclosure | `rendererLaunchView` drops `token` and `tokenPath`. **Verified:** `tests/token.test.ts`. |
| Elevation | `spawn` uses the allowlisted binaries. The page does not choose the file. **Verified:** `src/bins.ts`. |

`contextIsolation`, `sandbox`, and `nodeIntegration: false` are set on the window. Dropped files are read with `webUtils.getPathForFile` in the preload, not from a path the page invents.

### Navigation, CSP, permissions, fuses

| | |
| --- | --- |
| Spoofing | `navigationDecision` denies every URL while `currentUrl` is null, and later allows only the sidecar origin. `will-navigate` and `will-redirect` both use it. **Verified:** `tests/shellPolicy.test.ts`. |
| Tampering | `window.open` is denied. **Verified.** |
| Elevation | Permission request and permission check handlers deny. **Verified.** |
| Information disclosure | `withShellCsp` sets `default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`. **Verified.** |

`loadURL` does not emit `will-navigate`. The shell calls it for the sidecar origin after login, and for a `data:` error page. The error page HTML is escaped (`src/errorPage.ts`).

Packaging sets the seven Electron fuses in `package.json` `build.electronFuses`, mirrored by `src/electron.fuses.ts`. A test compares the two. Fuses apply to the packaged app, not to `npx electron` during development.

No protocol handler is registered. `zero-bridge://` stays off.

### Workspace

Roots come from `GET /v1/info` with a bearer token (`src/workspaceRoots.ts`). An empty list does not open the folder dialog. `pathAllowed` uses `realpath`, so a symlink that leaves the root is rejected. **Verified:** `tests/folderPicker.test.ts`. The first launch has no roots yet, so a `workspaceRoot` from the page is rejected until a later launch.

### Sidecar and token

| | |
| --- | --- |
| Spoofing | Default `--listen` is `127.0.0.1:<port>`. Port `0` asks the OS and does not become `8765`. An absolute `unix:` path is opt-in; a relative path or a non-loopback host is refused. **Verified:** `tests/sidecarHealth.test.ts`, `tests/listen.test.ts`. |
| Tampering | `spawn` gets an argv array. The token is `--token-file`, not an argv value. **Verified:** `tests/token.test.ts` reads the recorded argv. |
| Information disclosure | Login is `POST /v1/login` on `127.0.0.1` only. The cookie is stored by the main process. **Verified:** `tests/sessionLogin.test.ts`. The unit test does not open Electron. |
| Denial of service | `/health` is polled with no token. Stdout is not a health signal. stderr is classified as `port-in-use`, `bad-token`, `agent-not-found`, or `crashed`, and the window shows that state. **Verified.** |
| Elevation | `chmod` `0700` then `0600`. A failure removes the directory and throws. **Verified.** Default directory is `userData/tokens` (`src/tokenDir.ts`). |

The child environment is an allowlist (`src/childEnv.ts`, `tests/childEnv.test.ts`). Stored log lines drop the token, `Authorization`, and `zb_session` (`src/redactLog.ts`). Classification still reads raw stderr in memory. Tray Quit calls `controller.kill` and then `app.quit` (`tests/tray.test.ts`). Start at login is off unless `shell-config.json` sets `openAtLogin` (`tests/loginItem.test.ts`). `before-quit` is async; Electron may exit before that promise finishes. **Assumption.** A unix socket has no TCP listener. The window loads `zb://bridge/` and the main process forwards that origin to the socket. It does not open a TCP proxy.

### Notifications

The preload reads `section.perm` text and sends `zb:permission-request`. Main strips `<>&"'` and newlines and caps the title at 80 characters. A focused window does not show a notification. **Verified:** `tests/notifications.test.ts`. The title still originates in the page DOM, so a compromised UI can request a notification whose text is only constrained by that strip.

### Supply chain

No production dependencies. `npm audit --omit=dev` is clean. The lockfile has one accepted advisory, `GHSA-hp3w-g68c-fv3c` (`sprintf-js@1.1.3`, via `electron-builder`), recorded in [AUDIT_EXCEPTION.md](AUDIT_EXCEPTION.md) with review date 2027-01-19. `npm run audit` fails on any other id. Install scripts stay off unless the operator passes `--allow-scripts`. There is no auto-update. What would have to exist first is in [AUTO_UPDATE.md](AUTO_UPDATE.md). Linux targets are AppImage and deb. macOS and Windows are listed as later work, not built here.

## Coverage (2026-10-20)

`node --test --experimental-test-coverage --import tsx/esm tests/*.test.ts` (97 tests). Plan baseline: `origin.ts` 100% lines, `sidecar.ts` about 97% lines and 63% branches. `main`, `preload`, `renderer`, `folderPicker`, `notifications`, `tray`, and fuses were not in that report.

| module | line | branch | functions |
| --- | ---: | ---: | ---: |
| loaded files | 96.93% | 88.03% | 88.54% |
| `ipcGuard.ts` | 97.93% | 82.22% | 100% |
| `bins.ts` | 100% | 100% | 100% |
| `shellPolicy.ts` | 100% | 86.67% | 100% |
| `workspaceRoots.ts` | 100% | 75.00% | 100% |
| `sidecar.ts` | 95.44% | 92.96% | 88.89% |
| `folderPicker.ts` | 87.01% | 90.91% | 80.00% |
| `notifications.ts` | 97.98% | 82.35% | 90.91% |
| `tray.ts` | 87.38% | 88.89% | 41.18% |
| `childEnv.ts` | 100% | 85.71% | 100% |
| `listenAddress.ts` | 100% | 92.31% | 100% |
| `shellConfig.ts` | 97.62% | 81.25% | 100% |
| `redactLog.ts` | 100% | 100% | 100% |
| `shellLocale.ts` | 100% | 100% | 100% |

`src/main.ts`, `src/preload.ts`, and `src/renderer.ts` are Electron or DOM glue and are not loaded. `npm audit --omit=dev` on 2026-10-20 reported 0 vulnerabilities. `npm run audit` exited 0 and printed the sprintf-js exception (review 2027-01-19).

Manual mutants (one inverted condition, then `git checkout --` the file) all failed a test after `fa1f406`. No mutant was committed.

## Issues on this branch

| issue | commits | left open inside the issue |
| --- | --- | --- |
| #3 IPC | `40ee2a1`, `9ac5adc`, `21a8d8e`, `04f931e`, `fa1f406` | a script in the main frame is still that sender |
| #4 token | `2f15118` | |
| #5 sidecar | `93056c9`, `7722495`, `c02f4f9`, `2fc9e3b` | |
| #6 shell | `278de5d`, `fa1f406` | fuses not checked on a built package |
| #7 workspace | `b06c125`, `21a8d8e`, `d430374`, `d21d6ee` | |
| #8 tray | `2f7aa7a`, `38eac54` | |
| #9 supply | `18a7adf`, `ded6f60` | signed auto-update is a design note only |
| #10 macOS/Windows | none | the whole issue; Linux only |
| #11 ops | `51ded90`, `e38572b`, `e675eba` | |

## Still open

1. A script in the main frame is a trusted sender. Payload rules and the sanitizer bound it; they do not remove that trust.
2. Fuse values are locked in source. They were not applied to a packaged binary here.
3. Signed auto-update is described in `docs/AUTO_UPDATE.md` and is not implemented. No macOS or Windows package.
4. The unix page is forwarded by the main process. Electron's `protocol.handle` itself is not covered by the unit test.
5. The sidecar is not restarted after a crash.
6. `before-quit` may not wait for `kill`.
