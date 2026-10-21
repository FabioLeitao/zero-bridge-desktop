// Binaries the main process may spawn. The renderer never supplies these paths.
import { accessSync, constants, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { testHooks } from "./testEnv.js";
import type { ShellConfig } from "./shellConfig.js";

export interface AllowedBins {
  bridgeBin: string;
  agentBin: string;
}

export function bundledBridgePath(resourcesPath: string): string {
  return join(resourcesPath, "bridge", "zero-bridge");
}

type BinKind = "config" | "env" | "hook" | "bundled";

export function resolveAllowedBins(
  env: NodeJS.ProcessEnv,
  packaged = false,
  config?: Pick<ShellConfig, "bridgeBin" | "agentBin">,
  bundledBridge?: string,
): AllowedBins {
  const hooks = testHooks(env, packaged);
  // shell-config and ZB_BRIDGE_BIN still win. The bundled path is the packaged default.
  const bridgePick =
    pick("config", config?.bridgeBin) ??
    pick("env", env.ZB_BRIDGE_BIN) ??
    pick("hook", hooks.bridgeBin) ??
    pick("bundled", packaged ? bundledBridge : undefined);
  const agentPick = pick("config", config?.agentBin) ?? pick("env", env.ZB_AGENT_BIN) ?? pick("hook", hooks.agentBin);
  if (!bridgePick || !agentPick) throw new Error("binaries are not configured");
  let bridgeBin = resolve(bridgePick.value);
  let agentBin = resolve(agentPick.value);
  mustExecute(bridgeBin);
  mustExecute(agentBin);
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  // Config and ZB_*_BIN name a file the operator chose. Resolve the symlink, then
  // check that file and the directory that contains it. The bundled path and the
  // unpackaged ZB_E2E_* hooks stay out of this check.
  if (bridgePick.kind === "config" || bridgePick.kind === "env") bridgeBin = checkedBinary(bridgeBin, uid);
  if (agentPick.kind === "config" || agentPick.kind === "env") agentBin = checkedBinary(agentBin, uid);
  return { bridgeBin, agentBin };
}

export function configBinaryAllowed(
  st: { uid: number; mode: number; isFile(): boolean },
  uid: number | undefined,
): void {
  if (!st.isFile()) throw new Error("binary must be a regular file");
  if ((st.mode & 0o022) !== 0) throw new Error("binary is writable by the group or others");
  if (uid !== undefined && st.uid !== uid) throw new Error("binary is not owned by the user");
}

function pick(kind: BinKind, value: string | undefined): { kind: BinKind; value: string } | undefined {
  if (typeof value === "string" && value.length > 0) return { kind, value };
  return undefined;
}

function checkedBinary(path: string, uid: number | undefined): string {
  const real = realpathSync(path);
  configBinaryAllowed(statSync(real), uid);
  const parent = statSync(dirname(real));
  if ((parent.mode & 0o002) !== 0) throw new Error("binary directory is writable by others");
  if ((parent.mode & 0o020) !== 0) throw new Error("binary directory is writable by the group");
  return real;
}

function mustExecute(path: string): void {
  try {
    accessSync(path, constants.X_OK);
  } catch {
    throw new Error("binary is not executable");
  }
}
