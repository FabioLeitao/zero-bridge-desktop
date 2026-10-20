import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  cleanupHarness,
  electronReady,
  launchApp,
  prepareHarness,
  tokenDirectory,
} from "./harness.js";

test.beforeAll(async () => {
  await prepareHarness();
});

test.afterAll(async () => {
  await cleanupHarness();
});

test.beforeEach(() => {
  test.skip(!electronReady(), "Electron binary missing. Run npm ci --allow-scripts, then npm run test:e2e.");
});

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
  const noteLog = join(tokenDirectory(), "notes.txt");
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
