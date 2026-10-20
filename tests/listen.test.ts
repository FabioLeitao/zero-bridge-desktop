import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { listenAddress, unixHealthRequest } from "../src/listenAddress.js";
import { SidecarController, type SidecarSpawn } from "../src/sidecar.js";

describe("listen address", () => {
  it("keeps TCP on loopback", () => {
    assert.equal(listenAddress({ port: 9 }), "127.0.0.1:9");
    assert.equal(listenAddress({ port: 9, tcpHost: "localhost" }), "localhost:9");
  });

  it("accepts an absolute unix path and refuses a relative one", () => {
    assert.equal(listenAddress({ port: 9, unixSocket: "/tmp/zb.sock" }), "unix:/tmp/zb.sock");
    assert.throws(() => listenAddress({ port: 9, unixSocket: "relative.sock" }));
  });

  it("refuses a non-loopback TCP host", () => {
    assert.throws(() => listenAddress({ port: 9, tcpHost: "0.0.0.0" }));
  });

  it("builds a unix health request with no token and no Authorization", () => {
    const req = unixHealthRequest("/tmp/zb.sock");
    assert.equal(req.socketPath, "/tmp/zb.sock");
    assert.equal(req.path, "/health");
    assert.deepEqual(req.headers, {});
    assert.equal(JSON.stringify(req).includes("token"), false);
  });
});

class FakeChild extends EventEmitter {
  pid: number | null = 7;
  killed = false;
  stdout: EventEmitter | null = new EventEmitter();
  stderr: EventEmitter | null = new EventEmitter();
  kill() {
    this.killed = true;
    return true;
  }
}

describe("sidecar unix listen", () => {
  it("passes unix: to --listen and probes the socket without a token", async () => {
    const child = new FakeChild();
    const seen = { args: [] as string[] };
    let probed = "";
    const spawnImpl: SidecarSpawn = (_cmd, args) => {
      seen.args = [...args];
      return child as unknown as ReturnType<SidecarSpawn>;
    };
    const ctrl = new SidecarController(spawnImpl);
    const handle = await ctrl.launch({
      bridgeBin: process.execPath,
      agentBin: process.execPath,
      port: 9,
      unixSocket: "/tmp/zb.sock",
      tokenDir: join(tmpdir(), "zb-unix-" + randomUUID()),
      killGraceMs: 0,
      healthTimeoutMs: 200,
      probeUnix: async (socketPath) => {
        probed = socketPath;
        return true;
      },
    });
    assert.ok(seen.args.includes("unix:/tmp/zb.sock"));
    assert.equal(seen.args.includes("127.0.0.1:9"), false);
    assert.equal(probed, "/tmp/zb.sock");
    assert.equal(JSON.stringify(seen.args).includes(handle.token), false);
    await ctrl.kill();
  });
});
