# zero-bridge-desktop

Desktop shell for zero-bridge. The Electron main process starts the Go bridge as a loopback sidecar, loads that UI, and owns the tray, notifications, and window bounds.

**Português (Brasil):** [README.pt_BR.md](README.pt_BR.md)

## Linux package

This repository builds a Linux AppImage and a deb. It does not build a macOS or Windows package.

`npm run dist` writes `dist/packages/zero-bridge-0.1.0-alpha.AppImage`, `dist/packages/zero-bridge-desktop_0.1.0-alpha_amd64.deb`, `dist/packages/SHA256SUMS.txt`, and `dist/packages/sbom-YYYY-MM-DD.json`. Nothing publishes those files. There is no auto-update channel. Signed update stays a design note in [docs/AUTO_UPDATE.md](docs/AUTO_UPDATE.md).

A person who already has the files checks them and starts the shell:

```bash
sha256sum -c SHA256SUMS.txt
chmod +x zero-bridge-0.1.0-alpha.AppImage
./zero-bridge-0.1.0-alpha.AppImage
```

The deb installs with `sudo apt install ./zero-bridge-desktop_0.1.0-alpha_amd64.deb`. The control file version is `0.1.0~alpha`. Declared dependencies and the checksum steps are in [docs/INSTALL.md](docs/INSTALL.md).

The package contains the Go bridge and does not contain an agent. `npm run dist` builds `cmd/zero-bridge` from the commit in `bridge.sha` and ships it as `resources/bridge/zero-bridge`. A packaged app starts that binary unless `shell-config.json` sets `bridgeBin`. The agent stays `agentBin`. Without an agent path the window still opens and the sidecar does not start. One working Zero config is in [docs/INSTALL.md](docs/INSTALL.md). The start log line names the pin (`sidecar start bridge` and the commit).

A clean checkout produces the files. electron-builder downloads `fpm-1.17.0-ruby-3.4.3-linux-amd64.7z` and `appimage-12.0.1.7z` from `electron-userland/electron-builder-binaries` into its own cache. It does not install them globally.

```bash
npm ci --ignore-scripts=false
npm run build
npm run dist
```

`npm run check` does not build the package. `.github/workflows/check.yml` does not either.

`npm run verify:linux-package` extracts the AppImage, runs that binary under Xvfb, and reads the deb with `dpkg-deb` without installing it. `HOME` and `XDG_RUNTIME_DIR` are temporary directories. The packaged process ignores `ZB_E2E_*`. The script writes `shell-config.json` with `agentBin` only, builds `cmd/acpfake` from the pinned commit into a temp directory, and does not read `ZB_BRIDGE_SRC`. This command is not part of `npm run check`.

## Run (dev)

```bash
npm ci
npm run check
npm run build
```

That `npm ci` does not download the Electron binary. `.npmrc` sets `ignore-scripts=true`, and that setting overrides `allowScripts`. Download the binary only when you intend to open the window:

```bash
npm ci --ignore-scripts=false
```

On npm 11 and npm 12 that still runs one install script, `electron@41.10.6`, the only `true` entry in `allowScripts`. `esbuild` does not need its script: the optional `@esbuild/linux-x64` package already contains the binary. Node 22.23.3 ships npm 10.9.9, which has no allowlist, so the same command there also runs the other install scripts. CI installs npm 12.2.0 first.

The shell reads the binaries from `ZB_BRIDGE_BIN` and `ZB_AGENT_BIN`. `shell-config.json` may set `agentArgs` and `profile` for that launch. Each `agentArgs` item is one `--agent-arg`. A set `profile` is `--profile`. Omitting `agentArgs` passes `--agent-arg acp`. An empty list passes none. The same file may set `passEnv` to a list of environment names the sidecar may inherit, so a real agent still sees a provider key, `HTTPS_PROXY`, or `SSL_CERT_FILE`. Names are matched without case, so Windows `Path` matches `PATH`. A name is refused when it starts with `LD_` or `DYLD_`, or when it is `NODE_OPTIONS`, `ELECTRON_RUN_AS_NODE`, or contains `TOKEN`. The bridge copies the environment it receives to the agent and only strips `ZERO_BRIDGE_TOKEN`. The unpackaged harness may also set `ZB_E2E_BRIDGE_BIN` and `ZB_E2E_AGENT_BIN`. A packaged app ignores every `ZB_E2E_*` variable. The page cannot choose a binary. See [docs/INSTALL.md](docs/INSTALL.md).

## Security

- `contextIsolation`, `sandbox`, and `nodeIntegration: false`.
- Every IPC channel checks the sender frame and the payload. `zb:launch` does not accept a binary path.
- The launch token stays in the main process. The token file is `0600` under `$XDG_RUNTIME_DIR/zero-bridge` (`0700`), or under `<tmpdir>/zero-bridge-<uid>` when that variable is unset. A `chmod` failure aborts the launch. See [docs/INSTALL.md](docs/INSTALL.md).
- The sidecar port `0` stays ephemeral. Health is `GET /health` with no token. Failure states render an escaped error page.
- The shell sets a CSP, denies page permission prompts, and denies navigation until the sidecar origin exists.
- Tray Quit stops the sidecar. Notification text is stripped in the main process.

The lockfile audit exception for `sprintf-js` is [docs/AUDIT_EXCEPTION.md](docs/AUDIT_EXCEPTION.md). The threat model is [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md). The finish-line table is [docs/FINISH_LINE.md](docs/FINISH_LINE.md). The port contract is [docs/PORT_SPEC.md](docs/PORT_SPEC.md). Signed update, with no toolkit assumed, is [docs/AUTO_UPDATE.md](docs/AUTO_UPDATE.md).

## Tests

`npm test` runs the unit suite (131 tests on 2026-10-20). `npm run check` is lint, the audit exception gate, and that suite. `npm run verify:package` builds an unpacked Linux directory and compares its Electron fuse wire with `src/electron.fuses.ts`. It is not part of `npm run check`.

Coverage from `node --test --experimental-test-coverage --import tsx/esm tests/*.test.ts` on 2026-10-20. The plan-phase baseline had `origin.ts` at 100% lines and `sidecar.ts` at about 97% lines / 63% branches. `main`, `preload`, `renderer`, `folderPicker`, `notifications`, `tray`, and the fuses file were absent from that report.

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
| `origin.ts` | 100% | 86.96% | 83.33% |
| `electron.fuses.ts` | 100% | 100% | 100% |
| `childEnv.ts` | 100% | 85.71% | 100% |
| `listenAddress.ts` | 100% | 92.31% | 100% |

The line goal of 85% holds on those logic modules. `tray.ts` function coverage counts the injected Electron interfaces, which this process never calls.

Not loaded, because they import Electron or the DOM: `src/main.ts`, `src/preload.ts`, `src/renderer.ts`.

The e2e suite is `npm run test:e2e` after `npm ci --ignore-scripts=false`. Without the binary it skips. CI runs it in `.github/workflows/check.yml`.

## Issues

| issue | commits |
| --- | --- |
| [#3](https://github.com/FabioLeitao/zero-bridge-desktop/issues/3) IPC | `40ee2a1`, `9ac5adc`, `21a8d8e`, `04f931e`, `fa1f406` |
| [#4](https://github.com/FabioLeitao/zero-bridge-desktop/issues/4) token | `2f15118` |
| [#5](https://github.com/FabioLeitao/zero-bridge-desktop/issues/5) sidecar | `93056c9`, `7722495`, `c02f4f9`, `2fc9e3b` |
| [#6](https://github.com/FabioLeitao/zero-bridge-desktop/issues/6) shell | `278de5d`, `fa1f406`. `npm run verify:package` checks the Linux unpacked fuse wire and is not part of `npm run check` |
| [#7](https://github.com/FabioLeitao/zero-bridge-desktop/issues/7) workspace | `b06c125`, `21a8d8e`, `d430374`, `d21d6ee` |
| [#8](https://github.com/FabioLeitao/zero-bridge-desktop/issues/8) tray | `2f7aa7a`, `38eac54` |
| [#9](https://github.com/FabioLeitao/zero-bridge-desktop/issues/9) supply | `18a7adf`. Signed auto-update is a design note in [docs/AUTO_UPDATE.md](docs/AUTO_UPDATE.md) |
| [#10](https://github.com/FabioLeitao/zero-bridge-desktop/issues/10) macOS/Windows | no commit; Linux only |
| [#11](https://github.com/FabioLeitao/zero-bridge-desktop/issues/11) ops | `51ded90`, `e38572b`, `e675eba` |
