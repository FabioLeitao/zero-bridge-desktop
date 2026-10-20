const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

export function listenAddress(opts: { port: number; unixSocket?: string; tcpHost?: string }): string {
  if (opts.unixSocket) {
    if (!opts.unixSocket.startsWith("/")) {
      throw new Error("unix listen path must be absolute");
    }
    return `unix:${opts.unixSocket}`;
  }
  const host = opts.tcpHost ?? "127.0.0.1";
  if (!LOOPBACK.has(host)) {
    throw new Error("listen address must be loopback");
  }
  return host.includes(":") ? `[${host}]:${opts.port}` : `${host}:${opts.port}`;
}

export function unixHealthRequest(socketPath: string): {
  socketPath: string;
  path: "/health";
  headers: Record<string, never>;
} {
  return { socketPath, path: "/health", headers: {} };
}
