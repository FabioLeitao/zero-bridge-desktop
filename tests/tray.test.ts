import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { TrayController, TrayMenuItem } from "../src/tray.js";
import { IPC_CHANNELS } from "../src/types.js";

describe("TrayController", () => {
  it("constructs without throwing", () => {
    const tray = new TrayController("/fake/path/icon.png");
    assert.ok(tray);
  });

  it("quit runs the shell callback and does not message the renderer", () => {
    let quits = 0;
    const sent: string[] = [];
    let template: TrayMenuItem[] = [];
    const tray = new TrayController(
      "/fake/path/icon.png",
      {
        create: () => ({
          on() {},
          setContextMenu() {},
          setToolTip() {},
          destroy() {},
        }),
        buildMenu: (items) => {
          template = items;
          return items;
        },
      },
      () => {
        quits += 1;
      },
    );
    tray.attach({
      isVisible: () => true,
      isFocused: () => true,
      isMinimized: () => false,
      show() {},
      hide() {},
      focus() {},
      restore() {},
      webContents: {
        send(channel) {
          sent.push(channel);
        },
      },
    });
    template.find((item) => item.label === "Quit")?.click?.();
    assert.equal(quits, 1);
    assert.equal(sent.includes(IPC_CHANNELS.QUIT), false);
  });
});
