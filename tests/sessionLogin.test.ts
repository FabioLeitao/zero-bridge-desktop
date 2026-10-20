import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loginSession, sessionCookieFromSetCookie } from "../src/sessionLogin.js";
import { noticeFromCard } from "../src/permissionCard.js";
import { resolveBridgeModule } from "./bridgeSource.js";

describe("sidecar session", () => {
  it("reads only the session cookie", () => {
    const cookie = sessionCookieFromSetCookie([
      "zb_session=abc; Path=/; HttpOnly; SameSite=Strict",
    ]);
    assert.deepEqual(cookie, { name: "zb_session", value: "abc" });
    assert.equal(sessionCookieFromSetCookie(["other=1"]), null);
  });

  it("posts the token to loopback /v1/login and returns the cookie", async () => {
    let seen = "";
    const cookie = await loginSession("http://127.0.0.1:9/", "secret-token", async (url, init) => {
      seen = url.toString() + " " + init.body;
      assert.equal(url.pathname, "/v1/login");
      assert.equal(url.toString().includes("secret-token"), false);
      return {
        ok: true,
        headers: { getSetCookie: () => ["zb_session=sess; Path=/; HttpOnly"] },
      };
    });
    assert.equal(cookie.value, "sess");
    assert.equal(seen.includes("secret-token"), true);
  });

  it("rejects a login that does not set a cookie", async () => {
    await assert.rejects(
      () => loginSession("http://127.0.0.1:9/", "t", async () => ({ ok: true, headers: {} })),
      /login failed/,
    );
  });

  it("builds a permission notice from the card text", () => {
    assert.deepEqual(noticeFromCard(" write ", "perm-title-1"), {
      toolTitle: "write",
      sessionId: "page",
      reqId: "perm-title-1",
    });
    assert.equal(noticeFromCard(" ", "id"), null);
  });

  it("resolves the bridge module from env, nested, or sibling", () => {
    const found = resolveBridgeModule(
      { env: "", nested: "/repo/zero-bridge/bridge", sibling: "/dev/zero-bridge/bridge" },
      (path) => path === "/dev/zero-bridge/bridge",
    );
    assert.equal(found, "/dev/zero-bridge/bridge");
    assert.throws(() => resolveBridgeModule({ nested: "/a", sibling: "/b" }, () => false));
  });
});
