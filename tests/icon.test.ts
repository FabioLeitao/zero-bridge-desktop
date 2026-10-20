import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "assets");

function pngSize(name: string): { width: number; height: number } {
  const buf = readFileSync(join(root, name));
  assert.equal(buf.subarray(0, 4).toString("hex"), "89504e47", `${name} signature`);
  assert.equal(buf.subarray(12, 16).toString("ascii"), "IHDR");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

describe("app icon", () => {
  it("is a real PNG at the sizes the window, tray and favicon use", () => {
    const svg = readFileSync(join(root, "icon.svg"), "utf8");
    assert.match(svg, /<svg\b/);
    assert.deepEqual(pngSize("icon.png"), { width: 1024, height: 1024 });
    assert.deepEqual(pngSize("icon-256.png"), { width: 256, height: 256 });
    assert.deepEqual(pngSize("icon-32.png"), { width: 32, height: 32 });
    assert.deepEqual(pngSize("icon-16.png"), { width: 16, height: 16 });
    assert.deepEqual(pngSize("trayTemplate.png"), { width: 32, height: 32 });
    assert.deepEqual(pngSize("trayTemplate-on-dark.png"), { width: 32, height: 32 });
  });
});
