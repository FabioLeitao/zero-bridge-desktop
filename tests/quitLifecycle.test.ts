import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { holdQuit } from "../src/quitLifecycle.js";

describe("before-quit", () => {
  it("holds quit until the sidecar kill finishes", async () => {
    let quit = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const event = {
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    const state = { quitting: false };
    holdQuit(event, state, {
      kill: () => gate,
      quit: () => {
        quit += 1;
      },
    });
    assert.equal(event.prevented, true);
    assert.equal(quit, 0);
    release();
    await gate;
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(quit, 1);

    const again = {
      prevented: false,
      preventDefault() {
        this.prevented = true;
      },
    };
    holdQuit(again, state, {
      kill: async () => {},
      quit: () => {
        quit += 1;
      },
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(again.prevented, false);
    assert.equal(quit, 1);
  });
});
