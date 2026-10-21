// The pin names the bundled bridge only. An override must not be logged as that commit.

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export function parseBridgePin(text: string): string {
  const pin = text.trim();
  if (!/^[0-9a-f]{40}$/.test(pin)) throw new Error("bridge pin is not a commit");
  return pin;
}

export function readBridgePin(path: string): string {
  return parseBridgePin(readFileSync(path, "utf8"));
}

export function bridgePinPath(packaged: boolean, resourcesPath: string, moduleDir: string): string {
  if (packaged) return join(resourcesPath, "bridge", "bridge.sha");
  return join(moduleDir, "..", "..", "bridge.sha");
}

export function sidecarStartLine(pin: string): string {
  return `sidecar start bridge ${parseBridgePin(pin)}`;
}

export function readOptionalBridgePin(path: string): string | undefined {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

// The pin line is provenance for the bundled binary. Any other path is an override.
export function bridgeStartLogLine(
  bridgeBin: string,
  bundledBridge: string | undefined,
  pinText: string | undefined,
): string {
  if (bundledBridge === undefined || resolve(bridgeBin) !== resolve(bundledBridge)) {
    return "sidecar start bridge override";
  }
  try {
    return sidecarStartLine(pinText ?? "");
  } catch {
    return "sidecar start bridge pin unavailable";
  }
}
