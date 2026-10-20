// One checker for every IPC channel: expected webContents, expected frame, payload shape.
import { Channel, IPC_CHANNELS } from "./types.js";

export interface SenderRef {
  webContentsId: number;
  frameRoutingId: number;
}

export class IpcRejected extends Error {
  readonly channel: string;
  constructor(channel: string, message: string) {
    super(message);
    this.name = "IpcRejected";
    this.channel = channel;
  }
}

const INCOMING = new Set<string>([
  IPC_CHANNELS.LAUNCH,
  IPC_CHANNELS.QUIT,
  IPC_CHANNELS.FOLDER_DROP,
  IPC_CHANNELS.FETCH_WORKSPACE_ROOTS,
  IPC_CHANNELS.PERMISSION_REQUEST,
  IPC_CHANNELS.PICK_WORKSPACE,
]);

const KNOWN = new Set<string>(Object.values(IPC_CHANNELS));

const LAUNCH_FORBIDDEN = new Set([
  "bridgeBin",
  "agentBin",
  "tokenDir",
  "port",
  "token",
  "tokenPath",
  "unixSocket",
]);

export interface LaunchBody {
  workspaceRoot?: string;
}

export function acceptIncoming(
  channel: string,
  sender: SenderRef,
  expected: SenderRef,
  payload: unknown,
): LaunchBody | string[] | { toolTitle: string; sessionId: string; reqId: string } | undefined {
  if (!KNOWN.has(channel)) throw new IpcRejected(channel, "unknown channel");
  if (!INCOMING.has(channel)) throw new IpcRejected(channel, "not an incoming channel");
  if (!sameSender(sender, expected)) throw new IpcRejected(channel, "sender");
  return parsePayload(channel as Channel, payload);
}

function sameSender(sender: SenderRef, expected: SenderRef): boolean {
  return (
    Number.isInteger(sender.webContentsId) &&
    Number.isInteger(sender.frameRoutingId) &&
    sender.webContentsId === expected.webContentsId &&
    sender.frameRoutingId === expected.frameRoutingId &&
    sender.webContentsId > 0 &&
    sender.frameRoutingId > 0
  );
}

function parsePayload(channel: Channel, payload: unknown) {
  switch (channel) {
    case IPC_CHANNELS.LAUNCH:
      return parseLaunch(payload);
    case IPC_CHANNELS.FOLDER_DROP:
      return parsePaths(payload);
    case IPC_CHANNELS.PERMISSION_REQUEST:
      return parseNotice(payload);
    case IPC_CHANNELS.QUIT:
    case IPC_CHANNELS.FETCH_WORKSPACE_ROOTS:
    case IPC_CHANNELS.PICK_WORKSPACE:
      if (payload !== undefined && payload !== null) {
        throw new IpcRejected(channel, "unexpected payload");
      }
      return undefined;
    default:
      throw new IpcRejected(channel, "not an incoming channel");
  }
}

function parseLaunch(payload: unknown): LaunchBody {
  if (payload === undefined || payload === null) return {};
  const obj = plain(payload, IPC_CHANNELS.LAUNCH);
  for (const key of Object.keys(obj)) {
    if (LAUNCH_FORBIDDEN.has(key)) throw new IpcRejected(IPC_CHANNELS.LAUNCH, "forbidden field");
    if (key !== "workspaceRoot") throw new IpcRejected(IPC_CHANNELS.LAUNCH, "unknown field");
  }
  if (obj.workspaceRoot === undefined) return {};
  return { workspaceRoot: bounded(obj.workspaceRoot, IPC_CHANNELS.LAUNCH, 4096) };
}

function parsePaths(payload: unknown): string[] {
  if (!Array.isArray(payload) || payload.length < 1 || payload.length > 8) {
    throw new IpcRejected(IPC_CHANNELS.FOLDER_DROP, "paths");
  }
  return payload.map((item) => bounded(item, IPC_CHANNELS.FOLDER_DROP, 4096));
}

function parseNotice(payload: unknown): { toolTitle: string; sessionId: string; reqId: string } {
  const obj = plain(payload, IPC_CHANNELS.PERMISSION_REQUEST);
  const keys = Object.keys(obj).sort();
  if (keys.join(",") !== "reqId,sessionId,toolTitle") {
    throw new IpcRejected(IPC_CHANNELS.PERMISSION_REQUEST, "fields");
  }
  return {
    toolTitle: bounded(obj.toolTitle, IPC_CHANNELS.PERMISSION_REQUEST, 200),
    sessionId: bounded(obj.sessionId, IPC_CHANNELS.PERMISSION_REQUEST, 200),
    reqId: bounded(obj.reqId, IPC_CHANNELS.PERMISSION_REQUEST, 200),
  };
}

function plain(payload: unknown, channel: string): Record<string, unknown> {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new IpcRejected(channel, "payload");
  }
  const proto = Object.getPrototypeOf(payload);
  if (proto !== Object.prototype && proto !== null) {
    throw new IpcRejected(channel, "payload");
  }
  return payload as Record<string, unknown>;
}

function bounded(value: unknown, channel: string, max: number): string {
  if (typeof value !== "string" || value.length < 1 || value.length > max || value.includes("\0")) {
    throw new IpcRejected(channel, "string");
  }
  return value;
}
