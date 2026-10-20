import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  test.skip(!electronReady(), "Electron binary missing. Run npm ci --allow-scripts, then npm run test:e2e.");
});

test("opens the window on the zero-bridge title", async () => {
  const info = execFileSync("go", ["version", "-m", agentBinary()], { encoding: "utf8" });
  expect(info).toContain("cmd/acpfake");
  const electronBin = electronBinary();
  expect(existsSync(electronBin)).toBe(true);
  console.log(`proof agent=acpfake electron=${electronBin}`);
  test.info().annotations.push(
    { type: "agent", description: "acpfake" },
    { type: "electron", description: electronBin },
  );
  const { app, window } = await launchApp();
  await expect(window.locator("h1")).toHaveText("zero-bridge");
  await expect(window).toHaveTitle("zero-bridge");
  await app.close();
});

test("the folder picker accepts a child of the approved root and refuses the outside", async () => {
  const { app, window } = await launchApp();
  const root = await workspaceValue(window);
  const inside = join(root, "picked");
  const outside = await mkdtemp(join(tmpdir(), "zb-outside-"));
  try {
    await mkdir(inside);
    await stubPick(app, inside);
    await expect.poll(async () => pickWorkspace(window), { timeout: 20000 }).toBe(inside);
    await window.locator("#new-session-options").click();
    await window.locator("#new-workspace").fill(inside);
    const posted = window.waitForResponse(
      (res) => res.url().includes("/v1/sessions") && res.request().method() === "POST",
    );
    await window.locator("#new-session-custom").click();
    const res = await posted;
    expect(res.ok()).toBe(true);
    expect(JSON.parse(res.request().postData() ?? "{}").workspace).toBe(inside);
    await expect(window.locator("#new-session-error")).toHaveText("");

    await stubPick(app, outside);
    expect(await pickWorkspace(window)).toBeNull();
    expect(await pickMessage(app)).toContain("outside the allowed workspace roots");
    await expect(window.locator("#workspace")).not.toHaveValue(outside);
  } finally {
    await rm(outside, { recursive: true, force: true });
    await app.close();
  }
});

test("a prompt shows the fake agent reply in the log", async () => {
  const { app, window } = await launchApp({ ZB_FAKE_PERMISSION: "0", ZB_FAKE_TEXT: reply });
  await window.locator("#new-session").click();
  await window.locator("#text").fill("hello from e2e");
  await window.locator("#send").click();
  await expect(window.locator("#log")).toContainText(reply, { timeout: 20000 });
  await app.close();
});

test("a catalog-row label survives reopen from the temporary profile", async () => {
  test.setTimeout(120000);
  const scratch = await mkdtemp(join(tmpdir(), "zb-flow-"));
  const userDataDir = join(scratch, "userData");
  await mkdir(userDataDir);
  const dirs = { userDataDir, home: userDataDir };
  const port = await freePort();
  const extra = { ZB_FAKE_PERMISSION: "0", ZB_FAKE_TEXT: reply, ZB_E2E_PORT: port };
  try {
    const first = await launchApp(extra, dirs);
    const root = await workspaceValue(first.window);
    const inside = join(root, "picked");
    await mkdir(inside);
    await stubPick(first.app, inside);
    await expect.poll(async () => pickWorkspace(first.window), { timeout: 20000 }).toBe(inside);
    await first.window.locator("#new-session-options").click();
    await first.window.locator("#new-workspace").fill(inside);
    const posted = first.window.waitForResponse(
      (res) => res.url().includes("/v1/sessions") && res.request().method() === "POST",
    );
    await first.window.locator("#new-session-custom").click();
    const created = await posted;
    expect(created.ok()).toBe(true);
    const sessionId = String((await created.json()).sessionId ?? "");
    expect(sessionId).toMatch(/^sess-acptest-/);
    console.log(`proof created-session=${sessionId}`);
    test.info().annotations.push({ type: "session", description: sessionId });
    await first.window.locator("#text").fill("hello from the picked folder");
    await first.window.locator("#send").click();
    await expect(first.window.locator("#log")).toContainText(reply, { timeout: 20000 });
    await expect(first.window.locator("#session-browser")).toBeVisible();
    await first.window.locator("#session-filter").selectOption("all");
    // The row is the catalog entry titled alpha, not the session/new id.
    // The alias is the bridge label store under this temporary HOME.
    // The filter value "all" is localStorage for the stable page origin.
    const row = first.window.locator("#session-list li", { hasText: "alpha" });
    await expect(row).toBeVisible({ timeout: 20000 });
    await row.getByRole("button", { name: "Renomear" }).evaluate((el) => {
      const button = el as HTMLButtonElement;
      button.click();
      const input = button.closest("li")?.querySelector("input.rename-input");
      if (!(input instanceof HTMLInputElement)) return;
      input.value = "kept-after-reopen";
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    await expect(first.window.locator("#session-list")).toContainText("kept-after-reopen", { timeout: 20000 });
    await first.app.close();

    const second = await launchApp(extra, dirs);
    await expect(second.window.locator("#session-browser")).toBeVisible();
    await expect(second.window.locator("#session-filter")).toHaveValue("all");
    await expect(second.window.locator("#session-list")).toContainText("kept-after-reopen", { timeout: 20000 });
    await second.app.close();
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

function freePort(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((err) => (err ? reject(err) : resolve(String(port))));
    });
    server.on("error", reject);
  });
}

async function workspaceValue(window: Page): Promise<string> {
  await expect.poll(async () => window.locator("#workspace").inputValue(), { timeout: 20000 }).toMatch(/^\//);
  return window.locator("#workspace").inputValue();
}

async function stubPick(app: ElectronApplication, filePath: string): Promise<void> {
  await app.evaluate(({ dialog }, picked) => {
    const box = dialog as unknown as {
      showOpenDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
      showMessageBox: (_win: unknown, opts: { message?: string }) => Promise<{ response: number }>;
    };
    box.showOpenDialog = () => Promise.resolve({ canceled: false, filePaths: [picked] });
    box.showMessageBox = (_win, opts) => {
      (globalThis as { __zbPickMessage?: string }).__zbPickMessage = opts.message ?? "";
      return Promise.resolve({ response: 0 });
    };
  }, filePath);
}

function pickWorkspace(window: Page): Promise<string | null> {
  return window.evaluate(() => {
    const zb = (window as unknown as { zb?: { pickWorkspace: () => Promise<string | null> } }).zb;
    if (!zb) return Promise.resolve(null);
    return zb.pickWorkspace();
  });
}

function pickMessage(app: ElectronApplication): Promise<string> {
  return app.evaluate(() => (globalThis as { __zbPickMessage?: string }).__zbPickMessage ?? "");
}
