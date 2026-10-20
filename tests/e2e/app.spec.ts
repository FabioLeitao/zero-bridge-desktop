import { test, expect, _electron as electron } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveBridgeModule } from "../bridgeSource.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const electronPathFile = join(repoRoot, "node_modules", "electron", "path.txt");

let bridgeBin = "";
let agentBin = "";
let tokenDir = "";

function electronReady(): boolean {
  return existsSync(electronPathFile);
}

test.beforeAll(async () => {
  if (!electronReady()) return;
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
  tokenDir = await mkdtemp(join(tmpdir(), "zb-e2e-"));
});

test.afterAll(async () => {
  for (const path of [bridgeBin, agentBin, tokenDir]) {
    if (path) await rm(path, { force: true, recursive: true });
  }
});

test.beforeEach(() => {
  test.skip(!electronReady(), "Electron binary missing. Run npm ci --allow-scripts, then npm run test:e2e.");
});

async function launchApp(extra: Record<string, string> = {}) {
  const app = await electron.launch({
    args: [repoRoot],
    cwd: repoRoot,
    env: {
      ...process.env,
      ZB_E2E_BRIDGE_BIN: bridgeBin,
      ZB_E2E_AGENT_BIN: agentBin,
      ZB_E2E_TOKEN_FILE: join(tokenDir, "token.txt"),
      ZB_E2E_PORT: "0",
      ZB_FAKE_PERMISSION: "1",
      ...extra,
    },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState("domcontentloaded");
  await expect(window.locator("h1")).toHaveText("zero-bridge", { timeout: 30000 });
  return { app, window };
}

test("loads the bridge UI from the sidecar", async () => {
  const { app, window } = await launchApp();
  await expect(window.locator("#new-session")).toBeVisible();
  await app.close();
});

test("shows a permission card from the fake agent", async () => {
  const { app, window } = await launchApp();
  await window.locator("#new-session").click();
  await window.locator("#text").fill("hello from e2e");
  await window.locator("#send").click();
  await expect(window.locator("section.perm")).toBeVisible({ timeout: 20000 });
  await app.close();
});

test("records a sanitized notification when the window is hidden", async () => {
  const noteLog = join(tokenDir, "notes.txt");
  const { app, window } = await launchApp({ ZB_E2E_NOTE_LOG: noteLog });
  await window.locator("#new-session").click();
  await window.locator("#text").fill("hello from e2e");
  await app.evaluate(async ({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0]?.hide();
  });
  // A hidden window is not actionable. The click still has to reach the page.
  await window.locator("#send").evaluate((el) => (el as HTMLButtonElement).click());
  await expect.poll(async () => {
    try {
      return await readFile(noteLog, "utf8");
    } catch {
      return "";
    }
  }, { timeout: 20000 }).toContain("write");
  const body = await readFile(noteLog, "utf8");
  assertNoMarkup(body);
  await app.close();
});

function assertNoMarkup(body: string) {
  if (/[<>]/.test(body)) throw new Error("notification body kept markup");
}
