import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendRedactedLog, redactLogLine, writeShellLog } from "../src/redactLog.js";
import { shellPaths } from "../src/paths.js";
import { classifySidecarFailure } from "../src/sidecar.js";

describe("redacted logs", () => {
  it("drops the token, Authorization, and the session cookie from a stored line", () => {
    const token = "sekret-token-value";
    const raw = `listen failed ${token}\nAuthorization: Bearer ${token}\nCookie: zb_session=${token}; Path=/`;
    const stored = redactLogLine(raw, [token]);
    assert.equal(stored.includes(token), false);
    assert.match(stored, /authorization: bearer \[redacted\]/i);
    assert.match(stored, /zb_session=\[redacted\]/);

    const dir = mkdtempSync(join(tmpdir(), "zb-log-"));
    const path = join(dir, "shell.log");
    appendRedactedLog(path, raw, [token]);
    const file = readFileSync(path, "utf8");
    assert.equal(file.includes(token), false);

    assert.equal(classifySidecarFailure("token file is missing"), "bad-token");
  });

  it("stores a shell log under the injected logs path and redacts the launch token", () => {
    const userData = mkdtempSync(join(tmpdir(), "zb-user-"));
    const logs = mkdtempSync(join(tmpdir(), "zb-logs-"));
    const runtime = mkdtempSync(join(tmpdir(), "zb-run-"));
    const paths = shellPaths({
      platform: "linux",
      env: { HOME: "/home/me", XDG_RUNTIME_DIR: runtime },
      userData,
      logs,
      tmpdir: join(tmpdir(), "zb-unused"),
      uid: 1000,
    });
    assert.equal(paths.configFile, join(userData, "shell-config.json"));
    assert.equal(paths.boundsFile, join(userData, "window-bounds.json"));
    assert.equal(paths.tokenDir, join(runtime, "zero-bridge"));
    assert.equal(paths.logFile, join(logs, "shell.log"));
    for (const value of [paths.configFile, paths.boundsFile, paths.tokenDir, paths.logFile]) {
      assert.equal(value.includes("/home/me"), false);
    }

    const token = "launch-token-value";
    writeShellLog(paths.logFile, `start ${token} Cookie: zb_session=${token}`, token);
    const stored = readFileSync(paths.logFile, "utf8");
    assert.equal(stored.includes(token), false);
    assert.match(stored, /zb_session=\[redacted\]/);
  });
});
