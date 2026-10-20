import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, session, Tray } from "electron";
import { join } from "node:path";
import { SidecarController } from "./sidecar.js";
import { sidecarOrigin, isLoopbackHost, sameOrigin } from "./origin.js";
import { IPC_CHANNELS } from "./types.js";
import { IpcRejected, acceptIncoming, SenderRef } from "./ipcGuard.js";
import { resolveAllowedBins } from "./bins.js";
import { defaultTokenDir } from "./tokenDir.js";
import { rendererLaunchView } from "./launchView.js";
import { TrayController } from "./tray.js";
import { PermissionNotifier, PermissionNotice } from "./notifications.js";
import { FolderPicker } from "./folderPicker.js";

let mainWindow: BrowserWindow | null = null;
const controller = new SidecarController();
const tray = new TrayController(join(import.meta.dirname, "..", "assets", "icon.png"), {
  create: (iconPath) => new Tray(iconPath),
  buildMenu: (template) => Menu.buildFromTemplate(template),
});
const notifier = new PermissionNotifier((opts) => new Notification(opts));
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
  ipcMain.handle(IPC_CHANNELS.FOLDER_DROP, async (evt, payload) => {
    try {
      const paths = trusted(IPC_CHANNELS.FOLDER_DROP, evt, payload) as string[];
      return folderPicker.handleDrop(paths);
    } catch {
      return null;
    }
  });

  // Fetch workspace roots from bridge after sidecar is running.
  ipcMain.handle(IPC_CHANNELS.FETCH_WORKSPACE_ROOTS, async (evt, payload) => {
    try {
      trusted(IPC_CHANNELS.FETCH_WORKSPACE_ROOTS, evt, payload);
    } catch {
      return [];
    }
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

ipcMain.handle(IPC_CHANNELS.LAUNCH, async (evt, payload) => {
  try {
    const body = trusted(IPC_CHANNELS.LAUNCH, evt, payload) as { workspaceRoot?: string };
    const bins = resolveAllowedBins(process.env);
    const port = Number(process.env.ZB_E2E_PORT || "0") || 8765;
    const tokenFromEnv = process.env.ZB_E2E_TOKEN_FILE;
    const tokenDir = tokenFromEnv
      ? String(tokenFromEnv).replace(/token\.txt$/, "")
      : defaultTokenDir(app.getPath("userData"));
    const handle = await controller.launch({
      bridgeBin: bins.bridgeBin,
      agentBin: bins.agentBin,
      port,
      tokenDir,
      workspaceRoot: body.workspaceRoot,
    });

    sidecarTokenPath = handle.tokenPath;
    currentUrl = `http://127.0.0.1:${port}/`;

    mainWindow?.webContents.send(IPC_CHANNELS.STATE, {
      state: handle.state,
      url: currentUrl,
    });

    // Fetch workspace roots for folder picker validation.
    await fetchWorkspaceRoots();

    return rendererLaunchView({ ok: true, state: handle.state, url: currentUrl });
  } catch (e) {
    if (e instanceof IpcRejected) {
      return rendererLaunchView({ ok: false, state: "stopped", error: "rejected" });
    }
    return rendererLaunchView({ ok: false, state: "crashed", error: "launch failed" });
  }
});

// Called by renderer when it sees a permission_request on SSE.
ipcMain.on(IPC_CHANNELS.PERMISSION_REQUEST, (evt, payload) => {
  try {
    const notice = trusted(IPC_CHANNELS.PERMISSION_REQUEST, evt, payload) as PermissionNotice;
    notifier.onPermissionRequest(notice);
  } catch {
    // Rejected sender or payload. No notification.
  }
});

// Open folder picker for new session.
ipcMain.handle(IPC_CHANNELS.PICK_WORKSPACE, async (evt, payload) => {
  try {
    trusted(IPC_CHANNELS.PICK_WORKSPACE, evt, payload);
  } catch {
    return null;
  }
  if (!mainWindow) return null;
  return folderPicker.pick(mainWindow, dialog);
});

ipcMain.on(IPC_CHANNELS.QUIT, async (evt, payload) => {
  try {
    trusted(IPC_CHANNELS.QUIT, evt, payload);
  } catch {
    return;
  }
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

function trusted(
  channel: string,
  evt: { sender: { id: number }; senderFrame: { routingId: number } | null },
  payload: unknown,
) {
  if (!mainWindow) throw new IpcRejected(channel, "no window");
  const sender: SenderRef = {
    webContentsId: evt.sender.id,
    frameRoutingId: evt.senderFrame?.routingId ?? -1,
  };
  const expected: SenderRef = {
    webContentsId: mainWindow.webContents.id,
    frameRoutingId: mainWindow.webContents.mainFrame.routingId,
  };
  return acceptIncoming(channel, sender, expected, payload);
}

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