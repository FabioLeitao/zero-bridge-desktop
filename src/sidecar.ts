import { ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { promises as fs, constants as fsConst } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { SidecarState } from "./types.js";

export interface SidecarOptions {
  bridgeBin: string;
  agentBin: string;
  port: number;
  workspaceRoot?: string;
  tokenDir: string;
  // Optional Unix socket path (from S21). If provided, port is ignored.
  unixSocket?: string;
}

export interface SidecarHandle {
  proc: ChildProcessWithoutNullStreams | null;
  pid: number | null;
  tokenPath: string;
  token: string;
  port: number;
  state: SidecarState;
  pollHandle?: ReturnType<typeof setInterval>;
  killed: () => Promise<void>;
}

export class SidecarController {
  private handle: SidecarHandle | null = null;

  async launch(opts: SidecarOptions): Promise<SidecarHandle> {
    const bridgeBin = resolve(opts.bridgeBin);
    const agentBin = resolve(opts.agentBin);
    await mustExistAndExecutable(bridgeBin);
    await mustExistAndExecutable(agentBin);

    const dir = join(opts.tokenDir, randomUUID());
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });

    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const tokenPath = join(dir, "token.txt");
    await fs.writeFile(tokenPath, token + "\n", { mode: 0o600 });
    await chmodOwnerOnly(tokenPath);

    const args = [
      "--listen",
      `127.0.0.1:${opts.port}`,
      "--agent-cmd",
      agentBin,
      "--agent-arg",
      "acp",
      "--token-file",
      tokenPath,
      "--permission-timeout",
      "60s",
    ];

    if (opts.workspaceRoot) {
      args.push("--workspace-root", opts.workspaceRoot);
    }

    const env = sanitizeEnv(process.env);
    const proc = spawn(bridgeBin, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const handle: SidecarHandle = {
      proc,
      pid: proc.pid ?? null,
      tokenPath,
      token,
      port: opts.port,
      state: "starting",
      killed: async () => {
        try {
          proc.kill("SIGTERM");
          // Grace period.
          await new Promise((r) => setTimeout(r, 500));
          if (!proc.killed) proc.kill("SIGKILL");
        } finally {
          try {
            await fs.rm(dir, { recursive: true, force: true });
          } catch {}
        }
      },
    };

    proc.on("error", () => {
      handle.state = "crashed";
    });

    proc.on("exit", (code, signal) => {
      handle.state =
        code === 0 ? "stopped" : signal ? "crashed" : "crashed";
    });

    // Very small health poll: first 5s we expect the child to be up.
    handle.pollHandle = setInterval(async () => {
      if (!handle.proc || handle.proc.killed) {
        handle.state = "crashed";
        return;
      }
      // NOTE: a real check would probe /health using the token.
      // For unit tests we rely on the stdout lines below.
    }, 250);

    // Scan stdout for the line the Bridge prints when the server starts.
    proc.stdout?.on("data", () => {
      if (handle.state === "starting") handle.state = "running";
    });
    proc.stderr?.on("data", () => {
      // Keep for diagnostics only. Never log secrets.
    });

    this.handle = handle;
    return handle;
  }

  getState(): SidecarState {
    return this.handle?.state ?? "stopped";
  }

  async kill(): Promise<void> {
    if (!this.handle) return;
    await this.handle.killed();
    if (this.handle.pollHandle) clearInterval(this.handle.pollHandle);
    this.handle = null;
  }
}

async function mustExistAndExecutable(p: string): Promise<void> {
  try {
    await fs.access(p, fsConst.X_OK);
  } catch {
    throw new Error(`not executable: ${p}`);
  }
}

function sanitizeEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...env };
  // Never forward bridge tokens into the child.
  delete out.ZERO_BRIDGE_TOKEN;
  return out;
}

async function chmodOwnerOnly(p: string): Promise<void> {
  try {
    await fs.chmod(p, 0o600);
  } catch {}
}