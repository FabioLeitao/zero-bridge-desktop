import { readFile } from "node:fs/promises";
import { refusedEnvName } from "./childEnv.js";

export interface ShellConfig {
  bridgeBin?: string;
  agentBin?: string;
  unixSocket?: string;
  openAtLogin?: boolean;
  locale?: "en" | "pt-BR";
  passEnv?: string[];
}

const REJECTED = new Set(["token", "tokenPath", "tokenFile", "authorization"]);

export function parseShellConfig(text: string): ShellConfig {
  const raw = JSON.parse(text) as unknown;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("shell config must be an object");
  }
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (REJECTED.has(key)) throw new Error("shell config rejects secrets");
  }
  const out: ShellConfig = {};
  if (typeof record.bridgeBin === "string" && record.bridgeBin.length > 0) out.bridgeBin = record.bridgeBin;
  if (typeof record.agentBin === "string" && record.agentBin.length > 0) out.agentBin = record.agentBin;
  if (typeof record.unixSocket === "string" && record.unixSocket.length > 0) {
    if (!record.unixSocket.startsWith("/")) throw new Error("unix listen path must be absolute");
    out.unixSocket = record.unixSocket;
  }
  if (typeof record.openAtLogin === "boolean") out.openAtLogin = record.openAtLogin;
  if (record.locale === "en" || record.locale === "pt-BR") out.locale = record.locale;
  if (record.passEnv !== undefined) {
    if (!Array.isArray(record.passEnv)) throw new Error("passEnv name refused");
    const names: string[] = [];
    for (const item of record.passEnv) {
      if (typeof item !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(item) || refusedEnvName(item)) {
        throw new Error("passEnv name refused");
      }
      names.push(item);
    }
    out.passEnv = names;
  }
  return out;
}

export async function loadShellConfig(path: string): Promise<ShellConfig> {
  try {
    return parseShellConfig(await readFile(path, "utf8"));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return {};
    throw err;
  }
}
