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

export function refusedEnvName(name: string): boolean {
  const upper = name.toUpperCase();
  if (upper.startsWith("LD_") || upper.startsWith("DYLD_")) return true;
  if (upper === "NODE_OPTIONS" || upper === "ELECTRON_RUN_AS_NODE") return true;
  return upper.includes("TOKEN");
}

export function childEnv(
  parent: NodeJS.ProcessEnv,
  opts?: { passEnv?: readonly string[] },
): NodeJS.ProcessEnv {
  const extra = new Set<string>();
  for (const name of opts?.passEnv ?? []) {
    if (refusedEnvName(name)) throw new Error("passEnv name refused");
    extra.add(name.toUpperCase());
  }
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(parent)) {
    if (typeof value !== "string") continue;
    if (refusedEnvName(key)) continue;
    if (ALLOWED.has(key.toUpperCase()) || extra.has(key.toUpperCase()) || key.startsWith("ZB_FAKE_")) {
      out[key] = value;
    }
  }
  return out;
}
