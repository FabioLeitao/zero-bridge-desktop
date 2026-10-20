# Desktop threat model

**Português (Brasil):** [THREAT_MODEL.pt_BR.md](THREAT_MODEL.pt_BR.md)

Plan-phase review of the Electron shell. Code under review: `0dec4f3` (`origin/main` on 2026-10-19). This document does not change runtime behavior.

Related: [README](../README.md), [install](INSTALL.md) ([pt-BR](INSTALL.pt_BR.md)), [agent rules](../AGENTS.md) ([pt-BR](../AGENTS.pt_BR.md)).

The bridge core (HTTP, token check, Host/Origin, CSP on responses it writes) lives in `zero-bridge`. Facts taken from that checkout are marked **bridge main** and cite `FabioLeitao/zero-bridge` at `3a442f8`. They are not re-tested by this repository.

## Assets

- Per-launch bridge token and the `0600` file that holds it.
- The process that `spawn` starts (`--agent-cmd` runs next).
- Workspace paths the operator is willing to expose to the agent.
- The window that loads the bridge UI, and native notifications.
- The packaged Linux artifacts and the npm lockfile.

## Actors

- **Remote web content** is not a target. The shell must not listen off loopback.
- **Content inside the `BrowserWindow`** (the bridge UI, or any origin the window is allowed to load). A cross-site script bug in that UI can call `window.zb`.
- **Another local process or user** that can connect to a loopback TCP port or read a token file whose mode is wrong.
- **The operator** at the keyboard, including DevTools. That person is trusted with the machine. The shell still must not give the page a way to start an arbitrary executable.
- **Build and update inputs**: the lockfile, install scripts, and files the operator downloads by hand.

## How to read the labels

- **Verified:** a file in this repository (or the cited bridge file) shows the behavior. `tsc --noEmit --rootDir .` on this tree reports two errors, cited below. Tests that do not call the function are not evidence.
- **Assumption:** Electron or OS default, or a race the type definitions do not spell out. Not pinned by a test in this repo.

## Boundaries

```
renderer (bridge UI) --preload window.zb--> main process
main --spawn argv + token file + env--> zero-bridge sidecar --listen--> loopback
main --dialog / tray / Notification--> OS
main --fetch--> sidecar HTTP
npm lockfile / electron-builder --> packaged AppImage and deb
```

`src/types.ts` names four channels. The preload and `ipcMain` register more. There is no single allowlist that both sides share.

| Channel | Direction | Payload the code accepts | Sender check | Payload check |
| --- | --- | --- | --- | --- |
| `zb:launch` | renderer invoke | `any`; bins and `tokenDir` coerced with `String`, port with `Number` | none | path is not pinned to a known binary |
| `zb:state` | main to renderer | `{state, url}` | n/a | url is whatever `currentUrl` is |
| `zb:tray` | declared only | no handler | none | unused |
| `zb:quit` | renderer send | none | none | none |
| `zb:folder-drop` | renderer invoke | `string[]` as declared, not checked | none | `handleDrop` prefix test when roots are non-empty |
| `zb:fetch-workspace-roots` | renderer invoke | none | none | JSON from `GET /v1/capabilities` trusted if it parses |
| `zb:permission-request` | renderer send | `any` | none | `sanitizeText` is not reachable (see notifications) |
| `zb:pick-workspace` | renderer invoke | none | none | dialog result, then prefix test; empty roots skip the test |
| `zb:permission-focus` | main to renderer | `reqId`, `sessionId` | n/a | ids forwarded as received |

No test sends a channel from a second frame or asserts a rejection. `tests/origin.test.ts` covers `src/origin.ts` only.

## STRIDE

### Renderer and preload

| | |
| --- | --- |
| Spoofing | Any script in the window can call `window.zb`. `ipcMain` never compares `event.sender` to `mainWindow.webContents`. **Verified:** `src/preload.ts`, `src/main.ts`. |
| Tampering | `zb:launch` passes `bridgeBin`, `agentBin`, `port`, `tokenDir`, and `workspaceRoot` into `SidecarController.launch`. **Verified.** |
| Repudiation | No audit log of IPC. **Verified** (no logger in `src/`). |
| Information disclosure | `launch` returns `tokenPath` to the renderer. **Verified:** `src/main.ts` return value. The token string itself is not in that object. |
| Denial of service | `zb:quit` and a crash of the main process are local. **Verified** handler exists. |
| Elevation | `spawn(bridgeBin, args)` with `shell` left unset runs that file. A page that can call `launch` chooses the executable. **Verified:** `src/sidecar.ts`. |

**Abuse:** the loaded page calls `zb.launch({ bridgeBin, agentBin, tokenDir, workspaceRoot })` with paths it chooses. The main process is the part that was supposed to choose the binaries.

**Mitigation that exists:** `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` on the one `BrowserWindow` (`src/main.ts`). Electron 41 types say `sandbox` defaults to `true` since Electron 20, `nodeIntegration` defaults to `false`, `nodeIntegrationInWorker` defaults to `false`, `webSecurity` defaults to `true`. The window sets the three flags explicitly. `nodeIntegrationInSubFrames` is unset; the type file does not document a default in the property comment. **Assumption:** unset means off.

**Gap:** the preload re-introduces launch, quit, folder paths, and notification text. Sandbox does not constrain IPC. No rejection test.

### Navigation, CSP, permissions, fuses

| | |
| --- | --- |
| Spoofing | `will-navigate` compares origins only after `currentUrl` is set. While it is null, the handler returns and does not call `preventDefault`. **Verified.** |
| Tampering | `setWindowOpenHandler` always returns `{ action: "deny" }`. **Verified.** `webContents.loadURL` does not emit `will-navigate` (Electron 41 type comment). The app never calls `loadURL`. `scripts/smoke.mjs` does, and that script is not the app. |
| Information disclosure | `session.defaultSession.webRequest.onHeadersReceived` copies headers and sets nothing. **Verified.** It does not strip a CSP the bridge already set. |
| Elevation | No `setPermissionRequestHandler` and no `setPermissionCheckHandler`. **Verified** by absence. The Electron 41 type comments do not state the default grant or deny. **Assumption:** the decision is Electron's built-in default, not a rule in this repo. |
| Denial of service | A thrown error inside `will-navigate` (`new URL` on a bad string) is uncaught. **Verified** the call has no try/catch. Effect on the navigation is an **assumption**. |

There is no `will-redirect` handler, no `will-attach-webview`, and no `webRequest` block of non-loopback URLs.

**Bridge CSP (bridge main):** `bridge/internal/server/security.go` sets `default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` on responses that go through `writeSecurityHeaders`. That header applies only after the window is actually showing a bridge response. This shell does not add it.

**Fuses:** `src/electron.fuses.ts` is not imported. `package.json` `build` does not set `electronFuses`. `@electron/fuses` appears only as a transitive dependency of `electron-builder` in the lockfile. **Verified.** The object in that file is not the fuse API (`EnableRunAsNode` and the rest). **Gap:** packaging does not flip fuses. `RunAsNode`, inspect arguments, and `NODE_OPTIONS` are whatever Electron ships.

**Protocols and `file://`:** no `protocol.register*`, no `setAsDefaultProtocolClient`, no `open-url` handler. **Verified.** Issue #25 says `zero-bridge://` stays off until it has a use. `allowFileAccessFromFileUrls` in `electron.fuses.ts` is not applied. `navigateOnDragDrop` is unset; Electron 41 types default it to `false`. **Assumption:** a drop does not navigate. The drop path that does exist is IPC, below.

**DevTools:** nothing disables them. **Assumption:** the default accelerator still opens them for the local operator.

### Folder drop and the picker

| | |
| --- | --- |
| Tampering | `zb:folder-drop` trusts the renderer for the path list. The preload does not use `webUtils.getPathForFile`. **Verified.** |
| Elevation | `FolderPicker.pick` allows any directory when `allowedRoots` is empty. **Verified:** `src/folderPicker.ts`. `handleDrop` returns null in that case (drop is stricter than the dialog). |
| Spoofing | Roots are filled from `GET ${currentUrl}v1/capabilities` with no `Authorization` header. **Verified:** `src/main.ts`. |

**Bridge contract (bridge main):** `GET /v1/capabilities` returns agent modes, not `workspaceRoots` (`handleCapabilities`). `workspaceRoots` is on `GET /v1/info`. Neither path is public. `authorized` only skips the token for `/health`, `/`, `/app.js`, `/style.css`, auth status, and login. A fetch without a bearer gets 401, the `catch` in the shell stores nothing, and the picker then allows every directory.

**Path check:** `resolve` plus `startsWith(root + "/")` or exact equality. `resolve` does not follow symlinks. **Verified** (Node `path.resolve`). A symlink inside a root can point outside it. The prefix form rejects `/root-evil` when the root is `/root`. **Verified** by reading the condition. `tests/folderPicker.test.ts` repeats that string test inline and does not call `handleDrop` or `pick`. The file also fails to load under `node --test` because `electron` has no named export `dialog` outside the Electron process.

`pick(mainWindow, dialog)` passes a second argument the method does not declare. **Verified:** `tsc` error TS2554. At runtime an extra argument is ignored; the method uses its own `dialog` import. **Assumption** if the file is executed by a loader that skips `tsc`.

### Sidecar process

| | |
| --- | --- |
| Spoofing | The listen argument is `127.0.0.1:${port}`. **Verified.** No code path passes a non-loopback host. |
| Tampering | `spawn` gets an argv array. `shell: true` is absent. Token goes in `--token-file`, not in the argv strings. **Verified.** |
| Information disclosure | `sanitizeEnv` copies `process.env` and deletes only `ZERO_BRIDGE_TOKEN`. **Verified.** Other variables (`LD_PRELOAD`, API keys in the parent environment) are inherited. `chmod` errors are swallowed. **Verified.** |
| Denial of service | `Number(opts.port \|\| env \|\| "0") \|\| 8765` turns `0` into `8765`. **Verified.** The free-port helper in `SidecarController` does not run for launches that come from `ipcMain`. The URL uses that same `port`, not `handle.port`. |
| Elevation | `--workspace-root` is appended from the caller with no `FolderPicker` check. **Verified.** `--public-origin` is never passed. `unixSocket` is on the options type and never read. |
| Repudiation | stdout flips state to `running` on the first chunk. stderr is discarded. The health comment in `sidecar.ts` says a real check would probe `/health` and that the probe is not implemented. **Verified.** States `port-in-use`, `bad-token`, and `agent-not-found` exist on the type and are never assigned. |

**Token file:** directory is `join(tokenDir, uuid)`, mode bits `0o700` / `0o600`, then `chmod`. If `tokenDir` is `""` (the `ipcMain` fallback when the renderer omits it), the directory is created in the process working directory. **Verified.** Docs in `docs/INSTALL.md` say `$XDG_RUNTIME_DIR`. The code does not read that variable. **Verified** mismatch.

**Lifecycle:** `kill` sends `SIGTERM`, waits 500 ms, then `SIGKILL`, then deletes the token directory. `app` `window-all-closed` and `before-quit` call it. Tray "Quit" does `webContents.send("zb:quit")`. The quit handler is `ipcMain.on`, which does not run for a send *to* the renderer. **Verified:** `src/tray.ts`. The renderer never listens for that channel. **Gap:** the tray item does not stop the sidecar.

`before-quit` is an `async` function. **Assumption:** Electron does not wait for that promise, so the process can exit before `SIGTERM` finishes. Not covered by a test.

**Crash:** `exit` marks `crashed` or `stopped`. Nothing restarts the child and nothing loads an error page. **Verified.**

**Bridge listen (bridge main):** `origin/main` accepts `--listen unix:<absolute path>` (`bridge/internal/server/unix_linux.go` is on that main). This shell always passes TCP. Loopback TCP is still a local attack surface (any local user can connect). The socket path would use `SO_PEERCRED` in the bridge. That is a shell gap, not an open bridge issue: #21 is closed.

**Test:** `tests/sidecar.test.ts` launches `process.execPath` as both binaries, checks that the token string length is at least 32, and stops the child. It does not read argv, `stat` the mode, or assert the token is absent from a log. The test name claims those checks.

### Notifications

| | |
| --- | --- |
| Tampering | The renderer supplies `toolTitle`. **Verified.** The main process does not read the bridge SSE stream. |
| Information disclosure | Body is `Permission requested: ${title}` after a character strip. Agent output is not appended. **Verified** the template. The strip is not executed. |

`onPermissionRequest` calls `sanitizeText(...)`. That name is not in scope; the method is `this.sanitizeText`. **Verified:** `tsc` error TS2663. A loader that emits JS anyway throws `ReferenceError` when a permission event arrives, before `new Notification`. `tests/notifications.test.ts` reimplements the regular expression on a local string and does not call `onPermissionRequest`. The module fails to import under `node --test` for the same Electron export reason as the tray tests.

Click sends `reqId` and `sessionId` to the page with no format check. **Verified.**

Hidden-window behavior is in the source (`isVisible` and `isFocused`). No test drives it. `test.skip` in `tests/e2e/app.spec.ts` says the notification case needs a harness.

### Distribution and supply chain

| | |
| --- | --- |
| Tampering | `npm ci` respects `.npmrc` `ignore-scripts=true`. **Verified.** `package.json` still has a `postinstall` that calls `electron-builder`. It does not run unless someone passes `--allow-scripts` (the comment in `.npmrc` tells developers to do that). |
| Elevation | No production `dependencies`. `npm audit --omit=dev` on 2026-10-19 reported 0 vulnerabilities. The lockfile audit (`npm audit --package-lock-only --audit-level=moderate`) reported 8 moderate issues, all through `electron-builder` → `sprintf-js` (GHSA-hp3w-g68c-fv3c). Dev-time denial of service in a logging helper, not the packaged bridge. |
| Spoofing | `publish` is `null`. No `electron-updater`. **Verified.** Updates are a manual file replacement (`docs/INSTALL.md`). |
| Repudiation | `scripts/checksums.mjs` hashes the local `dist/packages` output. It does not verify a signature. No macOS notarization or Windows signing config. **Verified** absence. Linux targets in `package.json` are AppImage and deb. macOS and Windows are not targets. Issue #26 says those become separate issues; those issues do not exist (search on 2026-10-19, both repos). |

**Assumption:** an operator who downloads an AppImage from an unsigned page cannot tell it from a build this repo produced, beyond comparing a checksum they also received from the same place.

## Abuse cases (shortest path)

1. Page script calls `zb.launch` with a binary of its choice and a `workspaceRoot` of its choice. Main spawns it. No sender check.
2. Page script reads `tokenPath` from the launch result. Sandbox blocks `fs`, so the page still needs another bug to read the file. The path is still in the untrusted page. If `tokenDir` was empty, the file is under the working directory.
3. Roots fetch returns 401, `allowedRoots` stays empty, the operator (or a script that could drive the dialog) can pick any folder. `zb:launch` can also set `--workspace-root` without the picker.
4. Anything that navigates the window before `currentUrl` is set is not cancelled by `will-navigate`. The window currently never calls `loadURL`, so the bridge UI is not shown by the app. That is a functional hole and it means the guard is untested.
5. Tray Quit does not call `SidecarController.kill`.
6. A local process binds `127.0.0.1:8765` before the shell, or talks to the bridge once it is up. The shell does not treat "port in use" as a state and does not require `/health`.
7. A symlink inside an allowed root is accepted by the prefix check.
8. A tampered installer: checksums are generated next to the artifact and nothing checks a key.

## What is in place

| Control | Evidence |
| --- | --- |
| Isolation flags on the window | `src/main.ts` webPreferences |
| Popups denied | `setWindowOpenHandler` |
| Spawn without a shell; token not placed in argv | `src/sidecar.ts` `args` array |
| Loopback string in `--listen` | same file |
| Single-instance lock | `app.requestSingleInstanceLock` in `src/main.ts` (no test) |
| Install scripts off by default | `.npmrc` |
| Lockfile is the dependency source | `package-lock.json`; no prod dependencies |
| Origin helper unit tests | `tests/origin.test.ts` |
| Bridge response CSP, when the window shows the bridge | bridge `security.go` (not this shell) |

## Gaps to close in this shell

Ordered by what a hostile page or a local process can already try. Packaging gaps are real and are not the first five.

1. Treat IPC as untrusted: check the sender, reject unknown shapes, and stop taking binary paths from the renderer.
2. Stop returning `tokenPath`. Create the token directory in the runtime dir. Fail closed if `chmod` fails.
3. Use an ephemeral port or `unix:` listen. Build `currentUrl` from the port the child actually bound. Probe `/health`. Map bind failures to the states the type already names.
4. Fail closed on workspace roots. Read them from `GET /v1/info` with the bearer token. Compare paths with a symlink-aware check. Use the same check for `--workspace-root`.
5. Set a shell CSP and a permission handler that denies. Cancel navigation until the sidecar origin exists, including redirects. Apply fuses at package time.
6. Take notification text from an authenticated bridge event. Call the sanitizer. Cap the length. Make tray Quit call `kill`.
7. Accept a dropped folder from the OS event in the main process.
8. Ship Linux packages and an e2e that launches, chats, notifies, and reaps the child. Sign updates before any auto-update exists.

macOS and Windows packages, notarization, and Authenticode are out of scope for the current track. They need their own issues when a machine can run them. Deep links stay disabled.
