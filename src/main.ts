import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import { join } from "node:path";
import { SidecarController } from "./sidecar.js";
import { sidecarOrigin, isLoopbackHost, sameOrigin } from "./origin.js";
import { IPC_CHANNELS } from "./types.js";

let mainWindow: BrowserWindow | null = null;
const controller = new SidecarController();
let currentUrl: string | null = null;
let sidecarTokenPath: string | null = null;

app.on("ready", () => {
  // Security hard code.
  app.allowRendererProcessReuse = true;
  app.commandLine.appendSwitch("disable-features", "TranslateUI");

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, "preload.js"),
    },
    show: false,
  });

  // CSP strict for the app origin (set per navigation, but set a baseline).
  const ses = session.defaultSession;
  ses.webRequest.onHeadersReceived((details, cb) => {
    const headers = { ...details.responseHeaders };
    cb({ responseHeaders: headers });
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    // Block all popups/new windows.
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (_evt, url) => {
    if (!currentUrl) {
      // Allow first navigation to the sidecar origin only.
      return;
    }
    const dest = new URL(url);
    const base = new URL(currentUrl);
    if (!sameOrigin(dest, base)) {
      _evt.preventDefault();
    }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  // No sidecar emission; wait for LAUNCH from the renderer.
});

ipcMain.handle(IPC_CHANNELS.LAUNCH, async (_evt, opts: any) => {
  try {
    // Validate inputs without exposing them in logs.
    const bridgeBin = String(opts.bridgeBin || "");
    const agentBin = String(opts.agentBin || "");
    if (!bridgeBin || !agentBin) {
      return { ok: false, state: "stopped", error: "missing bin paths" };
    }

    const port = Number(opts.port) || 8765;
    const handle = await controller.launch({
      bridgeBin,
      agentBin,
      port,
      tokenDir: String(opts.tokenDir || ""),
      workspaceRoot: opts.workspaceRoot ? String(opts.workspaceRoot) : undefined,
    });

    sidecarTokenPath = handle.tokenPath;
    currentUrl = `http://127.0.0.1:${port}/`;

    // Push state to renderer.
    mainWindow?.webContents.send(IPC_CHANNELS.STATE, {
      state: handle.state,
      url: currentUrl,
    });

    return { ok: true, state: handle.state, url: currentUrl, tokenPath: sidecarTokenPath };
  } catch (e: any) {
    return { ok: false, state: "crashed", error: String(e?.message || e) };
  }
});

ipcMain.on(IPC_CHANNELS.QUIT, async () => {
  await controller.kill();
  mainWindow?.close();
  app.quit();
});

app.on("window-all-closed", async () => {
  await controller.kill();
  app.quit();
});

app.on("before-quit", async () => {
  await controller.kill();
});