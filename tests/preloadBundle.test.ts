import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("sandboxed preload", () => {
  it("is one classic script the sandbox can run", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "dist", "src", "preload.js"), "utf8");
    assert.equal(/\bimport\s/.test(source), false);
    assert.match(source, /require\("electron"\)/);
    assert.match(source, /section\.perm/);
  });
});
