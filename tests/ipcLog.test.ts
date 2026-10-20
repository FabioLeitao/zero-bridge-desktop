import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { IPC_CHANNELS } from "../src/types.js";
import { RejectionLog, rejectionLine } from "../src/ipcLog.js";

describe("ipc rejection log", () => {
  it("counts by channel and reason and omits the payload", () => {
    const lines: string[] = [];
    const log = new RejectionLog((line) => lines.push(line));
    const payload = {
      token: "sekret-token",
      tokenPath: "/home/secret/token.txt",
      workspaceRoot: "/home/secret/proj",
      toolTitle: "<script>alert(1)</script>",
    };
    log.record(IPC_CHANNELS.LAUNCH, "sender", payload);
    log.record(IPC_CHANNELS.LAUNCH, "sender", payload);
    assert.equal(lines[0], "ipc rejected channel=zb:launch reason=sender count=1");
    assert.equal(lines[1], "ipc rejected channel=zb:launch reason=sender count=2");
    const text = lines.join("\n") + rejectionLine("nope", "raw " + payload.token, payload);
    assert.equal(text.includes("sekret-token"), false);
    assert.equal(text.includes("token.txt"), false);
    assert.equal(text.includes("/home/secret"), false);
    assert.equal(text.includes("<script>"), false);
    assert.equal(text.includes("reason=rejected"), true);
  });
});
