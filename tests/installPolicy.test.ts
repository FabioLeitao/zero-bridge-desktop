import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const APPROVED = ["electron@44.9.3"];

describe("install script policy", () => {
  it("allows only the reviewed packages and keeps ignore-scripts", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const policy = pkg.allowScripts as Record<string, boolean>;
    assert.equal(policy !== null && typeof policy === "object" && !Array.isArray(policy), true);
    const allowed = Object.entries(policy)
      .filter(([, value]) => value === true)
      .map(([name]) => name)
      .sort();
    assert.deepEqual(allowed, [...APPROVED].sort());
    const npmrc = readFileSync(join(root, ".npmrc"), "utf8");
    assert.match(npmrc, /^ignore-scripts=true$/m);
  });
});
