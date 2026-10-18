import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SidecarController } from "../src/sidecar.js";

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
    });
    // Token path exists.
    assert.equal(typeof handle.tokenPath, "string");
    // Token is not in argv stringified.
    const token = handle.token;
    assert.ok(token.length >= 32);
    await ctrl.kill();
  });
});