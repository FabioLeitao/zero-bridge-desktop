# zero-bridge-desktop

Desktop shell for zero-bridge: Electron main process starts the Go bridge as a sidecar, loads the web UI, and owns tray, notifications and window state.

## S23a scope

- Scaffold TypeScript + Electron, lockfile, install scripts blocked, npm audit in CI.
- Main process launches the bridge with argv only (no shell), per-launch token in 0600 file.
- `contextIsolation`, `sandbox`, no `nodeIntegration`, minimal preload, strict CSP, navigation denied outside sidecar origin.

## Run (dev)

```bash
npm install
npm run build
npx electron src/main.ts
```

Production build via electron-builder (planned for S23c).

## Security

- No secrets in argv, logs, URL or renderer.
- Sidecar stopped on quit. PID recorded, killed by the main process.
- Ephemeral loopback port or Unix socket when S21 lands.

## Acceptance for S23a

- `npm test` unit tests for launcher and allowlist.
- Smoke test starts shell against fake agent, loads UI, quits cleanly.
- Grep sidecar command line and logs for token absence.
