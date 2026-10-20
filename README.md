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

The shell reads the binaries from `ZB_BRIDGE_BIN` and `ZB_AGENT_BIN` (the e2e harness uses `ZB_E2E_BRIDGE_BIN` and `ZB_E2E_AGENT_BIN`). The page cannot choose them. See [docs/INSTALL.md](docs/INSTALL.md).

## Security

- `contextIsolation`, `sandbox`, and `nodeIntegration: false`.
- Every IPC channel checks the sender frame and the payload. `zb:launch` does not accept a binary path.
- The launch token stays in the main process. The token file is `0600` under `userData/tokens` (`0700`). A `chmod` failure aborts the launch.
- The sidecar port `0` stays ephemeral. Health is `GET /health` with no token. Failure states render an escaped error page.
- The shell sets a CSP, denies page permission prompts, and denies navigation until the sidecar origin exists.
- Tray Quit stops the sidecar. Notification text is stripped in the main process.

The lockfile audit exception for `sprintf-js` is [docs/AUDIT_EXCEPTION.md](docs/AUDIT_EXCEPTION.md). The threat model is [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Tests

`npm test` runs the unit suite (72 tests on 2026-10-19). `npm run check` is lint, the audit exception gate, and that suite.

Coverage from `node --test --experimental-test-coverage --import tsx/esm tests/*.test.ts` on 2026-10-19:

| scope | line | branch | functions |
| --- | ---: | ---: | ---: |
| all loaded files | 96.01% | 85.77% | 87.39% |
| `src/sidecar.ts` | 100% | 93.06% | 96.30% |

`src/main.ts` and `src/preload.ts` import Electron, so this run does not load them. The e2e suite is `npm run test:e2e` after `npm ci --allow-scripts`. Without the binary it skips. CI runs it in `.github/workflows/check.yml`.
