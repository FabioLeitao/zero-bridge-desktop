import { app, BrowserWindow, ipcMain, session } from "electron";
import { join } from "node:path";
import { SidecarController } from "./sidecar.js";
import { sidecarOrigin, isLoopbackHost, sameOrigin } from "./origin.js";
import { IPC_CHANNELS } from "./types.js";
import { TrayController } from "./tray.js";
import { PermissionNotifier, PermissionNotice } from "./notifications.js";
import { FolderPicker } from "./folderPicker.js";

let mainWindow: BrowserWindow | null = null;
const controller = new SidecarController();
const tray = new TrayController(join(import.meta.dirname, "..", "assets", "icon.png"));
const notifier = new PermissionNotifier();
const folderPicker = new FolderPicker();
let currentUrl: string | null = null;
let sidecarTokenPath: string | null = null;
let singleInstanceLock = false;

// Single instance lock (second launch focuses first window).
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  singleInstanceLock = true;
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.on("ready", () => {
  // Security hard code.
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

  // Tray attaches after window exists.
  tray.attach(mainWindow);
  notifier.attach(mainWindow);

  // CSP baseline.
  const ses = session.defaultSession;
  ses.webRequest.onHeadersReceived((details, cb) => {
    const headers = { ...details.responseHeaders };
    cb({ responseHeaders: headers });
  });

  // Block all popups/new windows.
  mainWindow.webContents.setWindowOpenHandler((details) => ({ action: "deny" }));

  // Navigation guard: only same origin as the sidecar.
  mainWindow.webContents.on("will-navigate", (_evt, url) => {
    if (!currentUrl) return;
    const dest = new URL(url);
    const base = new URL(currentUrl);
    if (!sameOrigin(dest, base)) _evt.preventDefault();
  });

  // Handle drag & drop folders (validate against workspace roots).
  mainWindow.webContents.on("will-navigate", (_evt, url) => {
    // Already handled above.
  });

  // Drop handler on the window (renderer sends path via IPC).
  ipcMain.handle("zb:folder-drop", async (_evt, paths: string[]) => {
    return folderPicker.handleDrop(paths);
  });

  // Fetch workspace roots from bridge after sidecar is running.
  ipcMain.handle("zb:fetch-workspace-roots", async () => {
    if (!currentUrl) return [];
    try {
      const res = await fetch(`${currentUrl}v1/capabilities`);
      const data = await res.json();
      if (data.workspaceRoots && Array.isArray(data.workspaceRoots)) {
        folderPicker.setAllowedRoots(data.workspaceRoots);
        return data.workspaceRoots;
      }
    } catch {}
    return [];
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
});

ipcMain.handle(IPC_CHANNELS.LAUNCH, async (_evt, opts: any) => {
  try {
    // E2E test mode: read from env if opts not provided
    const bridgeBin = String(opts.bridgeBin || process.env.ZB_E2E_BRIDGE_BIN || "");
    const agentBin = String(opts.agentBin || process.env.ZB_E2E_AGENT_BIN || "");
    if (!bridgeBin || !agentBin) {
      return { ok: false, state: "stopped", error: "missing bin paths" };
    }

    const port = Number(opts.port || process.env.ZB_E2E_PORT || "0") || 8765;
    const tokenDir = String(opts.tokenDir || process.env.ZB_E2E_TOKEN_FILE || "");
    const handle = await controller.launch({
      bridgeBin,
      agentBin,
      port,
      tokenDir: tokenDir ? tokenDir.replace(/token\.txt$/, "") : "",
      workspaceRoot: opts.workspaceRoot ? String(opts.workspaceRoot) : undefined,
    });

    sidecarTokenPath = handle.tokenPath;
    currentUrl = `http://127.0.0.1:${port}/`;

    mainWindow?.webContents.send(IPC_CHANNELS.STATE, {
      state: handle.state,
      url: currentUrl,
    });

    // Fetch workspace roots for folder picker validation.
    await fetchWorkspaceRoots();

    return { ok: true, state: handle.state, url: currentUrl, tokenPath: sidecarTokenPath };
  } catch (e: any) {
    return { ok: false, state: "crashed", error: String(e?.message || e) };
  }
});

// Called by renderer when it sees a permission_request on SSE.
ipcMain.on("zb:permission-request", (_evt, notice: PermissionNotice) => {
  notifier.onPermissionRequest(notice);
});

// Open folder picker for new session.
ipcMain.handle("zb:pick-workspace", async () => {
  if (!mainWindow) return null;
  return folderPicker.pick(mainWindow);
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

async function fetchWorkspaceRoots() {
  if (!currentUrl) return;
  try {
    const res = await fetch(`${currentUrl}v1/capabilities`);
    const data = await res.json();
    if (data.workspaceRoots && Array.isArray(data.workspaceRoots)) {
      folderPicker.setAllowedRoots(data.workspaceRoots);
    }
  } catch {}
}