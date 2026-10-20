import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { singleInstanceDecision } from "../src/singleInstance.js";
import { loadWindowBounds, saveWindowBounds } from "../src/windowBounds.js";

describe("shell lifetime", () => {
  it("quits when the single-instance lock is lost", () => {
    assert.equal(singleInstanceDecision(false), "quit");
    assert.equal(singleInstanceDecision(true), "continue");
  });

  it("round-trips window bounds and rejects garbage", async () => {
    const dir = await mkdtemp(join(tmpdir(), "zb-bounds-"));
    const file = join(dir, "window-bounds.json");
    await saveWindowBounds(file, { x: 10, y: 20, width: 800, height: 600 });
    const raw = await readFile(file, "utf8");
    assert.equal(raw.includes("token"), false);
    assert.deepEqual(await loadWindowBounds(file), { x: 10, y: 20, width: 800, height: 600 });
    assert.equal(await loadWindowBounds(join(dir, "missing.json")), null);
    await saveWindowBounds(file, { x: 1, y: 1, width: 0, height: 10 });
    assert.equal(await loadWindowBounds(file), null);
  });
});
