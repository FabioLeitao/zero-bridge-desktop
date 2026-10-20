import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, protocol, session, Tray } from "electron";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { SidecarController, SidecarStartError } from "./sidecar.js";
import { ephemeralPort } from "./listenPort.js";
import { errorPageHtml } from "./errorPage.js";
import { singleInstanceDecision } from "./singleInstance.js";
import { loginSession } from "./sessionLogin.js";
import { loadWindowBounds, saveWindowBounds } from "./windowBounds.js";
import { IPC_CHANNELS, SidecarState } from "./types.js";
import { IpcRejected, acceptIncoming, SenderRef } from "./ipcGuard.js";
import { ipcLog } from "./ipcLog.js";
import { resolveAllowedBins } from "./bins.js";
import { defaultTokenDir } from "./tokenDir.js";
import { fetchWorkspaceRoots } from "./workspaceRoots.js";
import { approvedWorkspace } from "./workspaceLaunch.js";
import { testHooks } from "./testEnv.js";
import { rendererLaunchView } from "./launchView.js";
import {
  denyPagePermission,
  denyPermissionCheck,
  navigationDecision,
  windowOpenDecision,
  withShellCsp,
} from "./shellPolicy.js";
import { startHost } from "./startup.js";
import { TrayController } from "./tray.js";
import { PermissionNotifier, PermissionNotice } from "./notifications.js";
import { FolderPicker } from "./folderPicker.js";
import { loginItemSettings } from "./loginItem.js";
import { loginOverUnix, unixInfo, unixProtocolResponse, UNIX_PAGE_ORIGIN } from "./unixPage.js";
import { agentArgsForLaunch, readShellConfig, type ShellConfig } from "./shellConfig.js";
import { shellLocale, shellStrings } from "./shellLocale.js";

let mainWindow: BrowserWindow | null = null;
const controller = new SidecarController();
function assetIcon(name: string): string {
  const candidates = [
    join(import.meta.dirname, "..", "..", "assets", name),
    join(import.meta.dirname, "..", "assets", name),
    join(process.resourcesPath, "assets", name),
  ];
  return candidates.find((path) => existsSync(path)) ?? candidates[0]!;
}

const tray = new TrayController(
  assetIcon("trayTemplate.png"),
  {
    create: (iconPath) => new Tray(iconPath),
    buildMenu: (template) => Menu.buildFromTemplate(template),
  },
  () => {
    void controller.kill().finally(() => app.quit());
  },
);
const notifier = new PermissionNotifier(
  (opts) => new Notification(opts),
  () => testHooks(process.env, app.isPackaged).noteLog,
);
const folderPicker = new FolderPicker();
let currentUrl: string | null = null;
let sidecarTokenPath: string | null = null;
let sidecarToken: string | null = null;
let singleInstanceLock = false;
let shellConfig: ShellConfig = {};

protocol.registerSchemesAsPrivileged([
  {
    scheme: "zb",
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
  },
]);

// Single instance lock (second launch focuses first window).
if (singleInstanceDecision(app.requestSingleInstanceLock()) === "quit") {
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

app.on("ready", async () => {
  await startHost({
    createWindow: () => createWindow(),
    attachTray: () => {
      if (!mainWindow) throw new Error("window missing");
      tray.attach(mainWindow);
    },
    startSidecar: () => continueStartup(),
    log: (line) => console.error(line),
  });
});

async function createWindow() {
  // Security hard code.
  app.commandLine.appendSwitch("disable-features", "TranslateUI");
  const boundsFile = join(app.getPath("userData"), "window-bounds.json");
  const saved = await loadWindowBounds(boundsFile);
  mainWindow = new BrowserWindow({
    ...(saved ? { x: saved.x, y: saved.y } : {}),
    width: saved?.width ?? 1200,
    height: saved?.height ?? 800,
    icon: assetIcon("icon.png"),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      preload: join(import.meta.dirname, "preload.js"),
    },
    show: false,
  });

  notifier.attach(mainWindow);

  // CSP and page permissions. The shell denies every permission request.
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler(denyPagePermission);
  ses.setPermissionCheckHandler(denyPermissionCheck);
  ses.webRequest.onHeadersReceived((details, cb) => {
    cb({ responseHeaders: withShellCsp(details.responseHeaders ?? {}) });
  });

  // Navigation and window.open are denied before startSidecar loads any remote URL.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: windowOpenDecision() }));

  const guardNavigation = (event: { preventDefault(): void }, url: string) => {
    if (navigationDecision(currentUrl, url) === "deny") event.preventDefault();
  };
  mainWindow.webContents.on("will-navigate", guardNavigation);
  mainWindow.webContents.on("will-redirect", guardNavigation);

  // Drop handler on the window (renderer sends path via IPC).
  ipcMain.handle(IPC_CHANNELS.FOLDER_DROP, async (evt, payload) => {
    try {
      const paths = trusted(IPC_CHANNELS.FOLDER_DROP, evt, payload) as string[];
      return folderPicker.handleDrop(paths);
    } catch (err) {
      noteRejection(IPC_CHANNELS.FOLDER_DROP, err, payload);
      return null;
    }
  });

  // Fetch workspace roots from bridge after sidecar is running.
  ipcMain.handle(IPC_CHANNELS.FETCH_WORKSPACE_ROOTS, async (evt, payload) => {
    try {
      trusted(IPC_CHANNELS.FETCH_WORKSPACE_ROOTS, evt, payload);
    } catch (err) {
      noteRejection(IPC_CHANNELS.FETCH_WORKSPACE_ROOTS, err, payload);
      return [];
    }
    await refreshWorkspaceRoots();
    return [...folderPicker.roots()];
  });

  mainWindow.on("close", () => {
    const bounds = mainWindow?.getBounds();
    if (bounds) void saveWindowBounds(boundsFile, bounds);
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());
}

async function continueStartup() {
  const loaded = await readShellConfig(join(app.getPath("userData"), "shell-config.json"));
  shellConfig = loaded.config;
  if (loaded.error) {
    await showSidecarError("crashed", loaded.error);
    return;
  }
  const strings = shellStrings(shellLocale(process.env, shellConfig.locale));
  tray.setLabels(strings);
  notifier.setStrings(strings);
  // Off until the local config opts in. The call uses the desktop session, not extra privilege.
  app.setLoginItemSettings(loginItemSettings(shellConfig.openAtLogin));

  try {
    resolveAllowedBins(process.env, app.isPackaged, shellConfig);
    await startSidecar(await approvedWorkspace(folderPicker.roots(), folderPicker.chosen()));
  } catch (err) {
    if (err instanceof SidecarStartError) {
      await showSidecarError(err.state, "the sidecar did not start");
    } else if (!process.env.ZB_BRIDGE_BIN && !testHooks(process.env, app.isPackaged).bridgeBin) {
      await showSidecarError("agent-not-found", "the sidecar binaries are not configured");
    } else {
      await showSidecarError("crashed", "the sidecar did not start");
    }
  }
}

ipcMain.handle(IPC_CHANNELS.LAUNCH, async (evt, payload) => {
  try {
    trusted(IPC_CHANNELS.LAUNCH, evt, payload);
    return startSidecar(await approvedWorkspace(folderPicker.roots(), folderPicker.chosen()));
  } catch (e) {
    if (e instanceof IpcRejected) {
      noteRejection(IPC_CHANNELS.LAUNCH, e, payload);
      return rendererLaunchView({ ok: false, state: "stopped", error: "rejected" });
    }
    if (e instanceof SidecarStartError) {
      return showSidecarError(e.state, "the sidecar did not start");
    }
    return rendererLaunchView({ ok: false, state: "crashed", error: "launch failed" });
  }
});

// Called by renderer when it sees a permission_request on SSE.
ipcMain.on(IPC_CHANNELS.PERMISSION_REQUEST, (evt, payload) => {
  try {
    const notice = trusted(IPC_CHANNELS.PERMISSION_REQUEST, evt, payload) as PermissionNotice;
    notifier.onPermissionRequest(notice);
  } catch (err) {
    noteRejection(IPC_CHANNELS.PERMISSION_REQUEST, err, payload);
  }
});

// Open folder picker for new session.
ipcMain.handle(IPC_CHANNELS.PICK_WORKSPACE, async (evt, payload) => {
  try {
    trusted(IPC_CHANNELS.PICK_WORKSPACE, evt, payload);
  } catch (err) {
    noteRejection(IPC_CHANNELS.PICK_WORKSPACE, err, payload);
    return null;
  }
  if (!mainWindow) return null;
  return folderPicker.pick(mainWindow, dialog);
});

ipcMain.on(IPC_CHANNELS.QUIT, async (evt, payload) => {
  try {
    trusted(IPC_CHANNELS.QUIT, evt, payload);
  } catch (err) {
    noteRejection(IPC_CHANNELS.QUIT, err, payload);
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

async function startSidecar(workspaceRoot?: string) {
  const hooks = testHooks(process.env, app.isPackaged);
  const bins = resolveAllowedBins(process.env, app.isPackaged, shellConfig);
  const port = ephemeralPort(hooks.port);
  const tokenFromEnv = hooks.tokenFile;
  const tokenDir = tokenFromEnv
    ? String(tokenFromEnv).replace(/token\.txt$/, "")
    : defaultTokenDir(app.getPath("userData"));
  const handle = await controller.launch({
    bridgeBin: bins.bridgeBin,
    agentBin: bins.agentBin,
    port,
    tokenDir,
    workspaceRoot,
    unixSocket: shellConfig.unixSocket,
    passEnv: shellConfig.passEnv,
    agentArgs: agentArgsForLaunch(shellConfig.agentArgs),
    profile: shellConfig.profile,
    packaged: app.isPackaged,
    healthTimeoutMs: 15000,
  });

  if (handle.state !== "running") {
    await controller.kill();
    return showSidecarError(handle.state, "the sidecar did not become healthy");
  }

  sidecarToken = handle.token;
  sidecarTokenPath = handle.tokenPath;
  const unixSocket = shellConfig.unixSocket;

  try {
    const cookie = unixSocket
      ? await loginOverUnix(unixSocket, handle.token)
      : await loginSession(`http://127.0.0.1:${handle.port}/`, handle.token);
    currentUrl = unixSocket ? UNIX_PAGE_ORIGIN : `http://127.0.0.1:${handle.port}/`;
    if (unixSocket) {
      protocol.handle("zb", async (request) => {
        const page = await unixProtocolResponse(unixSocket, { method: request.method, url: request.url });
        const headers = new Headers();
        for (const [key, value] of Object.entries(page.headers)) {
          if (value === undefined || key === "transfer-encoding" || key === "connection") continue;
          headers.set(key, Array.isArray(value) ? value.join(", ") : value);
        }
        return new Response(new Uint8Array(page.body), { status: page.status, headers });
      });
    }
    await session.defaultSession.cookies.set({
      url: currentUrl,
      name: cookie.name,
      value: cookie.value,
      httpOnly: true,
      sameSite: "strict",
      secure: Boolean(unixSocket),
    });
    await mainWindow?.loadURL(currentUrl);
  } catch {
    await controller.kill();
    return showSidecarError("crashed", "the sidecar session was not established");
  }

  mainWindow?.webContents.send(IPC_CHANNELS.STATE, {
    state: handle.state,
    url: currentUrl,
  });
  await refreshWorkspaceRoots();
  return rendererLaunchView({ ok: true, state: handle.state, url: currentUrl });
}

async function showSidecarError(state: SidecarState, detail: string) {
  currentUrl = null;
  sidecarToken = null;
  sidecarTokenPath = null;
  const html = errorPageHtml(state, detail);
  await mainWindow?.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  mainWindow?.webContents.send(IPC_CHANNELS.STATE, { state });
  return rendererLaunchView({ ok: false, state, error: detail });
}

function noteRejection(channel: string, err: unknown, payload: unknown) {
  const reason = err instanceof IpcRejected ? err.message : "rejected";
  ipcLog.record(channel, reason, payload);
}

function trusted(
  channel: string,
  evt: { sender: { id: number }; senderFrame: { routingId: number; url: string } | null },
  payload: unknown,
) {
  if (!mainWindow) throw new IpcRejected(channel, "no window");
  const sender: SenderRef = {
    webContentsId: evt.sender.id,
    frameRoutingId: evt.senderFrame?.routingId ?? -1,
    frameUrl: evt.senderFrame?.url ?? null,
  };
  const expected: SenderRef = {
    webContentsId: mainWindow.webContents.id,
    frameRoutingId: mainWindow.webContents.mainFrame.routingId,
    frameUrl: currentUrl,
  };
  return acceptIncoming(channel, sender, expected, payload);
}

async function refreshWorkspaceRoots() {
  if (!currentUrl || !sidecarToken) {
    folderPicker.setAllowedRoots([]);
    return;
  }
  try {
    const roots = shellConfig.unixSocket
      ? await unixInfo(shellConfig.unixSocket, sidecarToken)
      : await fetchWorkspaceRoots(currentUrl, sidecarToken);
    folderPicker.setAllowedRoots(roots);
  } catch {
    folderPicker.setAllowedRoots([]);
  }
}