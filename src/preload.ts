import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./types.js";

contextBridge.exposeInMainWorld("zb", {
  launch: (opts: any) => ipcRenderer.invoke(IPC_CHANNELS.LAUNCH, opts),
  quit: () => ipcRenderer.send(IPC_CHANNELS.QUIT),
  onState: (cb: (e: any) => void) =>
    ipcRenderer.on(IPC_CHANNELS.STATE, (_evt, payload) => cb(payload)),
  offState: (cb: (e: any) => void) =>
    ipcRenderer.removeListener(IPC_CHANNELS.STATE, cb),

  // S23b additions
  // Called by renderer when bridge SSE emits permission_request.
  permissionRequest: (notice: any) => ipcRenderer.send("zb:permission-request", notice),

  // Pick workspace folder for new session (validated against workspaceRoots).
  pickWorkspace: () => ipcRenderer.invoke("zb:pick-workspace"),

  // Handle folder drop (renderer validates via main).
  folderDrop: (paths: string[]) => ipcRenderer.invoke("zb:folder-drop", paths),

  // Fetch workspace roots from bridge /v1/capabilities.
  fetchWorkspaceRoots: () => ipcRenderer.invoke("zb:fetch-workspace-roots"),

  // Permission focus event from native notification click.
  onPermissionFocus: (cb: (e: any) => void) =>
    ipcRenderer.on("zb:permission-focus", (_evt, payload) => cb(payload)),
});