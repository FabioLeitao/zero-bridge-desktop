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

  it("forwards passEnv names, including Path, and refuses loader and token names", () => {
    const env = childEnv(
      {
        PATH: "/usr/bin",
        Path: "/usr/bin",
        OPENAI_API_KEY: "sk-live",
        HTTPS_PROXY: "http://127.0.0.1:9",
        SSL_CERT_FILE: "/etc/ssl/cert.pem",
        LD_PRELOAD: "/tmp/evil.so",
      },
      { passEnv: ["OPENAI_API_KEY", "https_proxy", "SSL_CERT_FILE", "path"] },
    );
    assert.equal(env.OPENAI_API_KEY, "sk-live");
    assert.equal(env.HTTPS_PROXY, "http://127.0.0.1:9");
    assert.equal(env.SSL_CERT_FILE, "/etc/ssl/cert.pem");
    assert.equal(env.PATH ?? env.Path, "/usr/bin");
    assert.equal(env.LD_PRELOAD, undefined);
    assert.throws(() => childEnv({ LD_PRELOAD: "x" }, { passEnv: ["LD_PRELOAD"] }));
    assert.throws(() => childEnv({}, { passEnv: ["DYLD_INSERT_LIBRARIES"] }));
    assert.throws(() => childEnv({}, { passEnv: ["NODE_OPTIONS"] }));
    assert.throws(() => childEnv({}, { passEnv: ["ELECTRON_RUN_AS_NODE"] }));
    assert.throws(() => childEnv({}, { passEnv: ["AWS_SESSION_TOKEN"] }));
  });
});
