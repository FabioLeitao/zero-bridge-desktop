import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { childEnv } from "../src/childEnv.js";

describe("sidecar environment", () => {
  it("forwards an allowlist and drops secrets", () => {
    const env = childEnv({
      PATH: "/usr/bin",
      HOME: "/home/u",
      ZERO_BRIDGE_TOKEN: "sekret-token",
      LD_PRELOAD: "/tmp/evil.so",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
      ZB_E2E_BRIDGE_BIN: "/tmp/bridge",
      ZB_FAKE_PERMISSION: "1",
      AUTHORIZATION: "Bearer sekret-token",
    });
    assert.equal(env.PATH, "/usr/bin");
    assert.equal(env.HOME, "/home/u");
    assert.equal(env.ZB_FAKE_PERMISSION, "1");
    assert.equal(env.ZERO_BRIDGE_TOKEN, undefined);
    assert.equal(env.LD_PRELOAD, undefined);
    assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
    assert.equal(env.ZB_E2E_BRIDGE_BIN, undefined);
    assert.equal(env.AUTHORIZATION, undefined);
    assert.equal(JSON.stringify(env).includes("sekret-token"), false);
  });
});
