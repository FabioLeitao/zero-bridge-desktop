import path from "node:path";

export const PRIVATE_DIR_MODE = 0o700;

export interface ShellPathInput {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  userData: string;
  logs: string;
  tmpdir: string;
}

export interface ShellPaths {
  userData: string;
  configFile: string;
  boundsFile: string;
  logFile: string;
  runtimeDir: string;
  tokenDir: string;
  socketPath: string;
}

export function shellPaths(input: ShellPathInput): ShellPaths {
  if (!input.userData) throw new Error("userData required");
  if (!input.logs) throw new Error("logs required");
  if (!input.tmpdir) throw new Error("tmpdir required");
  const fsPath = input.platform === "win32" ? path.win32 : path.posix;
  const runtimeDir = runtimeDirFor(input, fsPath);
  return {
    userData: input.userData,
    configFile: fsPath.join(input.userData, "shell-config.json"),
    boundsFile: fsPath.join(input.userData, "window-bounds.json"),
    logFile: fsPath.join(input.logs, "shell.log"),
    runtimeDir,
    tokenDir: runtimeDir,
    socketPath: fsPath.join(runtimeDir, "bridge.sock"),
  };
}

function runtimeDirFor(input: ShellPathInput, fsPath: path.PlatformPath): string {
  if (input.platform === "linux") {
    const xdg = input.env.XDG_RUNTIME_DIR;
    if (typeof xdg === "string" && xdg.length > 0 && fsPath.isAbsolute(xdg) && !xdg.includes("\0")) {
      return fsPath.join(xdg, "zero-bridge");
    }
  }
  return fsPath.join(input.tmpdir, "zero-bridge");
}
