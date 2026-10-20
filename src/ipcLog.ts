// Observable rejection count. The line is channel, reason, and count.
// The payload is accepted so callers can pass it and tests can prove it is dropped.
import { IPC_CHANNELS } from "./types.js";

const CHANNELS = new Set<string>(Object.values(IPC_CHANNELS));
const REASONS = new Set([
  "sender",
  "origin",
  "unknown channel",
  "not an incoming channel",
  "forbidden field",
  "unexpected payload",
  "paths",
  "fields",
  "string",
  "payload",
  "no window",
  "rejected",
]);

export function rejectionLine(channel: string, reason: string, _payload?: unknown): string {
  const safeChannel = CHANNELS.has(channel) ? channel : "unknown";
  const safeReason = REASONS.has(reason) ? reason : "rejected";
  return `ipc rejected channel=${safeChannel} reason=${safeReason}`;
}

export class RejectionLog {
  private counts = new Map<string, number>();

  constructor(private readonly sink: (line: string) => void = (line) => console.error(line)) {}

  record(channel: string, reason: string, payload?: unknown): void {
    const line = rejectionLine(channel, reason, payload);
    const count = (this.counts.get(line) ?? 0) + 1;
    this.counts.set(line, count);
    this.sink(`${line} count=${count}`);
  }
}

export const ipcLog = new RejectionLog();
