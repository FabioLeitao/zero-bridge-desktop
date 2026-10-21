import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bridgePinPath, bridgeStartLogLine, readBridgePin, readOptionalBridgePin, sidecarStartLine } from "../src/bridgePin.js";

describe("bridge start line", () => {
  it("reads the repo pin and names it on the start line", () => {
    const pin = readFileSync("bridge.sha", "utf8").trim();
    const path = bridgePinPath(false, "/unused", join(process.cwd(), "dist", "src"));
    assert.equal(readBridgePin(path), pin);
    assert.equal(bridgePinPath(true, "/app/resources", "/unused"), join("/app/resources", "bridge", "bridge.sha"));
    assert.equal(sidecarStartLine(pin), `sidecar start bridge ${pin}`);
  });

  it("refuses a start line without a commit pin", () => {
    assert.throws(() => sidecarStartLine("d795e2f"), /bridge pin is not a commit/);
  });

  it("names the pin when the running bridge is the bundled binary", () => {
    const pin = "a".repeat(40);
    const bundled = "/opt/zero-bridge/resources/bridge/zero-bridge";
    assert.equal(bridgeStartLogLine(bundled, bundled, `${pin}\n`), `sidecar start bridge ${pin}`);
  });

  it("does not cite the pin when the bridge path is an override", () => {
    const pin = "b".repeat(40);
    const bundled = "/opt/zero-bridge/resources/bridge/zero-bridge";
    const line = bridgeStartLogLine("/usr/local/bin/zero-bridge", bundled, `${pin}\n`);
    assert.equal(line, "sidecar start bridge override");
    assert.equal(line.includes(pin), false);
    assert.equal(bridgeStartLogLine("/usr/local/bin/zero-bridge", undefined, pin), "sidecar start bridge override");
  });

  it("keeps going when the bundled pin cannot be read", () => {
    const bundled = "/opt/zero-bridge/resources/bridge/zero-bridge";
    const missing = join(mkdtempSync(join(tmpdir(), "zb-pin-")), "bridge.sha");
    assert.equal(readOptionalBridgePin(missing), undefined);
    assert.equal(bridgeStartLogLine(bundled, bundled, undefined), "sidecar start bridge pin unavailable");
    assert.equal(bridgeStartLogLine(bundled, bundled, "not-a-commit"), "sidecar start bridge pin unavailable");
  });
});
