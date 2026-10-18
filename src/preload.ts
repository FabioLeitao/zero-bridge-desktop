import { contextBridge, ipcRenderer } from "electron";
import { IPC_CHANNELS } from "./types.js";

contextBridge.exposeInMainWorld("zb", {
  launch: (opts: any) => ipcRenderer.invoke(IPC_CHANNELS.LAUNCH, opts),
  quit: () => ipcRenderer.send(IPC_CHANNELS.QUIT),
  onState: (cb: (e: any) => void) =>
    ipcRenderer.on(IPC_CHANNELS.STATE, (_evt, payload) => cb(payload)),
  offState: (cb: (e: any) => void) =>
    ipcRenderer.removeListener(IPC_CHANNELS.STATE, cb),
});