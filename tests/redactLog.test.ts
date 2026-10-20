import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendRedactedLog, redactLogLine } from "../src/redactLog.js";
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
});
