import { type ChildProcessByStdio, spawn } from "node:child_process";
import { promises as fs, constants as fsConst } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { request as httpRequest } from "node:http";
import { SidecarState } from "./types.js";
import { childEnv } from "./childEnv.js";
import { listenAddress, unixHealthRequest } from "./listenAddress.js";

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
  // How long to wait for GET /health. Zero skips the wait.
  healthTimeoutMs?: number;
  // Test double. The default probe fetches the URL and does not send the token.
  probeHealth?: (url: string) => Promise<boolean>;
  // Unix health probe. The default uses the socket path and GET /health, with no headers.
  probeUnix?: (socketPath: string) => Promise<boolean>;
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

async function defaultHealthProbe(url: string): Promise<boolean> {
  const res = await fetch(url);
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

    const dir = join(opts.tokenDir, randomUUID());
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await this.files.chmod(dir, 0o700);

    const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
    const tokenPath = join(dir, "token.txt");
    await fs.writeFile(tokenPath, token + "\n", { mode: 0o600 });
    try {
      await this.files.chmod(tokenPath, 0o600);
    } catch (err) {
      await fs.rm(dir, { recursive: true, force: true });
      throw err;
    }

    const args = [
      "--listen",
      listen,
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

    const env = childEnv(process.env);
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
        try {
          proc.kill("SIGTERM");
          // Grace period.
          await new Promise((r) => setTimeout(r, grace));
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
      try {
        const healthy = opts.unixSocket ? await probeUnix(opts.unixSocket) : await probe(healthUrl);
        if (healthy) {
          handle.state = "running";
          break;
        }
      } catch {
        // The probe failed. Wait for the next try or the deadline.
      }
      await new Promise((r) => setTimeout(r, 20));
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

async function mustExistAndExecutable(p: string): Promise<void> {
  try {
    await fs.access(p, fsConst.X_OK);
  } catch {
    throw new Error(`not executable: ${p}`);
  }
}

