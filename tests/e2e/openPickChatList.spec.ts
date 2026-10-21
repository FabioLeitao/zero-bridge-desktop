import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  agentBinary,
  cleanupHarness,
  electronBinary,
  electronReady,
  launchApp,
  prepareHarness,
} from "./harness.js";

const reply = "acpfake-e2e-reply";

test.beforeAll(async () => {
  await prepareHarness();
});

test.afterAll(async () => {
  await cleanupHarness();
});

test.beforeEach(() => {
  if (!electronReady()) {
    if (process.env.ZB_REQUIRE_E2E === "1") {
      throw new Error("Electron binary missing");
    }
    test.skip(true, "Electron binary missing. Run npm ci --allow-scripts, then npm run test:e2e.");
  }
});

test("opens, picks an allowed folder, chats, and lists that session", async () => {
  test.setTimeout(120000);
  const info = execFileSync("go", ["version", "-m", agentBinary()], { encoding: "utf8" });
  expect(info).toContain("cmd/acpfake");
  const electronBin = electronBinary();
  expect(existsSync(electronBin)).toBe(true);
  console.log(`proof agent=acpfake electron=${electronBin}`);
  test.info().annotations.push(
    { type: "agent", description: "acpfake" },
    { type: "electron", description: electronBin },
  );

  const { app, window } = await launchApp({
    ZB_FAKE_LIST: "created",
    ZB_FAKE_PERMISSION: "0",
    ZB_FAKE_TEXT: reply,
  });
  const picked: string[] = [];
  try {
    const root = await workspaceValue(window);
    const inside = join(root, "picked");
    picked.push(inside);
    await mkdir(inside);
    await stubPick(app, inside);
    await expect.poll(async () => pickWorkspace(window), { timeout: 20000 }).toBe(inside);

    await window.locator("#new-session-options").click();
    await window.locator("#new-workspace").fill(inside);
    const posted = window.waitForResponse(
      (res) => res.url().includes("/v1/sessions") && res.request().method() === "POST",
    );
    await window.locator("#new-session-custom").click();
    const created = await posted;
    expect(created.ok()).toBe(true);
    const sessionId = String((await created.json()).sessionId ?? "");
    expect(sessionId).toMatch(/^sess-acptest-/);

    await window.locator("#text").fill("hello from the picked folder");
    await window.locator("#send").click();
    await expect(window.locator("#log")).toContainText(reply, { timeout: 20000 });

    await expect(window.locator("#session-browser")).toBeVisible();
    await window.locator("#session-filter").selectOption("all");
    const row = window.locator(`#session-list li[data-id="${sessionId}"]`);
    await expect(row.locator(".session-title")).toHaveText(inside, { timeout: 20000 });
    await expect(row.locator("p").first()).toContainText(basename(inside));
  } finally {
    await app.close();
    for (const path of picked) await rm(path, { recursive: true, force: true });
  }
});

async function workspaceValue(window: import("@playwright/test").Page): Promise<string> {
  await expect.poll(async () => window.locator("#workspace").inputValue(), { timeout: 20000 }).toMatch(/^\//);
  return window.locator("#workspace").inputValue();
}

async function stubPick(app: import("@playwright/test").ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, picked) => {
    const box = dialog as unknown as {
      showOpenDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
    };
    box.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [picked] });
  }, filePath);
}

function pickWorkspace(window: import("@playwright/test").Page): Promise<string | null> {
  return window.evaluate(() => {
    const zb = (window as unknown as { zb?: { pickWorkspace: () => Promise<string | null> } }).zb;
    if (!zb) return Promise.resolve(null);
    return zb.pickWorkspace();
  });
}
