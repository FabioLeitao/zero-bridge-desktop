import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promises as fs } from "node:fs";
import { SidecarController, SidecarSpawn } from "../src/sidecar.js";
import { defaultTokenDir } from "../src/tokenDir.js";
import { rendererLaunchView } from "../src/launchView.js";

class FakeChild extends EventEmitter {
  pid: number | null = 11;
  killed = false;
  stdout: EventEmitter | null = new EventEmitter();
  stderr: EventEmitter | null = new EventEmitter();
  kill() {
    this.killed = true;
    return true;
  }
}

describe("token handling", () => {
  it("keeps the token out of the renderer view", () => {
    const view = rendererLaunchView({
      ok: true,
      state: "running",
      url: "http://127.0.0.1:9/",
      tokenPath: "/tmp/secret/token.txt",
      token: "super-secret-token-value",
    });
    assert.equal(Object.hasOwn(view, "tokenPath"), false);
    assert.equal(Object.hasOwn(view, "token"), false);
    assert.equal(JSON.stringify(view).includes("super-secret-token-value"), false);
  });

  it("defaults the token directory under userData", () => {
    assert.equal(defaultTokenDir("/home/me/.config/zero-bridge"), "/home/me/.config/zero-bridge/tokens");
  });

  it("reads argv and logs and does not find the token", async () => {
    const child = new FakeChild();
    let args: string[] = [];
    const spawnImpl: SidecarSpawn = (_cmd, argv) => {
      args = [...argv];
      return child as unknown as ReturnType<SidecarSpawn>;
    };
    const ctrl = new SidecarController(spawnImpl);
    const logs: string[] = [];
    const orig = console.log;
    console.log = (...parts: unknown[]) => {
      logs.push(parts.map(String).join(" "));
    };
    try {
      const handle = await ctrl.launch({
        bridgeBin: process.execPath,
        agentBin: process.execPath,
        port: 9,
        tokenDir: join(tmpdir(), "zb-token-" + randomUUID()),
        killGraceMs: 0,
        healthTimeoutMs: 0,
        probeHealth: async () => true,
      });
      const blob = args.join("\n") + "\n" + logs.join("\n");
      assert.equal(blob.includes(handle.token), false);
      assert.ok(args.includes("--token-file"));
      const mode = (await fs.stat(handle.tokenPath)).mode & 0o777;
      assert.equal(mode, 0o600);
      await ctrl.kill();
    } finally {
      console.log = orig;
    }
  });

  it("aborts the launch when chmod fails", async () => {
    let spawned = false;
    const spawnImpl: SidecarSpawn = () => {
      spawned = true;
      throw new Error("spawn should not run");
    };
    let chmodCalls = 0;
    const ctrl = new SidecarController(spawnImpl, {
      chmod: async () => {
        chmodCalls += 1;
        if (chmodCalls > 1) throw new Error("chmod failed");
      },
    });
    await assert.rejects(
      () =>
        ctrl.launch({
          bridgeBin: process.execPath,
          agentBin: process.execPath,
          port: 9,
          tokenDir: join(tmpdir(), "zb-chmod-" + randomUUID()),
          killGraceMs: 0,
        }),
      /chmod failed/,
    );
    assert.equal(spawned, false);
  });
});
