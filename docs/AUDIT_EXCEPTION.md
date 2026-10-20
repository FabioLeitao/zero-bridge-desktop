# Lockfile audit exception

**Português (Brasil):** [AUDIT_EXCEPTION.pt_BR.md](AUDIT_EXCEPTION.pt_BR.md)

`npm run audit` runs [scripts/audit-exception.mjs](../scripts/audit-exception.mjs). It calls `npm audit --package-lock-only --json` and fails on every advisory except the one below.

Recorded: 2026-10-19. Review by: **2027-01-19**.

## GHSA-hp3w-g68c-fv3c

| | |
| --- | --- |
| Package | `sprintf-js` |
| Locked version | `1.1.3` (`package-lock.json`) |
| Advisory range | `*` (every version, including 1.1.3) |
| Severity | moderate |
| Effect | denial of service via unbounded precision specifiers |
| Chain | `sprintf-js` → `roarr` → `global-agent` → `@electron/get` → `app-builder-lib` → `electron-builder` |
| Where it runs | devDependency only. `npm audit --omit=dev` reports no production vulnerabilities. The packaged app does not ship this chain as a runtime dependency of the shell. |

`npm audit fix --force` would install `electron-builder@26.5.0`. That is a downgrade out of `26.6.0 - 27.0.0-alpha.2`, not a forward patch. There is no fixed `sprintf-js` release outside the advisory range, because the range is every version. This repo does not take that downgrade.

Remove this exception when a review shows the advisory is gone, or when a non-breaking `electron-builder` no longer pulls the chain in. A new advisory id fails the gate immediately.

Related: [install](INSTALL.md) ([pt-BR](INSTALL.pt_BR.md)).
