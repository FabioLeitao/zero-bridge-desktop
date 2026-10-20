// Binaries the main process may spawn. The renderer never supplies these paths.
import { accessSync, constants } from "node:fs";
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
  return { bridgeBin, agentBin };
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
