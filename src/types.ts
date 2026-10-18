// Shared types between main process and renderer (via preload IPC).
// These are plain JSON shapes; no Electron types leak into the preload allowlist.

export const IPC_CHANNELS = {
  // Renderer asks the main process to start the sidecar.
  LAUNCH: "zb:launch",
  // Sidecar state changes pushed to the renderer.
  STATE: "zb:state",
  // Push a tray/menu label update.
  TRAY: "zb:tray",
  // Ask the main process to quit and stop the sidecar.
  QUIT: "zb:quit",
} as const;

export type Channel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];

export type SidecarState =
  | "stopped"
  | "starting"
  | "running"
  | "crashed"
  | "port-in-use"
  | "bad-token"
  | "agent-not-found"
  | "quitting";

export interface LaunchRequest {
  // Absolute path to the zero-bridge binary. Must exist and be executable.
  bridgeBin: string;
  // Absolute path to the zero binary (agent). Must exist and be executable.
  agentBin: string;
  // Ephemeral loopback port chosen by the caller (or 0 to ask the OS).
  port: number;
  // Directory for the per-launch token file (mode 0600).
  tokenDir: string;
  // Optional workspace root the browser may choose for a new session.
  workspaceRoot?: string;
}

export interface LaunchResult {
  ok: boolean;
  state: SidecarState;
  url?: string;
  tokenPath?: string;
  error?: string;
}

export interface StateEvent {
  state: SidecarState;
  url?: string;
  error?: string;
}

export interface TrayEvent {
  label: string;
  tooltip: string;
}