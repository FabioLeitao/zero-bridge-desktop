import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TrayController } from "../src/tray.js";

describe("TrayController", () => {
  it("constructs without throwing", () => {
    const tray = new TrayController("/fake/path/icon.png");
    assert.ok(tray);
  });

  it("has toggle, show, hide methods", () => {
    const tray = new TrayController("/fake/path/icon.png");
    assert.equal(typeof tray["toggle"], "function");
    assert.equal(typeof tray["show"], "function");
    assert.equal(typeof tray["hide"], "function");
  });
});