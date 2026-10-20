import { lstat, mkdir, chmod } from "node:fs/promises";
import path from "node:path";

export const PRIVATE_DIR_MODE = 0o700;

export interface ShellPathInput {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  userData: string;
  logs: string;
  tmpdir: string;
  uid?: number;
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
  if (input.platform === "win32") return fsPath.join(input.tmpdir, "zero-bridge");
  const uid = input.uid ?? process.getuid?.();
  if (typeof uid !== "number") throw new Error("uid required");
  return fsPath.join(input.tmpdir, `zero-bridge-${uid}`);
}

export interface DirStat {
  isSymbolicLink(): boolean;
  isDirectory(): boolean;
  uid: number;
  mode: number;
}

export interface PrivateDirIo {
  lstat(path: string): Promise<DirStat>;
  mkdir(path: string, mode: number): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
}

const defaultPrivateDirIo: PrivateDirIo = {
  lstat: (dir) => lstat(dir),
  mkdir: (dir, mode) => mkdir(dir, { mode }),
  chmod: (dir, mode) => chmod(dir, mode),
};

export async function claimPrivateDir(dir: string, uid: number, io: PrivateDirIo = defaultPrivateDirIo): Promise<void> {
  let stat: DirStat;
  try {
    stat = await io.lstat(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    try {
      await io.mkdir(dir, PRIVATE_DIR_MODE);
    } catch (mk) {
      if ((mk as NodeJS.ErrnoException).code !== "EEXIST") throw mk;
    }
    stat = await io.lstat(dir);
    refuseUnsafe(stat);
    await io.chmod(dir, PRIVATE_DIR_MODE);
    stat = await io.lstat(dir);
  }
  refuseUnsafe(stat);
  if (stat.uid !== uid) throw new Error("runtime directory refused: owner");
  if ((stat.mode & 0o777) !== PRIVATE_DIR_MODE) throw new Error("runtime directory refused: mode");
}

function refuseUnsafe(stat: DirStat): void {
  if (stat.isSymbolicLink()) throw new Error("runtime directory refused: symlink");
  if (!stat.isDirectory()) throw new Error("runtime directory refused: not a directory");
}
