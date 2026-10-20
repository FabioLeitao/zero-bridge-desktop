import { request as httpRequest } from "node:http";
import { sessionCookieFromSetCookie, type SessionCookie } from "./sessionLogin.js";

export const UNIX_PAGE_ORIGIN = "zb://bridge/";

interface UnixResult {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

export async function unixHttp(
  socketPath: string,
  spec: { method: string; path: string; headers?: Record<string, string>; body?: string },
): Promise<UnixResult> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      {
        socketPath,
        path: spec.path,
        method: spec.method,
        headers: spec.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string | string[] | undefined>,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", reject);
    if (spec.body) req.write(spec.body);
    req.end();
  });
}

export async function loginOverUnix(socketPath: string, token: string): Promise<SessionCookie> {
  const res = await unixHttp(socketPath, {
    method: "POST",
    path: "/v1/login",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (res.status < 200 || res.status >= 300) throw new Error("login failed");
  const raw = res.headers["set-cookie"];
  const lines = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = sessionCookieFromSetCookie(lines);
  if (!cookie) throw new Error("login failed");
  return cookie;
}

export async function unixInfo(socketPath: string, token: string): Promise<string[]> {
  const res = await unixHttp(socketPath, {
    method: "GET",
    path: "/v1/info",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status < 200 || res.status >= 300) return [];
  const data = JSON.parse(res.body.toString("utf8")) as { workspaceRoots?: unknown };
  if (!Array.isArray(data.workspaceRoots)) return [];
  return data.workspaceRoots.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export async function unixProtocolResponse(
  socketPath: string,
  request: { method: string; url: string },
): Promise<UnixResult> {
  const url = new URL(request.url);
  if (url.protocol !== "zb:" || url.hostname !== "bridge") {
    throw new Error("unix page origin refused");
  }
  const path = `${url.pathname}${url.search}`;
  return unixHttp(socketPath, { method: request.method, path });
}
