// Workspace roots come from the bridge, with the bearer token kept in the main process.
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, sep } from "node:path";

export interface FetchLike {
  (url: URL, init?: { headers?: Record<string, string> }): Promise<{
    ok: boolean;
    json(): Promise<unknown>;
  }>;
}

export async function fetchWorkspaceRoots(
  baseUrl: string,
  token: string,
  fetchImpl: FetchLike = fetch,
): Promise<string[]> {
  const url = new URL("/v1/info", baseUrl);
  const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const data = (await res.json()) as { workspaceRoots?: unknown };
  if (!Array.isArray(data.workspaceRoots)) return [];
  return data.workspaceRoots.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export function isInsideRoot(rootReal: string, chosenReal: string): boolean {
  const rel = relative(rootReal, chosenReal);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export async function pathAllowed(
  roots: readonly string[],
  chosen: string,
  realpathImpl: (path: string) => Promise<string> = realpath,
): Promise<boolean> {
  if (roots.length === 0) return false;
  let chosenReal: string;
  try {
    chosenReal = await realpathImpl(chosen);
  } catch {
    return false;
  }
  for (const root of roots) {
    let rootReal: string;
    try {
      rootReal = await realpathImpl(root);
    } catch {
      continue;
    }
    if (isInsideRoot(rootReal, chosenReal)) return true;
  }
  return false;
}
