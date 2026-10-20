export interface SessionCookie {
  name: string;
  value: string;
}

export function sessionCookieFromSetCookie(lines: string[]): SessionCookie | null {
  for (const line of lines) {
    const pair = line.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (name === "zb_session" && value.length > 0) return { name, value };
  }
  return null;
}

type LoginResponse = {
  ok: boolean;
  headers: { getSetCookie?: () => string[] };
};

export async function loginSession(
  baseUrl: string,
  token: string,
  fetchImpl: (url: URL, init: { method: string; headers: Record<string, string>; body: string }) => Promise<LoginResponse> = fetch as never,
): Promise<SessionCookie> {
  const url = new URL("/v1/login", baseUrl);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1") {
    throw new Error("login failed");
  }
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error("login failed");
  const cookie = sessionCookieFromSetCookie(res.headers.getSetCookie?.() ?? []);
  if (!cookie) throw new Error("login failed");
  return cookie;
}
