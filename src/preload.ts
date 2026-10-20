import { contextBridge, ipcRenderer, webUtils } from "electron";
import { IPC_CHANNELS } from "./types.js";
import { noticeFromCard } from "./permissionCard.js";

contextBridge.exposeInMainWorld("zb", {
  launch: () => ipcRenderer.invoke(IPC_CHANNELS.LAUNCH),
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

  // Fetch workspace roots. The bearer token stays in the main process.
  fetchWorkspaceRoots: () => ipcRenderer.invoke(IPC_CHANNELS.FETCH_WORKSPACE_ROOTS),

  // Permission focus event from native notification click.
  onPermissionFocus: (cb: (e: any) => void) =>
    ipcRenderer.on(IPC_CHANNELS.PERMISSION_FOCUS, (_evt, payload) => cb(payload)),
});

// The page cannot pass an arbitrary path. The isolated preload reads the
// dropped File and sends that path to the main process.
window.addEventListener("DOMContentLoaded", () => {
  document.addEventListener("dragover", (event) => {
    event.preventDefault();
  });
  document.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    const paths: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const path = webUtils.getPathForFile(files[i]);
      if (path) paths.push(path);
    }
    if (paths.length === 0) return;
    void ipcRenderer.invoke(IPC_CHANNELS.FOLDER_DROP, paths);
  });

  const seen = new Set<string>();
  const scan = () => {
    document.querySelectorAll("section.perm").forEach((card) => {
      const title = card.querySelector("p")?.textContent ?? "";
      const labelledBy = card.getAttribute("aria-labelledby") ?? "";
      const notice = noticeFromCard(title, labelledBy);
      if (!notice || seen.has(notice.reqId)) return;
      seen.add(notice.reqId);
      ipcRenderer.send(IPC_CHANNELS.PERMISSION_REQUEST, notice);
    });
  };
  scan();
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
});