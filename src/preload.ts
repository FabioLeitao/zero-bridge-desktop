import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./types.js";

contextBridge.exposeInMainWorld("zb", {
  launch: (payload?: { workspaceRoot?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.LAUNCH, payload),
  quit: () => ipcRenderer.send(IPC_CHANNELS.QUIT),
  onState: (cb: (e: any) => void) =>
    ipcRenderer.on(IPC_CHANNELS.STATE, (_evt, payload) => cb(payload)),
  offState: (cb: (e: any) => void) =>
    ipcRenderer.removeListener(IPC_CHANNELS.STATE, cb),

  // S23b additions
  // Called by renderer when bridge SSE emits permission_request.
  permissionRequest: (notice: { toolTitle: string; sessionId: string; reqId: string }) =>
    ipcRenderer.send(IPC_CHANNELS.PERMISSION_REQUEST, notice),

  // Pick workspace folder for new session (validated against workspaceRoots).
  pickWorkspace: () => ipcRenderer.invoke(IPC_CHANNELS.PICK_WORKSPACE),

  // Handle folder drop (renderer validates via main).
  folderDrop: (paths: string[]) => ipcRenderer.invoke(IPC_CHANNELS.FOLDER_DROP, paths),

  // Fetch workspace roots from bridge /v1/capabilities.
  fetchWorkspaceRoots: () => ipcRenderer.invoke(IPC_CHANNELS.FETCH_WORKSPACE_ROOTS),

  // Permission focus event from native notification click.
  onPermissionFocus: (cb: (e: any) => void) =>
    ipcRenderer.on(IPC_CHANNELS.PERMISSION_FOCUS, (_evt, payload) => cb(payload)),
});