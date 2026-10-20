import { expect, _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBridgeModule } from "../bridgeSource.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const electronPathFile = join(repoRoot, "node_modules", "electron", "path.txt");

let bridgeBin = "";
let agentBin = "";
let tokenDir = "";
let users = 0;

export function electronReady(): boolean {
  return existsSync(electronPathFile);
}

export function electronBinary(): string {
  const name = readFileSync(electronPathFile, "utf8").trim();
  return join(dirname(electronPathFile), "dist", name);
}

export function agentBinary(): string {
  return agentBin;
}

export function tokenDirectory(): string {
  return tokenDir;
}

export async function prepareHarness(): Promise<void> {
  users += 1;
  if (!electronReady()) return;
  if (bridgeBin && existsSync(bridgeBin) && agentBin && existsSync(agentBin)) return;
  const moduleDir = resolveBridgeModule(
    {
      env: process.env.ZB_BRIDGE_SRC,
      nested: join(repoRoot, "zero-bridge", "bridge"),
      sibling: join(repoRoot, "..", "zero-bridge", "bridge"),
    },
    existsSync,
  );
  bridgeBin = join(tmpdir(), `zb-e2e-bridge-${randomBytes(4).toString("hex")}`);
  agentBin = join(tmpdir(), `zb-e2e-agent-${randomBytes(4).toString("hex")}`);
  execFileSync("go", ["build", "-o", bridgeBin, "./cmd/zero-bridge"], { cwd: moduleDir });
  execFileSync("go", ["build", "-o", agentBin, "./cmd/acpfake"], { cwd: moduleDir });
  if (!tokenDir) tokenDir = await mkdtemp(join(tmpdir(), "zb-e2e-"));
}

export async function cleanupHarness(): Promise<void> {
  users -= 1;
  if (users > 0) return;
  for (const path of [bridgeBin, agentBin, tokenDir]) {
    if (path) await rm(path, { force: true, recursive: true });
  }
  bridgeBin = "";
  agentBin = "";
  tokenDir = "";
}

export async function launchApp(
  extra: Record<string, string> = {},
  dirs: { userDataDir?: string; home?: string } = {},
): Promise<{ app: ElectronApplication; window: Page }> {
  const args = dirs.userDataDir ? [`--user-data-dir=${dirs.userDataDir}`, repoRoot] : [repoRoot];
  const app = await electron.launch({
    args,
    cwd: repoRoot,
    env: {
      ...process.env,
      ZB_E2E_BRIDGE_BIN: bridgeBin,
      ZB_E2E_AGENT_BIN: agentBin,
      ZB_E2E_TOKEN_FILE: join(tokenDir, "token.txt"),
      ZB_E2E_PORT: "0",
      ZB_FAKE_PERMISSION: "1",
      ...(dirs.home ? { HOME: dirs.home } : {}),
      ...extra,
    },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  await expect(window.locator("h1")).toHaveText("zero-bridge", { timeout: 30000 });
  return { app, window };
}
