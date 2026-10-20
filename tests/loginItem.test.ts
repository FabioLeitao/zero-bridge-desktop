import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loginItemSettings } from "../src/loginItem.js";

describe("start at login", () => {
  it("stays off unless the operator opts in", () => {
    assert.deepEqual(loginItemSettings(false), { openAtLogin: false });
    assert.deepEqual(loginItemSettings(undefined), { openAtLogin: false });
    assert.deepEqual(loginItemSettings(true), { openAtLogin: true });
  });
});
