import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SHELL_CSP,
  denyPagePermission,
  denyPermissionCheck,
  navigationDecision,
  windowOpenDecision,
  withShellCsp,
} from "../src/shellPolicy.js";
import { electronFuses } from "../src/electron.fuses.js";

describe("shell policy", () => {
  it("denies navigation while the sidecar origin is unset", () => {
    assert.equal(navigationDecision(null, "http://127.0.0.1:9/"), "deny");
    assert.equal(navigationDecision(null, "https://evil.example/"), "deny");
  });

  it("allows only the sidecar origin after it is set", () => {
    const current = "http://127.0.0.1:9/";
    assert.equal(navigationDecision(current, "http://127.0.0.1:9/app"), "allow");
    assert.equal(navigationDecision(current, "http://127.0.0.1:10/"), "deny");
    assert.equal(navigationDecision(current, "file:///etc/passwd"), "deny");
    assert.equal(navigationDecision(current, "not a url"), "deny");
  });

  it("denies window.open", () => {
    assert.equal(windowOpenDecision(), "deny");
  });

  it("sets a shell CSP and denies page permissions", () => {
    const headers = withShellCsp({ "X-Test": ["1"] });
    assert.equal(headers["Content-Security-Policy"][0], SHELL_CSP);
    assert.match(SHELL_CSP, /default-src 'self'/);
    assert.match(SHELL_CSP, /object-src 'none'/);
    let allowed = true;
    denyPagePermission(null, "media", (value) => {
      allowed = value;
    });
    assert.equal(allowed, false);
    assert.equal(denyPermissionCheck(), false);
  });

  it("locks the fuse values that packaging applies", () => {
    assert.equal(electronFuses.runAsNode, false);
    assert.equal(electronFuses.enableCookieEncryption, true);
    assert.equal(electronFuses.enableNodeOptionsEnvironmentVariable, false);
    assert.equal(electronFuses.enableNodeCliInspectArguments, false);
    assert.equal(electronFuses.onlyLoadAppFromAsar, true);
    assert.equal(electronFuses.grantFileProtocolExtraPrivileges, false);
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    assert.deepEqual(pkg.build.electronFuses, electronFuses);
  });
});
