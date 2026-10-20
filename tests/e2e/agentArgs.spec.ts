import { test, expect } from "@playwright/test";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupHarness, electronReady, launchApp, prepareHarness } from "./harness.js";

test.beforeAll(async () => {
  await prepareHarness();
});

test.afterAll(async () => {
  await cleanupHarness();
});

test.beforeEach(() => {
  test.skip(!electronReady(), "Electron binary missing. Run npm ci --allow-scripts, then npm run test:e2e.");
});

test("shell config agent arguments and profile reach the sidecar command line", async () => {
  const userData = await mkdtemp(join(tmpdir(), "zb-agent-args-"));
  writeFileSync(
    join(userData, "shell-config.json"),
    JSON.stringify({ agentArgs: ["acp", "e2e-marker"], profile: "generic" }),
  );
  const { app } = await launchApp({}, { userDataDir: userData });
  try {
    const pid = app.process().pid;
    if (!pid) throw new Error("electron pid missing");
    const fields = sidecarArgv(pid);
    const args: string[] = [];
    for (let i = 0; i < fields.length - 1; i++) {
      if (fields[i] === "--agent-arg") args.push(fields[i + 1]);
    }
    expect(args).toEqual(["acp", "e2e-marker"]);
    const profileAt = fields.indexOf("--profile");
    expect(fields[profileAt + 1]).toBe("generic");
  } finally {
    await app.close();
    await rm(userData, { recursive: true, force: true });
  }
});

function sidecarArgv(rootPid: number): string[] {
  const seen = new Set<number>();
  const queue = [rootPid];
  while (queue.length > 0) {
    const pid = queue.shift();
    if (pid === undefined || seen.has(pid)) continue;
    seen.add(pid);
    for (const child of childPids(pid)) queue.push(child);
    if (pid === rootPid) continue;
    let raw: Buffer;
    try {
      raw = readFileSync(`/proc/${pid}/cmdline`);
    } catch {
      continue;
    }
    const fields = raw.toString("utf8").split("\0").filter((field) => field.length > 0);
    if (fields.includes("--listen") && fields.includes("--agent-cmd")) return fields;
  }
  throw new Error("sidecar command line not found");
}

function childPids(parent: number): number[] {
  const found: number[] = [];
  for (const name of readdirSync("/proc")) {
    if (!/^\d+$/.test(name)) continue;
    let stat: string;
    try {
      stat = readFileSync(`/proc/${name}/stat`, "utf8");
    } catch {
      continue;
    }
    const close = stat.lastIndexOf(")");
    if (close < 0) continue;
    const ppid = Number(stat.slice(close + 2).split(" ")[1]);
    if (ppid === parent) found.push(Number(name));
  }
  return found;
}
