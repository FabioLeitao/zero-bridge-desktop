import { test, expect, type ElectronApplication } from "@playwright/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { cleanupHarness, electronReady, launchApp, prepareHarness, tokenDirectory } from "./harness.js";

// Parent death (SIGKILL of Electron) is a gap. The bridge exits on SIGINT and
// SIGTERM only. It does not read stdin, and the shell spawns it with stdin
// ignored, so a closed pipe does not stop it. The unix socket is unlinked in
// Shutdown, which that signal runs. A killed parent does not deliver the
// signal. That behavior belongs in the bridge, not in this shell.

test.beforeAll(async () => {
  await prepareHarness();
});

test.afterAll(async () => {
  await cleanupHarness();
});

test.beforeEach(() => {
  test.skip(!electronReady(), "Electron binary missing. Run npm ci --allow-scripts, then npm run test:e2e.");
});

test("app.close stops the sidecar and removes the socket and token directory", async () => {
  test.setTimeout(60000);
  const scratch = await mkdtemp(join(tmpdir(), "zb-quit-"));
  const userDataDir = join(scratch, "user");
  const socketPath = join(scratch, "bridge.sock");
  const home = join(scratch, "home");
  await mkdir(userDataDir);
  await mkdir(home);
  await writeFile(join(userDataDir, "shell-config.json"), JSON.stringify({ unixSocket: socketPath }));
  const before = new Set(readdirSync(tokenDirectory()));
  const { app } = await launchApp({}, { userDataDir, home });
  try {
    const sidecar = sidecarOf(app);
    const tokenDir = tokenDirOf(sidecar.pid);
    expect(existsSync(`/proc/${sidecar.pid}`)).toBe(true);
    expect(existsSync(socketPath)).toBe(true);
    expect(existsSync(tokenDir)).toBe(true);
    expect(before.has(tokenDir.slice(tokenDirectory().length + 1))).toBe(false);
    await app.close();
    await expect.poll(() => existsSync(`/proc/${sidecar.pid}`), { timeout: 10000 }).toBe(false);
    await expect.poll(() => existsSync(socketPath), { timeout: 10000 }).toBe(false);
    await expect.poll(() => existsSync(tokenDir), { timeout: 10000 }).toBe(false);
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
});

function sidecarOf(app: ElectronApplication): { pid: number } {
  const parent = app.process().pid;
  if (!parent) throw new Error("electron pid missing");
  const matches = childPids(parent).filter((pid) => procCmdline(pid).includes("--listen"));
  if (matches.length !== 1) throw new Error(`expected one sidecar, saw ${matches.length}`);
  return { pid: matches[0]! };
}

function tokenDirOf(pid: number): string {
  const parts = procCmdline(pid).split(" ");
  const flag = parts.indexOf("--token-file");
  const file = flag >= 0 ? parts[flag + 1] : "";
  if (!file) throw new Error("sidecar command has no token file");
  return dirname(file);
}

function childPids(parent: number): number[] {
  const out: number[] = [];
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) continue;
    const pid = Number(name);
    let stat = "";
    try {
      stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    } catch {
      continue;
    }
    const end = stat.lastIndexOf(")");
    const ppid = Number(stat.slice(end + 2).split(" ")[1]);
    if (ppid === parent) out.push(pid);
  }
  return out;
}

function procCmdline(pid: number): string {
  try {
    return readFileSync(`/proc/${pid}/cmdline`).toString("utf8").replaceAll("\0", " ");
  } catch {
    return "";
  }
}
