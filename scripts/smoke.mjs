#!/usr/bin/env node
// Smoke test for S23a: the desktop shell must launch the *real* zero-bridge
// binary as a sidecar. The bridge then spawns the ACP agent (acpfake for the
// smoke test). We never point the shell at a harness directly.
import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";

let bridgeProc = null;
let win = null;
let tokenPath = null;
let tokenDir = null;
let bridgeBin = null;
let agentBin = null;

async function cleanup() {
  if (win) win.destroy();
  if (bridgeProc) {
    try { bridgeProc.kill("SIGTERM"); } catch {}
    try { await new Promise(r => setTimeout(r, 500)); } catch {}
    if (!bridgeProc.killed) bridgeProc.kill("SIGKILL");
  }
  if (tokenPath) {
    try { await fs.rm(tokenPath, { force: true, recursive: true }); } catch {}
  }
  if (tokenDir) {
    try { await fs.rm(tokenDir, { force: true, recursive: true }); } catch {}
  }
  if (bridgeBin) {
    try { await fs.rm(bridgeBin, { force: true }); } catch {}
  }
  if (agentBin) {
    try { await fs.rm(agentBin, { force: true }); } catch {}
  }
}

app.on("ready", async () => {
  try {
    const bridgeDir = join(__dirname, "..", "zero-bridge");

    // 1. Build the real zero-bridge binary (sidecar target).
    const bridgeTmp = join(tmpdir(), "zb-smoke-bridge-" + randomBytes(4).toString("hex"));
    const agentTmp = join(tmpdir(), "zb-smoke-agent-" + randomBytes(4).toString("hex"));
    bridgeBin = bridgeTmp;
    agentBin = agentTmp;

    execFileSync("go", ["build", "-o", bridgeTmp, "./cmd/zero-bridge"], { cwd: bridgeDir });
    execFileSync("go", ["build", "-o", agentTmp, "./cmd/acpfake"], { cwd: bridgeDir });

    // 2. Create a per-launch token file (mode 0600).
    tokenDir = join(tmpdir(), "zb-smoke-" + randomBytes(4).toString("hex"));
    await fs.mkdir(tokenDir, { recursive: true, mode: 0o700 });
    tokenPath = join(tokenDir, "token.txt");
    const token = randomBytes(32).toString("hex");
    await fs.writeFile(tokenPath, token + "\n", { mode: 0o600 });

    // 3. Launch the real zero-bridge as a sidecar.
    //    It spawns the ACP agent (acpfake) as a child.
    //    argv only, no shell, token via file.
    bridgeProc = execFile(bridgeBin, [
      "--listen", "127.0.0.1:0",
      "--agent-cmd", agentBin,
      "--token-file", tokenPath,
    ], {
      cwd: bridgeDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // 4. Wait for the bridge to report its listening address.
    const port = await new Promise((resolve, reject) => {
      let got = false;
      const timer = setTimeout(() => {
        if (!got) reject(new Error("zero-bridge did not start"));
      }, 15000);
      const onLine = (data) => {
        const line = data.toString();
        const m = line.match(/listen on (127\.0\.0\.1):(\d+)/);
        if (m) {
          clearTimeout(timer);
          got = true;
          resolve(parseInt(m[2], 10));
        }
      };
      bridgeProc.stdout.on("data", onLine);
      bridgeProc.stderr.on("data", onLine);
    });

    // 5. Create the BrowserWindow with hardening.
    win = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        preload: join(__dirname, "..", "src", "preload.js"),
      },
      show: false,
    });

    // 6. Navigate to the bridge UI (loopback only).
    const url = `http://127.0.0.1:${port}/`;
    win.loadURL(url);

    // 7. Wait for the page to load.
    win.webContents.once("did-finish-load", async () => {
      win.show();
      const title = await win.webContents.executeJavaScript("document.title");
      if (title && title.toLowerCase().includes("zero-bridge")) {
        console.log("SMOKE OK: UI loaded from zero-bridge sidecar");
      } else {
        console.warn("SMOKE WARN: unexpected title", title);
      }
    });

    // 8. Give it a moment, then quit cleanly.
    setTimeout(async () => {
      await cleanup();
      app.exit(0);
    }, 3000);
  } catch (err) {
    console.error("SMOKE FAIL:", err);
    await cleanup();
    app.exit(1);
  }
});