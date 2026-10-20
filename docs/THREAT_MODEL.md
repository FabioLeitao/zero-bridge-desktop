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
| Spoofing | `--listen` is `127.0.0.1:<port>`. Port `0` asks the OS and does not become `8765`. **Verified:** `tests/sidecarHealth.test.ts`. |
| Tampering | `spawn` gets an argv array. The token is `--token-file`, not an argv value. **Verified:** `tests/token.test.ts` reads the recorded argv. |
| Information disclosure | Login is `POST /v1/login` on `127.0.0.1` only. The cookie is stored by the main process. **Verified:** `tests/sessionLogin.test.ts`. The unit test does not open Electron. |
| Denial of service | `/health` is polled with no token. Stdout is not a health signal. stderr is classified as `port-in-use`, `bad-token`, `agent-not-found`, or `crashed`, and the window shows that state. **Verified.** |
| Elevation | `chmod` `0700` then `0600`. A failure removes the directory and throws. **Verified.** Default directory is `userData/tokens` (`src/tokenDir.ts`). |

`sanitizeEnv` still copies `process.env` and deletes only `ZERO_BRIDGE_TOKEN`. That inheritance is open (desktop issue on env allowlist). `unixSocket` is still unread. Tray Quit calls `controller.kill` and then `app.quit` (`tests/tray.test.ts`). `before-quit` is async; Electron may exit before that promise finishes. **Assumption.**

### Notifications

The preload reads `section.perm` text and sends `zb:permission-request`. Main strips `<>&"'` and newlines and caps the title at 80 characters. A focused window does not show a notification. **Verified:** `tests/notifications.test.ts`. The title still originates in the page DOM, so a compromised UI can request a notification whose text is only constrained by that strip.

### Supply chain

No production dependencies. `npm audit --omit=dev` is clean. The lockfile has one accepted advisory, `GHSA-hp3w-g68c-fv3c` (`sprintf-js@1.1.3`, via `electron-builder`), recorded in [AUDIT_EXCEPTION.md](AUDIT_EXCEPTION.md) with review date 2027-01-19. `npm run audit` fails on any other id. Install scripts stay off unless the operator passes `--allow-scripts`. There is no auto-update. Linux targets are AppImage and deb. macOS and Windows are listed as later work, not built here.

## Coverage (2026-10-19)

`node --test --experimental-test-coverage --import tsx/esm tests/*.test.ts`

| scope | line | branch | functions |
| --- | ---: | ---: | ---: |
| loaded files | 96.01% | 85.77% | 87.39% |
| `src/sidecar.ts` | 100% | 93.06% | 96.30% |

`src/main.ts` and `src/preload.ts` are outside that run because they import Electron. The e2e file loads the real UI, permission card, and hidden-window note log. On this machine the Electron binary is absent (`ignore-scripts`), so those three tests skip. CI (`.github/workflows/check.yml`) runs `npm ci --allow-scripts` and `npm run test:e2e`. That workflow has not been executed from this worktree.

## Still open

1. Child environment is inherited, aside from `ZERO_BRIDGE_TOKEN`.
2. Listen is TCP loopback, not the bridge Unix socket.
3. A script in the main frame is a trusted sender. Payload rules and the sanitizer bound it; they do not remove that trust.
4. No signed auto-update. No macOS or Windows package.
5. The sidecar is not restarted after a crash.
6. `before-quit` may not wait for `kill`.
