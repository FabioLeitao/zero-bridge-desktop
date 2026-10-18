#!/usr/bin/env node
import { app, BrowserWindow } from "electron";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { promises as fs } from "node:fs";

let bridgeProc = null;
let win = null;
let tokenPath = null;

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
}

app.on("ready", async () => {
  try {
    // 1. Build acpfake from bridge repo (assumes zero-bridge sibling)
    const bridgeDir = join(__dirname, "..", "zero-bridge");
    const bridgeBin = join(bridgeDir, "bridge", "cmd", "acpfake", "main.go");
    const agentBin = join(bridgeDir, "bridge", "cmd", "zero-bridge", "main.go"); // fallback
    // For simplicity, use go run acpfake
    const tokenDir = join(tmpdir(), "zb-smoke-" + randomBytes(4).toString("hex"));
    await fs.mkdir(tokenDir, { recursive: true, mode: 0o700 });
    tokenPath = join(tokenDir, "token.txt");
    const token = randomBytes(32).toString("hex");
    await fs.writeFile(tokenPath, token + "\n", { mode: 0o600 });

    // Launch acpfake via go run (dev mode)
    bridgeProc = execFile("go", ["run", bridgeBin, "--listen", "127.0.0.1:0", "--token-file", tokenPath], {
      cwd: bridgeDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Wait for acpfake to report listening (simple timeout)
    await new Promise((resolve, reject) => {
      let got = false;
      const timer = setTimeout(() => {
        if (!got) reject(new Error("acpfake did not start"));
      }, 5000);
      bridgeProc.stdout.on("data", (data) => {
        const line = data.toString();
        if (line.includes("listen on") && line.includes("127.0.0.1")) {
          clearTimeout(timer);
          got = true;
          resolve();
        }
      });
      bridgeProc.stderr.on("data", (data) => {
        // Ignore for now; could grep for errors
      });
    });

    // 2. Create BrowserWindow that loads the bridge UI via the sidecar's HTTP
    const portMatch = await new Promise((resolve) => {
      let port = null;
      const intv = setInterval(() => {
        bridgeProc.stdout.once("data", (data) => {
          const line = data.toString();
          const m = line.match(/listen on (127\.0\.0\.1):(\d+)/);
          if (m) {
            clearInterval(intv);
            resolve(parseInt(m[2], 10));
          }
        });
      }, 100);
    });

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

    // Navigate to bridge UI
    win.loadURL(`http://127.0.0.1:${port}/`);

    // Wait for first paint or a known element
    win.webContents.once("did-finish-load", () => {
      win.show();
      // Simple check: title contains zero-bridge
      win.webContents.executeJavaScript("document.title")
        .then((title) => {
          if (title && title.includes("zero-bridge")) {
            console.log("SMOKE OK: UI loaded");
          } else {
            console.warn("SMOKE WARN: unexpected title", title);
          }
        });
    });

    // Give it a moment then quit
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