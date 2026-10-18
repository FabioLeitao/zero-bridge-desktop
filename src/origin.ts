// Origin allowlist for the browser window.
// The window may only navigate to the sidecar origin (http://127.0.0.1:<port>).
// Anything else is denied by the will-navigate handler and setWindowOpenHandler.

import { URL } from "node:url";

const LOCALHOST = new Set(["127.0.0.1", "::1", "localhost"]);

export function parseOrigin(raw: string): URL {
  const u = new URL(raw);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`unsupported protocol: ${u.protocol}`);
  }
  return u;
}

export function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  const h = host.split(":")[0].toLowerCase();
  return LOCALHOST.has(h);
}

export function sameOrigin(a: URL, b: URL): boolean {
  return (
    a.protocol === b.protocol &&
    a.hostname === b.hostname &&
    (a.port || defaultPort(a.protocol)) ===
      (b.port || defaultPort(b.protocol))
  );
}

function defaultPort(protocol: string): string {
  return protocol === "https:" ? "443" : "80";
}

export function sidecarOrigin(port: number | string): URL {
  return new URL(`http://127.0.0.1:${port}/`);
}