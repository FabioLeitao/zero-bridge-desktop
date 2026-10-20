// Binaries the main process may spawn. The renderer never supplies these paths.
import { accessSync, constants, lstatSync } from "node:fs";
import { resolve } from "node:path";
import { testHooks } from "./testEnv.js";
import type { ShellConfig } from "./shellConfig.js";

export interface AllowedBins {
  bridgeBin: string;
  agentBin: string;
}

export function resolveAllowedBins(
  env: NodeJS.ProcessEnv,
  packaged = false,
  config?: Pick<ShellConfig, "bridgeBin" | "agentBin">,
): AllowedBins {
  const hooks = testHooks(env, packaged);
  const bridge = first(config?.bridgeBin, env.ZB_BRIDGE_BIN, hooks.bridgeBin);
  const agent = first(config?.agentBin, env.ZB_AGENT_BIN, hooks.agentBin);
  if (!bridge || !agent) throw new Error("binaries are not configured");
  const bridgeBin = resolve(bridge);
  const agentBin = resolve(agent);
  mustExecute(bridgeBin);
  mustExecute(agentBin);
  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  if (config?.bridgeBin) configBinaryAllowed(lstatSync(bridgeBin), uid);
  if (config?.agentBin) configBinaryAllowed(lstatSync(agentBin), uid);
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

function first(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function mustExecute(path: string): void {
  try {
    accessSync(path, constants.X_OK);
  } catch {
    throw new Error("binary is not executable");
  }
}
