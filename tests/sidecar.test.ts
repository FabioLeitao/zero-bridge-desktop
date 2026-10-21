import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventEmitter } from "node:events";
import { SidecarController, SidecarSpawn } from "../src/sidecar.js";

describe("SidecarController", async () => {
  it("creates a token file with 0600 and no secrets in argv", async () => {
    const ctrl = new SidecarController();
    const fakeBridge = process.execPath;
    const fakeAgent = process.execPath;
    const tokenDir = join(tmpdir(), "zb-test-" + randomUUID());
    const handle = await ctrl.launch({
      bridgeBin: fakeBridge,
      agentBin: fakeAgent,
      port: 0,
      tokenDir,
      healthTimeoutMs: 0,
    });
    // Token path exists.
    assert.equal(typeof handle.tokenPath, "string");
    // Token is not in argv stringified.
    const token = handle.token;
    assert.ok(token.length >= 32);
    await ctrl.kill();
  });
});

class FakeChild extends EventEmitter {
  pid: number | null = 7;
  killed = false;
  stdout: EventEmitter | null = new EventEmitter();
  stderr: EventEmitter | null = new EventEmitter();
  ignoreTerm = false;
  kill(signal?: string) {
    if (signal === "SIGTERM" && this.ignoreTerm) return true;
    this.killed = true;
    return true;
  }
}

function controllerFor(child: FakeChild, seen: { args: string[]; env: NodeJS.ProcessEnv | null }) {
  const spawnImpl: SidecarSpawn = (_cmd, args, options) => {
    seen.args = [...args];
    seen.env = options.env;
    return child as unknown as ReturnType<SidecarSpawn>;
  };
  return new SidecarController(spawnImpl);
}

async function launchFake(child: FakeChild, extra: Record<string, unknown> = {}) {
  const seen = { args: [] as string[], env: null as NodeJS.ProcessEnv | null };
  const ctrl = controllerFor(child, seen);
  const handle = await ctrl.launch({
    bridgeBin: process.execPath,
    agentBin: process.execPath,
    port: 9,
    tokenDir: join(tmpdir(), "zb-fake-" + randomUUID()),
    killGraceMs: 0,
    healthTimeoutMs: 200,
    probeHealth: async () => true,
    ...extra,
  });
  return { ctrl, handle, seen };
}

describe("SidecarController branches", () => {
  it("uses the requested port and a workspace root", async () => {
    const child = new FakeChild();
    const { ctrl, handle, seen } = await launchFake(child, {
      port: 9,
      workspaceRoot: "/tmp/zb-workspace",
    });
    assert.equal(handle.port, 9);
    assert.ok(seen.args.includes("--listen"));
    assert.ok(seen.args.includes("127.0.0.1:9"));
    assert.ok(seen.args.includes("--workspace-root"));
    assert.ok(seen.args.includes("/tmp/zb-workspace"));
    const defaults: string[] = [];
    for (let i = 0; i < seen.args.length - 1; i++) {
      if (seen.args[i] === "--agent-arg") defaults.push(seen.args[i + 1]);
    }
    assert.deepEqual(defaults, ["acp"]);
    assert.equal(seen.args.includes("--profile"), false);
    assert.equal(seen.env?.ZERO_BRIDGE_TOKEN, undefined);
    await ctrl.kill();
  });

  it("passes no agent argument when the config list is empty", async () => {
    const child = new FakeChild();
    const { ctrl, seen } = await launchFake(child, { agentArgs: [] });
    assert.equal(seen.args.includes("--agent-arg"), false);
    await ctrl.kill();
  });

  it("passes each configured agent argument and the profile", async () => {
    const child = new FakeChild();
    const { ctrl, seen } = await launchFake(child, {
      agentArgs: ["acp", "e2e-marker"],
      profile: "generic",
    });
    const pairs: string[] = [];
    for (let i = 0; i < seen.args.length - 1; i++) {
      if (seen.args[i] === "--agent-arg") pairs.push(seen.args[i + 1]);
    }
    assert.deepEqual(pairs, ["acp", "e2e-marker"]);
    const profileAt = seen.args.indexOf("--profile");
    assert.equal(seen.args[profileAt + 1], "generic");
    await ctrl.kill();
  });

  it("picks an ephemeral port when port is 0", async () => {
    const child = new FakeChild();
    const seen = { args: [] as string[], env: null as NodeJS.ProcessEnv | null };
    const ctrl = controllerFor(child, seen);
    const handle = await ctrl.launch({
      bridgeBin: process.execPath,
      agentBin: process.execPath,
      port: 0,
      tokenDir: join(tmpdir(), "zb-fake-" + randomUUID()),
      killGraceMs: 0,
      healthTimeoutMs: 0,
      probeHealth: async () => true,
    });
    assert.ok(handle.port > 0);
    assert.equal(seen.args.includes("127.0.0.1:0"), false);
    await ctrl.kill();
  });

  it("rejects a missing binary", async () => {
    const ctrl = new SidecarController();
    await assert.rejects(() =>
      ctrl.launch({
        bridgeBin: join(tmpdir(), "no-such-bridge-" + randomUUID()),
        agentBin: process.execPath,
        port: 9,
        tokenDir: join(tmpdir(), "zb-fake-" + randomUUID()),
      }),
    );
    assert.equal(ctrl.getState(), "stopped");
    await ctrl.kill();
  });

  it("stays running after a healthy probe when stdout and stderr arrive", async () => {
    const child = new FakeChild();
    const { ctrl, handle } = await launchFake(child);
    child.stdout?.emit("data", Buffer.from("up\n"));
    assert.equal(handle.state, "running");
    child.stdout?.emit("data", Buffer.from("again\n"));
    assert.equal(handle.state, "running");
    child.stderr?.emit("data", Buffer.from("no secrets\n"));
    assert.equal(ctrl.getState(), "running");
    await ctrl.kill();
  });

  it("records crash, clean exit, and signal exit", async () => {
    const crashed = new FakeChild();
    const a = await launchFake(crashed);
    crashed.emit("error", new Error("spawn failed"));
    assert.equal(a.handle.state, "crashed");
    await a.ctrl.kill();

    const clean = new FakeChild();
    const b = await launchFake(clean);
    clean.emit("exit", 0, null);
    assert.equal(b.handle.state, "stopped");
    await b.ctrl.kill();

    const signaled = new FakeChild();
    const c = await launchFake(signaled);
    signaled.emit("exit", null, "SIGTERM");
    assert.equal(c.handle.state, "crashed");
    await c.ctrl.kill();

    const failed = new FakeChild();
    const d = await launchFake(failed);
    failed.emit("exit", 2, null);
    assert.equal(d.handle.state, "crashed");
    await d.ctrl.kill();
  });

  it("sends SIGKILL when SIGTERM does not mark the child killed", async () => {
    const child = new FakeChild();
    child.ignoreTerm = true;
    const { ctrl, handle } = await launchFake(child);
    await ctrl.kill();
    assert.equal(handle.pid, 7);
    assert.equal(child.killed, true);
  });

  it("does not keep a poll timer after the health wait", async () => {
    const child = new FakeChild();
    const { ctrl, handle } = await launchFake(child);
    assert.equal(handle.pollHandle, undefined);
    child.killed = true;
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(handle.state, "running");
    await ctrl.kill();
  });

  it("accepts a child with no stdio pipes", async () => {
    const child = new FakeChild();
    child.stdout = null;
    child.stderr = null;
    const { ctrl, handle } = await launchFake(child);
    assert.equal(handle.state, "running");
    await ctrl.kill();
  });
});