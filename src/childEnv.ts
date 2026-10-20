// The sidecar inherits a name allowlist. Secrets and loader overrides stay in the parent.
const ALLOWED = new Set([
  "PATH",
  "HOME",
  "USER",
  "LOGNAME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "LC_MESSAGES",
  "TZ",
  "TMPDIR",
  "TMP",
  "TEMP",
  "XDG_RUNTIME_DIR",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_CACHE_HOME",
  "SHELL",
  "SYSTEMROOT",
  "COMSPEC",
]);

export function childEnv(parent: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(parent)) {
    if (typeof value !== "string") continue;
    if (ALLOWED.has(key) || key.startsWith("ZB_FAKE_")) out[key] = value;
  }
  return out;
}
