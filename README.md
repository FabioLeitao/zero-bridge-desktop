# zero-bridge-desktop

Desktop shell for zero-bridge. The Electron main process starts the Go bridge as a loopback sidecar, loads that UI, and owns the tray, notifications, and window bounds.

**Português (Brasil):** [README.pt_BR.md](README.pt_BR.md)

## Run (dev)

```bash
npm ci
npm run check
npm run build
```

The Electron binary is not downloaded by that `npm ci`. `.npmrc` sets `ignore-scripts=true`. Install it only when you intend to open the window:

```bash
npm ci --allow-scripts
```

The shell reads the binaries from `ZB_BRIDGE_BIN` and `ZB_AGENT_BIN`. The unpackaged harness may also set `ZB_E2E_BRIDGE_BIN` and `ZB_E2E_AGENT_BIN`. A packaged app ignores every `ZB_E2E_*` variable. The page cannot choose a binary. See [docs/INSTALL.md](docs/INSTALL.md).

## Security

- `contextIsolation`, `sandbox`, and `nodeIntegration: false`.
- Every IPC channel checks the sender frame and the payload. `zb:launch` does not accept a binary path.
- The launch token stays in the main process. The token file is `0600` under `userData/tokens` (`0700`). A `chmod` failure aborts the launch.
- The sidecar port `0` stays ephemeral. Health is `GET /health` with no token. Failure states render an escaped error page.
- The shell sets a CSP, denies page permission prompts, and denies navigation until the sidecar origin exists.
- Tray Quit stops the sidecar. Notification text is stripped in the main process.

The lockfile audit exception for `sprintf-js` is [docs/AUDIT_EXCEPTION.md](docs/AUDIT_EXCEPTION.md). The threat model is [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Tests

`npm test` runs the unit suite (81 tests on 2026-10-20). `npm run check` is lint, the audit exception gate, and that suite.

Coverage from `node --test --experimental-test-coverage --import tsx/esm tests/*.test.ts` on 2026-10-20. The plan-phase baseline had `origin.ts` at 100% lines and `sidecar.ts` at about 97% lines / 63% branches. `main`, `preload`, `renderer`, `folderPicker`, `notifications`, `tray`, and the fuses file were absent from that report.

| module | line | branch | functions |
| --- | ---: | ---: | ---: |
| loaded files | 97.22% | 87.42% | 88.81% |
| `ipcGuard.ts` | 97.93% | 81.40% | 100% |
| `bins.ts` | 100% | 100% | 100% |
| `shellPolicy.ts` | 93.48% | 85.71% | 83.33% |
| `workspaceRoots.ts` | 100% | 75.00% | 100% |
| `sidecar.ts` | 100% | 93.06% | 96.30% |
| `folderPicker.ts` | 87.01% | 90.91% | 80.00% |
| `notifications.ts` | 96.77% | 82.35% | 100% |
| `tray.ts` | 87.23% | 88.89% | 43.75% |
| `origin.ts` | 100% | 86.96% | 83.33% |
| `electron.fuses.ts` | 100% | 100% | 100% |

The line goal of 85% holds on those logic modules. `tray.ts` function coverage counts the injected Electron interfaces, which this process never calls.

Not loaded, because they import Electron or the DOM: `src/main.ts`, `src/preload.ts`, `src/renderer.ts`. `npm run dist:dir` was not run: `node_modules/electron` has no binary (`ignore-scripts`), and packaging would download it.

The e2e suite is `npm run test:e2e` after `npm ci --allow-scripts`. Without the binary it skips. CI runs it in `.github/workflows/check.yml`.

## Issues

| issue | commits |
| --- | --- |
| [#3](https://github.com/FabioLeitao/zero-bridge-desktop/issues/3) IPC | `40ee2a1`, `9ac5adc`, `21a8d8e`, `04f931e`, `fa1f406` |
| [#4](https://github.com/FabioLeitao/zero-bridge-desktop/issues/4) token | `2f15118` |
| [#5](https://github.com/FabioLeitao/zero-bridge-desktop/issues/5) sidecar | `93056c9`, `7722495`. Env allowlist and `unix:` listen are still open |
| [#6](https://github.com/FabioLeitao/zero-bridge-desktop/issues/6) shell | `278de5d`, `fa1f406`. Fuse values are locked in `package.json`; a packaged directory was not built here |
| [#7](https://github.com/FabioLeitao/zero-bridge-desktop/issues/7) workspace | `b06c125`, `21a8d8e` |
| [#8](https://github.com/FabioLeitao/zero-bridge-desktop/issues/8) tray | `2f7aa7a`. Start-at-login stays unimplemented |
| [#9](https://github.com/FabioLeitao/zero-bridge-desktop/issues/9) supply | `18a7adf`. Signed auto-update does not exist |
| [#10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10) macOS/Windows | no commit; Linux only |
| [#11](https://github.com/FabioLeitao/zero-bridge-desktop/issues/11) ops | binaries no longer come from the renderer (`40ee2a1`, `fcf394e`). Config file, redacted logs, and locale strings are still open |
