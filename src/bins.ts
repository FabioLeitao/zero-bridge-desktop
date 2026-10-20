// Binaries the main process may spawn. The renderer never supplies these paths.
import { accessSync, constants } from "node:fs";
import { resolve } from "node:path";

export interface AllowedBins {
  bridgeBin: string;
  agentBin: string;
}

export function resolveAllowedBins(env: NodeJS.ProcessEnv): AllowedBins {
  const bridge = first(env.ZB_BRIDGE_BIN, env.ZB_E2E_BRIDGE_BIN);
  const agent = first(env.ZB_AGENT_BIN, env.ZB_E2E_AGENT_BIN);
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
