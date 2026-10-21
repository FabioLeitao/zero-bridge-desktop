import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parsePin, readPin } from "../scripts/bridge-source.mjs";

describe("bridge pin", () => {
  it("reads one commit from bridge.sha", () => {
    const pin = readPin(process.cwd());
    assert.equal(readFileSync("bridge.sha", "utf8"), `${pin}\n`);
    assert.equal(parsePin(pin), pin);
  });

  it("rejects a pin that is not one commit", () => {
    assert.throws(() => parsePin("d795e2f"), /bridge pin is not a commit/);
    assert.throws(() => parsePin(`${"a".repeat(40)}\n${"b".repeat(40)}`), /bridge pin is not a commit/);
    assert.throws(() => parsePin("g".repeat(40)), /bridge pin is not a commit/);
  });
});
