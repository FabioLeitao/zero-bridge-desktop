import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sameOrigin, sidecarOrigin, isLoopbackHost, parseOrigin } from "../src/origin.js";

describe("origin allowlist", () => {
  it("parses http and https", () => {
    const u = parseOrigin("http://127.0.0.1:8765/");
    assert.equal(u.protocol, "http:");
    assert.equal(u.hostname, "127.0.0.1");
    assert.equal(u.port, "8765");

    const v = parseOrigin("https://127.0.0.1:8765/");
    assert.equal(v.protocol, "https:");
  });

  it("rejects non-http", () => {
    assert.throws(() => parseOrigin("file://"), /unsupported protocol/);
    assert.throws(() => parseOrigin("ws://"), /unsupported protocol/);
    assert.throws(() => parseOrigin("ftp://"), /unsupported protocol/);
  });

  it("detects loopback hosts", () => {
    assert.equal(isLoopbackHost("127.0.0.1"), true);
    assert.equal(isLoopbackHost("::1"), true);
    assert.equal(isLoopbackHost("localhost"), true);
    // host part only, port stripped
    assert.equal(isLoopbackHost("127.0.0.1:8765"), true);
    assert.equal(isLoopbackHost("[::1]:8765"), true);
    assert.equal(isLoopbackHost("example.com"), false);
    assert.equal(isLoopbackHost(""), false);
    assert.equal(isLoopbackHost(null), false);
  });

  it("sameOrigin compares correctly", () => {
    const a = new URL("http://127.0.0.1:8765/foo");
    const b = new URL("http://127.0.0.1:8765/bar");
    assert.equal(sameOrigin(a, b), true);

    const c = new URL("http://127.0.0.1:8766/");
    assert.equal(sameOrigin(a, c), false);

    const d = new URL("https://127.0.0.1:8765/");
    assert.equal(sameOrigin(a, d), false);
  });

  it("sidecarOrigin builds correct URL", () => {
    const u = sidecarOrigin(9999);
    assert.equal(u.protocol, "http:");
    assert.equal(u.hostname, "127.0.0.1");
    assert.equal(u.port, "9999");
    assert.equal(u.pathname, "/");
  });
});