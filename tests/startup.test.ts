import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { startHost } from "../src/startup.js";

describe("startup", () => {
  it("creates the window and starts the sidecar when the tray throws", async () => {
    const steps: string[] = [];
    const logs: string[] = [];
    await startHost({
      createWindow() {
        steps.push("window");
      },
      attachTray() {
        throw new Error("Failed to load image sekret-token-value");
      },
      async startSidecar() {
        steps.push("sidecar");
      },
      log(line) {
        logs.push(line);
      },
    });
    assert.deepEqual(steps, ["window", "sidecar"]);
    assert.equal(logs.length, 1);
    assert.equal(logs[0]!.includes("sekret-token-value"), false);
    assert.match(logs[0]!, /^tray failed/);
  });
});
