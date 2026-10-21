# zero-bridge-desktop — Install & Security

**Português (Brasil):** [INSTALL.pt_BR.md](INSTALL.pt_BR.md)

## Install (Linux)

The names below come from `package.json` `version` `0.1.0-alpha`. The deb control file records that version as `0.1.0~alpha`. Nothing in this repository publishes the files. There is no auto-update channel.

The package contains the Go bridge and does not contain an agent. `npm run dist` reads the one commit in `bridge.sha`, fetches that commit, checks `git rev-parse` against the pin, and builds `cmd/zero-bridge` with `go build -trimpath` and `GOFLAGS=-buildvcs=false`. The binary is `resources/bridge/zero-bridge` inside the AppImage and `/opt/zero-bridge/resources/bridge/zero-bridge` after the deb install. A packaged app uses that path unless `shell-config.json` sets `bridgeBin`. The start log line is `sidecar start bridge` followed by the pin. The SBOM lists that bridge and the Go module versions from the same commit. Without `agentBin` the window opens and the sidecar does not.

### AppImage (recommended, no install)

```bash
sha256sum -c SHA256SUMS.txt
chmod +x zero-bridge-0.1.0-alpha.AppImage
./zero-bridge-0.1.0-alpha.AppImage
```

On Ubuntu 24.04 or newer, the system restricts unprivileged user namespaces. The extracted AppImage has no AppArmor profile, so it does not open with the sandbox in that configuration. Prefer the deb: its `postinst` installs the AppArmor profile and, when user namespaces are unavailable, runs `chmod 4755` on `chrome-sandbox`. For the AppImage, the operator can allow namespaces with `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0`. That setting applies to the whole system and does not persist across reboot. The other option is to install an AppArmor profile of your own.

### Debian/Ubuntu (.deb)

`dpkg-deb -I` reports `Depends: libgtk-3-0, libnotify4, libnss3, libxss1, libxtst6, xdg-utils, libatspi2.0-0, libuuid1, libsecret-1-0` and `Recommends: libappindicator3-1`. The executable is `/opt/zero-bridge/zero-bridge-desktop`.

```bash
sha256sum -c SHA256SUMS.txt
sudo apt install ./zero-bridge-desktop_0.1.0-alpha_amd64.deb
zero-bridge-desktop
```

## How it works

The desktop app starts the **zero-bridge** Go binary as a sidecar. The default listen is an ephemeral loopback port. After `GET /health` succeeds, the shell logs in, stores the `zb_session` cookie, and loads `http://127.0.0.1:<port>/`. When `shell-config.json` sets an absolute `unixSocket`, the bridge does not listen on TCP. The shell logs in and loads the UI through that socket (`zb://bridge/`) and does not open a TCP proxy. The bridge still creates the socket at mode `0600`.

On Linux the shell passes `--exit-with-parent`. If that Electron process is killed, the bridge exits and removes the unix socket. A `bridgeBin` whose file does not contain the flag is refused before it starts. The window shows `bridge does not support --exit-with-parent`.

## shell-config.json

The file lives at `userData/shell-config.json`. The renderer cannot set these fields. A bad value aborts startup and the error page shows the cause, not the file body.

| Field | Shape | Launch |
| --- | --- | --- |
| `bridgeBin` | non-empty string, optional | absolute path that overrides the bundled bridge. Absent in a package uses `resources/bridge/zero-bridge` |
| `agentBin` | non-empty string | absolute path of the agent. The package does not include one |
| `agentArgs` | list of strings | each item is one `--agent-arg`. An item must be 1–256 characters and must not contain a newline or a NUL. Omitted means `--agent-arg acp`; an empty list means none |
| `profile` | string | 1–32 characters matching `[a-z0-9-]`, passed as `--profile` when set |
| `passEnv` | list of names | environment names the sidecar may inherit |
| `unixSocket` | absolute path | listen on that socket instead of TCP |
| `openAtLogin` | boolean | start at login |
| `locale` | `en` or `pt-BR` | shell language |

The bridge accepts the profile names `generic` and `zero`. Any other name that passes the shell pattern still fails when the sidecar starts.

The end-to-end suite builds `cmd/acpfake` as the agent. That binary is a test double, not a product path. A config that exercises it looks like this. The binary itself comes from `ZB_AGENT_BIN` or `agentBin`, not from this example:

```json
{
  "agentArgs": ["acp", "e2e-marker"],
  "profile": "generic"
}
```

This config runs Zero as the agent. `zero acp` is the Agent Client Protocol server, so `agentArgs` is `acp`. `profile` `zero` is the bridge profile for that agent. `agentBin` has to be a regular file you own, not a symlink, and not writable by the group or by others. If `zero` on `PATH` is a symlink, use the target file. Omitting `agentArgs` still passes `--agent-arg acp`.

```json
{
  "agentBin": "/usr/local/bin/zero",
  "agentArgs": ["acp"],
  "profile": "zero"
}
```

## Where the shell keeps files

On Linux, `app.getPath("userData")` is `$XDG_CONFIG_HOME/zero-bridge-desktop` when `XDG_CONFIG_HOME` is set, and `~/.config/zero-bridge-desktop` otherwise. `app.getPath("logs")` is that directory plus `logs`. macOS and Windows are not claimed until desktop #10 has a test on that OS.

| What | Where |
| --- | --- |
| `shell-config.json`, `window-bounds.json` | `app.getPath("userData")` |
| Page `localStorage` | the Chromium profile under that same user-data directory. The shell does not choose the path |
| `shell.log` | `app.getPath("logs")`. Stored lines go through `src/redactLog.ts` |
| Token directory and `bridge.sock` | `$XDG_RUNTIME_DIR/zero-bridge` at mode `0700` when that variable is an absolute path. Otherwise `<tmpdir>/zero-bridge-<uid>` at mode `0700` on POSIX. Windows keeps `<tmpdir>/zero-bridge` |

A missing user-data or logs path is refused. The shell does not build a home directory of its own. Before use, it `lstat`s the private directory and refuses a symlink, another owner, or a mode other than `0700`, without following the link. An absolute `unixSocket` in `shell-config.json` is the operator's path. The socket the shell would allocate is `bridge.sock` in the private directory above. The default listen remains the ephemeral loopback port.

## Token & Security

- A **per-launch token** is generated by the Electron main process and written to a `0600` file under the private directory above, in `<uuid>/` (`0700`). A failed `chmod` deletes that directory and aborts the launch. `ZB_E2E_TOKEN_FILE` overrides the directory in tests only.
- The token is passed to the bridge via `--token-file`. It is not placed in argv, logs, the URL, or the object returned to the renderer. The session cookie is set from the main process.
- The bridge enforces: loopback-only bind, Host/Origin validation, no CORS, strict CSP.
- Native notifications for permission requests show **only the tool title** (text-only, sanitized). Agent output is never shown in notifications.

## End-to-end tests

`npm test` does not launch Electron. The install scripts are blocked (`.npmrc` `ignore-scripts=true`), so a normal `npm ci` does not download the Electron binary. `ignore-scripts` overrides the `allowScripts` field.

To run the UI tests locally:

```bash
npm ci --ignore-scripts=false
npm run build
npm run test:e2e
```

Electron 44 no longer ships an install script. The root `postinstall` runs `node node_modules/electron/install.js` when scripts are enabled. `allowScripts` still permits only `electron@44.9.3`. The other packages with install scripts are `false` in `allowScripts`. Node 22.23.3 ships npm 10.9.9, which ignores that field and runs every install script. CI installs npm 12.2.0 and then uses this same command (`.github/workflows/check.yml` and `.github/workflows/package.yml`).

The suite builds `cmd/zero-bridge` and `cmd/acpfake` from the Go module. Set `ZB_BRIDGE_SRC` to that module directory, or check the bridge out at `./zero-bridge` or `../zero-bridge`.

## Update

Re-download the new AppImage/.deb and replace. No auto-update channel yet (planned for S23c follow-up).

## Reporting Security Issues

Email: `fabio.tleitao@gmail.com` (PGP key on GitHub profile)

Do **not** open a public issue for security vulnerabilities.