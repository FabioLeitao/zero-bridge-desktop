import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SidecarController,
  SidecarSpawn,
  SidecarStartError,
  classifySidecarFailure,
} from "../src/sidecar.js";
import { ephemeralPort } from "../src/listenPort.js";
import { errorPageHtml } from "../src/errorPage.js";

class FakeChild extends EventEmitter {
  pid: number | null = 3;
  killed = false;
  stdout: EventEmitter | null = new EventEmitter();
  stderr: EventEmitter | null = new EventEmitter();
  kill() {
    this.killed = true;
    return true;
  }
}

describe("sidecar health", () => {
  it("does not turn port 0 into 8765", () => {
    assert.equal(ephemeralPort(0), 0);
    assert.equal(ephemeralPort("0"), 0);
    assert.equal(ephemeralPort(undefined), 0);
    assert.equal(ephemeralPort(9), 9);
    assert.throws(() => ephemeralPort("nope"));
  });

  it("classifies bind, token, and agent failures", () => {
    assert.equal(classifySidecarFailure("listen tcp 127.0.0.1:9: address already in use"), "port-in-use");
    assert.equal(classifySidecarFailure("listen tcp: EADDRINUSE"), "port-in-use");
    assert.equal(classifySidecarFailure("token file /tmp/t is readable by group or others"), "bad-token");
    assert.equal(classifySidecarFailure("token must be at least 32 bytes"), "bad-token");
    assert.equal(classifySidecarFailure("agent command: not found"), "agent-not-found");
    assert.equal(classifySidecarFailure("agent binary is not executable"), "agent-not-found");
    assert.equal(classifySidecarFailure("something else"), "crashed");
  });

  it("sets those states from stderr when /health never succeeds", async () => {
    const child = new FakeChild();
    const spawnImpl: SidecarSpawn = () => child as unknown as ReturnType<SidecarSpawn>;
    const ctrl = new SidecarController(spawnImpl);
    const handle = await ctrl.launch({
      bridgeBin: process.execPath,
      agentBin: process.execPath,
      port: 9,
      tokenDir: join(tmpdir(), "zb-health-" + randomUUID()),
      killGraceMs: 0,
      healthTimeoutMs: 40,
      probeHealth: async (url) => {
        assert.equal(url.endsWith("/health"), true);
        assert.equal(url.includes("token"), false);
        child.stderr?.emit("data", Buffer.from("address already in use"));
        return false;
      },
    });
    assert.equal(handle.state, "port-in-use");
    await ctrl.kill();
  });

  it("reports a missing agent without spawning", async () => {
    let spawned = false;
    const ctrl = new SidecarController(() => {
      spawned = true;
      throw new Error("no spawn");
    });
    await assert.rejects(
      () =>
        ctrl.launch({
          bridgeBin: process.execPath,
          agentBin: join(tmpdir(), "missing-agent-" + randomUUID()),
          port: 0,
          tokenDir: join(tmpdir(), "zb-agent-" + randomUUID()),
        }),
      (err: unknown) => err instanceof SidecarStartError && err.state === "agent-not-found",
    );
    assert.equal(spawned, false);
  });

  it("escapes the error page", () => {
    const html = errorPageHtml("bad-token", "<script>alert(1)</script>");
    assert.equal(html.includes("<script>"), false);
    assert.equal(html.includes("bad-token"), true);
    assert.equal(html.includes("&lt;script&gt;"), true);
  });
});
