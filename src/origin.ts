// Origin allowlist for the browser window.
// The window may only navigate to the sidecar origin (http://127.0.0.1:<port>).
// Anything else is denied by the will-navigate handler and setWindowOpenHandler.

import { URL } from "node:url";

const LOCALHOST = new Set(["127.0.0.1", "::1", "localhost", "[::1]"]);

export function parseOrigin(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error(`unsupported protocol`);
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error(`unsupported protocol: ${u.protocol}`);
  }
  return u;
}

export function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  // Handle IPv6 in brackets: [::1]:8765 -> ::1
  // Handle IPv6 without brackets: ::1 -> ::1
  // Handle IPv4: 127.0.0.1:8765 -> 127.0.0.1
  let h: string;
  if (host.startsWith("[")) {
    const bracketEnd = host.indexOf("]");
    h = bracketEnd >= 0 ? host.substring(1, bracketEnd) : host;
  } else if (host.includes(".")) {
    // IPv4: split on first colon for port
    h = host.split(":")[0];
  } else {
    // IPv6 without brackets: no port expected here, use as-is
    // If there's a port, it would be like :::1 which is invalid
    h = host;
  }
  return LOCALHOST.has(h.toLowerCase());
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