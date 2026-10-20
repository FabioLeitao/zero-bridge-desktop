import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IPC_CHANNELS } from "../src/types.js";
import { IpcRejected, acceptIncoming } from "../src/ipcGuard.js";
import { navigationDecision } from "../src/shellPolicy.js";

const ids = { webContentsId: 4, frameRoutingId: 8 };
const sidecar = "http://127.0.0.1:9/";

describe("ipc frame origin", () => {
  it("rejects a frame whose origin is not the sidecar", () => {
    assert.throws(
      () =>
        acceptIncoming(
          IPC_CHANNELS.QUIT,
          { ...ids, frameUrl: "http://evil.example/app" },
          { ...ids, frameUrl: sidecar },
          undefined,
        ),
      IpcRejected,
    );
  });

  it("rejects a null frame url", () => {
    assert.throws(
      () =>
        acceptIncoming(
          IPC_CHANNELS.QUIT,
          { ...ids, frameUrl: null },
          { ...ids, frameUrl: sidecar },
          undefined,
        ),
      IpcRejected,
    );
  });

  it("accepts the sidecar origin and denies navigation before that origin exists", () => {
    assert.doesNotThrow(() =>
      acceptIncoming(
        IPC_CHANNELS.QUIT,
        { ...ids, frameUrl: "http://127.0.0.1:9/index.html" },
        { ...ids, frameUrl: sidecar },
        undefined,
      ),
    );
    assert.equal(navigationDecision(null, "http://evil.example/"), "deny");
    assert.equal(navigationDecision(null, sidecar), "deny");
  });
});
