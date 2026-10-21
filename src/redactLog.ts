import { appendFileSync } from "node:fs";

export function redactLogLine(line: string, secrets: readonly string[] = []): string {
  let out = line;
  for (const secret of secrets) {
    if (secret.length >= 8) out = out.split(secret).join("[redacted]");
  }
  out = out.replace(/authorization:\s*bearer\s+\S+/gi, "authorization: bearer [redacted]");
  out = out.replace(/zb_session=[^;\s]+/gi, "zb_session=[redacted]");
  return out;
}

export function appendRedactedLog(path: string, line: string, secrets: readonly string[] = []): void {
  appendFileSync(path, redactLogLine(line, secrets) + "\n", { mode: 0o600 });
}

// The shell log lives at the injected logs path. The launch token is a secret
// when the line is stored. stderr still receives the line the caller passed.
export function writeShellLog(path: string, line: string, token?: string | null): void {
  const secrets = token && token.length >= 8 ? [token] : [];
  appendRedactedLog(path, line, secrets);
}
