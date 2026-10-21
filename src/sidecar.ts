import { type ChildProcessByStdio, spawn } from "node:child_process";
import { promises as fs, constants as fsConst, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { request as httpRequest } from "node:http";
import { SidecarState } from "./types.js";
import { childEnv } from "./childEnv.js";
import { agentArgsForLaunch } from "./shellConfig.js";
import { listenAddress, unixHealthRequest } from "./listenAddress.js";
import { PRIVATE_DIR_MODE, claimPrivateDir } from "./paths.js";

export interface SidecarOptions {
  bridgeBin: string;
  agentBin: string;
  port: number;
  workspaceRoot?: string;
  tokenDir: string;
  // Optional Unix socket path (from S21). If provided, port is ignored.
  unixSocket?: string;
  // How long kill() waits between SIGTERM and SIGKILL. Tests pass 0.
  killGraceMs?: number;
  // How long to wait for GET /health. A timeout of 0 skips the wait.
  healthTimeoutMs?: number;
  // Test double. The default probe fetches the URL and does not send the token.
  // The signal aborts before the health deadline, so one probe cannot outlive it.
  probeHealth?: (url: string, signal?: AbortSignal) => Promise<boolean>;
  // Unix health probe. The default uses the socket path and GET /health, with no headers.
  probeUnix?: (socketPath: string) => Promise<boolean>;
  // Extra environment names from shell config. Values come from this process.
  passEnv?: readonly string[];
  // Agent argv from shell config. Absent means --agent-arg acp. An empty list means none.
  agentArgs?: readonly string[];
  // Bridge profile from shell config. Absent means no --profile.
  profile?: string;
  // Packaged apps do not inherit ZB_FAKE_*.
  packaged?: boolean;
}

export class SidecarStartError extends Error {
  constructor(readonly state: SidecarState) {
    super(state);
    this.name = "SidecarStartError";
  }
}

export function classifySidecarFailure(stderr: string): SidecarState {
  const text = stderr.toLowerCase();
  if (text.includes("eaddrinuse") || text.includes("address already in use")) return "port-in-use";
  if (text.includes("token file") || text.includes("token must be at least")) return "bad-token";
  if (text.includes("agent command") || text.includes("not executable")) return "agent-not-found";
  return "crashed";
}

async function defaultHealthProbe(url: string, signal?: AbortSignal): Promise<boolean> {
  const res = await fetch(url, { signal });
  return res.ok;
}

async function defaultUnixProbe(socketPath: string): Promise<boolean> {
  const spec = unixHealthRequest(socketPath);
  return new Promise((resolve) => {
    const req = httpRequest(
      { socketPath: spec.socketPath, path: spec.path, method: "GET", headers: spec.headers, timeout: 200 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

export type SidecarSpawn = (
  command: string,
  args: readonly string[],
  options: {
    env: NodeJS.ProcessEnv;
    stdio: ["ignore", "pipe", "pipe"];
    windowsHide: true;
  },
) => ChildProcessByStdio<null, any, any>;

export interface SidecarHandle {
  proc: import("node:child_process").ChildProcessByStdio<null, any, any> | null;
  pid: number | null;
  tokenPath: string;
  token: string;
  port: number;
  state: SidecarState;
  pollHandle?: ReturnType<typeof setInterval>;
  killed: () => Promise<void>;
}

export interface TokenFiles {
  chmod(path: string, mode: number): Promise<void>;
}

const defaultTokenFiles: TokenFiles = {
  chmod: (path, mode) => fs.chmod(path, mode),
};

export class SidecarController {
  private handle: SidecarHandle | null = null;

  constructor(
    private readonly spawnImpl: SidecarSpawn = spawn,
    private readonly files: TokenFiles = defaultTokenFiles,
  ) {}

  private async findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as any).port;
        server.close(() => resolve(port));
      });
      server.on('error', reject);
    });
  }

  async launch(opts: SidecarOptions): Promise<SidecarHandle> {
    const bridgeBin = resolve(opts.bridgeBin);
    const agentBin = resolve(opts.agentBin);
    await mustExistAndExecutable(bridgeBin);
    try {
      await mustExistAndExecutable(agentBin);
    } catch {
      throw new SidecarStartError("agent-not-found");
    }

    listenAddress({ port: opts.port, unixSocket: opts.unixSocket });
    // Resolve ephemeral port if 0. A unix socket does not bind a TCP port.
    const port = !opts.unixSocket && opts.port === 0 ? await this.findFreePort() : opts.port;
    const listen = listenAddress({ port, unixSocket: opts.unixSocket });

    const uid = process.getuid?.();
    if (typeof uid !== "number") throw new Error("uid required");
    await claimPrivateDir(opts.tokenDir, uid);
    const dir = join(opts.tokenDir, randomUUID());
    await fs.mkdir(dir, { recursive: true, mode: PRIVATE_DIR_MODE });
    await this.files.chmod(dir, PRIVATE_DIR_MODE);

    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const tokenPath = join(dir, "token.txt");
    await fs.writeFile(tokenPath, token + "\n", { mode: 0o600 });
    try {
      await this.files.chmod(tokenPath, 0o600);
    } catch (err) {
      await fs.rm(dir, { recursive: true, force: true });
      throw err;
    }

    const args = ["--listen", listen, "--agent-cmd", agentBin];
    for (const arg of agentArgsForLaunch(opts.agentArgs)) {
      args.push("--agent-arg", arg);
    }
    if (opts.profile) args.push("--profile", opts.profile);
    args.push("--token-file", tokenPath, "--permission-timeout", "60s");

    if (opts.workspaceRoot) {
      args.push("--workspace-root", opts.workspaceRoot);
    }

    const env = childEnv(process.env, { passEnv: opts.passEnv, packaged: opts.packaged });
    const grace = opts.killGraceMs ?? 500;
    const proc = this.spawnImpl(bridgeBin, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    const handle: SidecarHandle = {
      proc,
      pid: proc.pid ?? null,
      tokenPath,
      token,
      port,
      state: "starting",
      killed: async () => {
        // Synchronous, before the first await. Electron may exit without waiting.
        removeTokenDir(dir);
        try {
          proc.kill("SIGTERM");
          await new Promise((r) => setTimeout(r, grace));
          if (!proc.killed) proc.kill("SIGKILL");
        } catch {
          // The child is already gone.
        } finally {
          removeTokenDir(dir);
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

    const stderrChunks: Buffer[] = [];
    proc.stdout?.on("data", () => {
      // Stdout is not a health signal. /health is.
    });
    proc.stderr?.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
    });

    const timeout = opts.healthTimeoutMs ?? 5000;
    const probe = opts.probeHealth ?? defaultHealthProbe;
    const probeUnix = opts.probeUnix ?? defaultUnixProbe;
    const healthUrl = `http://127.0.0.1:${port}/health`;
    const deadline = Date.now() + timeout;
    while (timeout > 0 && Date.now() < deadline && handle.state === "starting") {
      const remaining = deadline - Date.now();
      if (remaining <= 1) break;
      // Shorter than the time left, so this probe returns before the deadline.
      const probeMs = remaining - 1;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), probeMs);
      try {
        const healthy = await probeWithin(opts.unixSocket ? probeUnix(opts.unixSocket) : probe(healthUrl, ac.signal), probeMs);
        if (healthy) {
          handle.state = "running";
          break;
        }
      } catch {
        // The probe failed or the abort fired. Wait for the next try or the deadline.
      } finally {
        clearTimeout(timer);
      }
      const pause = Math.min(20, deadline - Date.now());
      if (pause > 0) await new Promise((r) => setTimeout(r, pause));
    }
    if (handle.state === "starting") {
      handle.state = classifySidecarFailure(Buffer.concat(stderrChunks).toString("utf8"));
    }

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

function removeTokenDir(dir: string) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Already gone.
  }
}

function probeWithin(pending: Promise<boolean>, ms: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(false), ms);
    pending.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function mustExistAndExecutable(p: string): Promise<void> {
  try {
    await fs.access(p, fsConst.X_OK);
  } catch {
    throw new Error(`not executable: ${p}`);
  }
}

