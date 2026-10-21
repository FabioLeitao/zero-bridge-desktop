// The pin file is the only bridge SHA. A checkout is accepted after rev-parse matches it.

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REMOTE = "https://github.com/FabioLeitao/zero-bridge.git";

export function parsePin(text) {
  const pin = String(text).trim();
  if (!/^[0-9a-f]{40}$/.test(pin)) throw new Error("bridge pin is not a commit");
  return pin;
}

export function readPin(repoRoot) {
  return parsePin(readFileSync(join(repoRoot, "bridge.sha"), "utf8"));
}

export function withBridgeCheckout(repoRoot, use) {
  const pin = readPin(repoRoot);
  const dir = mkdtempSync(join(tmpdir(), "zbd-bridge-"));
  const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir, env });
    execFileSync("git", ["remote", "add", "origin", REMOTE], { cwd: dir, env });
    execFileSync("git", ["fetch", "--depth", "1", "origin", pin], { cwd: dir, env });
    execFileSync("git", ["checkout", "--detach", "FETCH_HEAD"], { cwd: dir, env });
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, env, encoding: "utf8" }).trim();
    if (head !== pin) throw new Error(`bridge checkout ${head} does not match pin ${pin}`);
    return use({ pin, moduleDir: join(dir, "bridge") });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
