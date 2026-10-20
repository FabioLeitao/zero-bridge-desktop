import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveAllowedBins } from "../src/bins.js";
import { testHooks } from "../src/testEnv.js";

describe("test-only environment", () => {
  it("ignores ZB_E2E_* in a packaged app, including when NODE_ENV=test", () => {
    const env = {
      NODE_ENV: "test",
      ZB_E2E_BRIDGE_BIN: process.execPath,
      ZB_E2E_AGENT_BIN: process.execPath,
      ZB_E2E_PORT: "9",
      ZB_E2E_TOKEN_FILE: "/tmp/token.txt",
      ZB_E2E_NOTE_LOG: "/tmp/notes",
    };
    const hooks = testHooks(env, true);
    assert.equal(hooks.port, undefined);
    assert.equal(hooks.tokenFile, undefined);
    assert.equal(hooks.noteLog, undefined);
    assert.throws(() => resolveAllowedBins(env, true));
  });

  it("honors ZB_E2E_* when the app is not packaged", () => {
    const env = {
      NODE_ENV: "test",
      ZB_E2E_BRIDGE_BIN: process.execPath,
      ZB_E2E_AGENT_BIN: process.execPath,
      ZB_E2E_PORT: "0",
      ZB_E2E_TOKEN_FILE: "/tmp/token.txt",
      ZB_E2E_NOTE_LOG: "/tmp/notes",
    };
    const hooks = testHooks(env, false);
    assert.equal(hooks.port, "0");
    assert.equal(hooks.tokenFile, "/tmp/token.txt");
    assert.equal(hooks.noteLog, "/tmp/notes");
    const bins = resolveAllowedBins(env, false);
    assert.equal(bins.bridgeBin, process.execPath);
    assert.equal(bins.agentBin, process.execPath);
  });
});
