import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { IPC_CHANNELS } from "../src/types.js";
import { IpcRejected, acceptIncoming } from "../src/ipcGuard.js";
import { FolderPicker } from "../src/folderPicker.js";
import { pathAllowed } from "../src/workspaceRoots.js";
import { cwdForAgent } from "../src/workspaceLaunch.js";

const sender = { webContentsId: 4, frameRoutingId: 8 };
const expected = { webContentsId: 4, frameRoutingId: 8 };

describe("renderer workspace", () => {
  it("rejects a workspaceRoot from the renderer", () => {
    for (const workspaceRoot of ["/tmp/outside", "/tmp/root/../etc", "/tmp/root/escape"]) {
      assert.throws(
        () => acceptIncoming(IPC_CHANNELS.LAUNCH, sender, expected, { workspaceRoot }),
        IpcRejected,
      );
    }
  });

  it("uses only the path the picker already validated", async () => {
    const root = await mkdtemp(join(tmpdir(), "zb-root-"));
    const outside = await mkdtemp(join(tmpdir(), "zb-out-"));
    const inside = join(root, "proj");
    await mkdir(inside);
    const link = join(root, "escape");
    await symlink(outside, link);
    const dotdot = join(root, "..", basename(outside));

    assert.equal(await pathAllowed([root], outside), false);
    assert.equal(await pathAllowed([root], link), false);
    assert.equal(await pathAllowed([root], dotdot), false);

    const picker = new FolderPicker();
    picker.setAllowedRoots([root]);
    const dialog = {
      showOpenDialog: async () => ({ canceled: false, filePaths: [link] }),
      showMessageBox: async () => ({}),
    };
    assert.equal(await picker.pick({}, dialog), null);
    assert.equal(picker.chosen(), null);
    assert.equal(cwdForAgent("/tmp/outside", picker.chosen()), undefined);

    const ok = {
      showOpenDialog: async () => ({ canceled: false, filePaths: [inside] }),
      showMessageBox: async () => ({}),
    };
    const chosen = await picker.pick({}, ok);
    assert.equal(chosen, inside);
    assert.equal(cwdForAgent("/tmp/outside", picker.chosen()), inside);
  });
});
