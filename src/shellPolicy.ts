// Decisions the main process applies to the window. Tested without Electron.
import { sameOrigin } from "./origin.js";

export const SHELL_CSP =
  "default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'";

export function withShellCsp(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value : [value];
  }
  out["Content-Security-Policy"] = [SHELL_CSP];
  return out;
}

export function navigationDecision(currentUrl: string | null, target: string): "allow" | "deny" {
  if (!currentUrl) return "deny";
  let base: URL;
  let dest: URL;
  try {
    base = new URL(currentUrl);
    dest = new URL(target);
  } catch {
    return "deny";
  }
  return sameOrigin(base, dest) ? "allow" : "deny";
}

export function windowOpenDecision(): "deny" {
  return "deny";
}

export function denyPagePermission(
  _contents: unknown,
  _permission: string,
  callback: (allowed: boolean) => void,
): void {
  callback(false);
}

export function denyPermissionCheck(): boolean {
  return false;
}
