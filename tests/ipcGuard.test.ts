import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { IPC_CHANNELS } from "../src/types.js";
import { IpcRejected, acceptIncoming } from "../src/ipcGuard.js";
import { resolveAllowedBins } from "../src/bins.js";
import { executable } from "./executable.js";

const origin = "http://127.0.0.1:9/";
const expected = { webContentsId: 4, frameRoutingId: 8, frameUrl: origin };
const sender = { webContentsId: 4, frameRoutingId: 8, frameUrl: origin };
const other = { webContentsId: 4, frameRoutingId: 9, frameUrl: origin };

const incoming = [
  IPC_CHANNELS.LAUNCH,
  IPC_CHANNELS.QUIT,
  IPC_CHANNELS.FOLDER_DROP,
  IPC_CHANNELS.FETCH_WORKSPACE_ROOTS,
  IPC_CHANNELS.PERMISSION_REQUEST,
  IPC_CHANNELS.PICK_WORKSPACE,
];

const outgoing = [IPC_CHANNELS.STATE, IPC_CHANNELS.TRAY, IPC_CHANNELS.PERMISSION_FOCUS];

function goodPayload(channel: string): unknown {
  switch (channel) {
    case IPC_CHANNELS.LAUNCH:
      return undefined;
    case IPC_CHANNELS.FOLDER_DROP:
      return ["/tmp/zb-drop"];
    case IPC_CHANNELS.PERMISSION_REQUEST:
      return { toolTitle: "write", sessionId: "s1", reqId: "r1" };
    default:
      return undefined;
  }
}

describe("ipc rejection", () => {
  for (const channel of incoming) {
    it(`rejects a foreign frame on ${channel}`, () => {
      assert.throws(
        () => acceptIncoming(channel, other, expected, goodPayload(channel)),
        IpcRejected,
      );
    });

    it(`rejects a bad payload on ${channel}`, () => {
      const bad = channel === IPC_CHANNELS.LAUNCH ? { bridgeBin: "/tmp/evil" } : { extra: true };
      assert.throws(() => acceptIncoming(channel, sender, expected, bad), IpcRejected);
    });

    it(`accepts a trusted payload on ${channel}`, () => {
      const got = acceptIncoming(channel, sender, expected, goodPayload(channel));
      assert.ok(got === undefined || typeof got === "object");
    });
  }

  for (const channel of outgoing) {
    it(`rejects ${channel} as an incoming call`, () => {
      assert.throws(
        () => acceptIncoming(channel, sender, expected, undefined),
        IpcRejected,
      );
    });
  }

  it("names forbidden launch fields", () => {
    for (const field of ["bridgeBin", "agentBin", "tokenPath", "workspaceRoot", "agentArgs", "profile"]) {
      assert.throws(
        () => acceptIncoming(IPC_CHANNELS.LAUNCH, sender, expected, { [field]: "/tmp/x" }),
        (err: unknown) => err instanceof IpcRejected && err.message === "forbidden field",
      );
    }
  });

  it("rejects an unknown channel", () => {
    assert.throws(
      () => acceptIncoming("zb:nope", sender, expected, undefined),
      IpcRejected,
    );
  });
});

describe("binary allowlist", () => {
  it("resolves only the main-process env paths", () => {
    const dir = mkdtempSync(join(tmpdir(), "zb-ipc-bins-"));
    chmodSync(dir, 0o700);
    const bin = executable(dir, "bridge", 0o755);
    const bins = resolveAllowedBins({
      ZB_BRIDGE_BIN: bin,
      ZB_AGENT_BIN: bin,
    });
    assert.equal(bins.bridgeBin, bin);
    assert.equal(bins.agentBin, bin);
  });

  it("rejects a missing binary", () => {
    assert.throws(() =>
      resolveAllowedBins({
        ZB_BRIDGE_BIN: "/no/such/zero-bridge",
        ZB_AGENT_BIN: process.execPath,
      }),
    );
  });

  it("rejects an empty allowlist", () => {
    assert.throws(() => resolveAllowedBins({}));
  });
});
