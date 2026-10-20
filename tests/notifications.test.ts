import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PermissionNotifier } from "../src/notifications.js";
import { IPC_CHANNELS } from "../src/types.js";

describe("PermissionNotifier", () => {
  it("sanitizes the tool title before the notification is shown", () => {
    const bodies: string[] = [];
    const notifier = new PermissionNotifier((opts) => {
      bodies.push(opts.body);
      return { on() {}, show() {}, close() {} };
    });
    notifier.attach({
      isVisible: () => false,
      isFocused: () => false,
      show() {},
      focus() {},
      webContents: { send() {} },
    });
    notifier.onPermissionRequest({
      toolTitle: "<script>\nalert(1)</script>" + "x".repeat(200),
      sessionId: "s1",
      reqId: "r1",
    });
    assert.equal(bodies.length, 1);
    assert.equal(/[<>&"'\n\r]/.test(bodies[0]!), false);
    assert.equal(bodies[0]!.length <= "Permission requested: ".length + 80, true);
  });

  it("skips the notification when the window is focused", () => {
    let shown = 0;
    const notifier = new PermissionNotifier(() => {
      shown += 1;
      return { on() {}, show() {}, close() {} };
    });
    notifier.attach({
      isVisible: () => true,
      isFocused: () => true,
      show() {},
      focus() {},
      webContents: { send() {} },
    });
    notifier.onPermissionRequest({ toolTitle: "read", sessionId: "s", reqId: "r" });
    assert.equal(shown, 0);
  });

  it("records the note when the native notification throws", () => {
    const dir = mkdtempSync(join(tmpdir(), "zb-note-"));
    const path = join(dir, "notes.txt");
    const hidden = {
      isVisible: () => false,
      isFocused: () => false,
      show() {},
      focus() {},
      webContents: { send() {} },
    };
    try {
      const notifier = new PermissionNotifier(() => {
        throw new Error("Failed to show notification sekret-token-value");
      }, () => path);
      notifier.attach(hidden);
      notifier.onPermissionRequest({ toolTitle: "write", sessionId: "s", reqId: "r" });
      const body = readFileSync(path, "utf8");
      assert.match(body, /write/);
      assert.equal(body.includes("sekret-token-value"), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("focuses the window from the notification click", () => {
    let focused = 0;
    let channel = "";
    const notifier = new PermissionNotifier(() => ({
      on(event, listener) {
        if (event === "click") listener();
      },
      show() {},
      close() {},
    }));
    notifier.attach({
      isVisible: () => false,
      isFocused: () => false,
      show() {},
      focus() {
        focused += 1;
      },
      webContents: {
        send(next) {
          channel = next;
        },
      },
    });
    notifier.onPermissionRequest({ toolTitle: "read", sessionId: "s", reqId: "r" });
    assert.equal(focused, 1);
    assert.equal(channel, IPC_CHANNELS.PERMISSION_FOCUS);
  });
});
