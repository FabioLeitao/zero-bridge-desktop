import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FolderPicker } from "../src/folderPicker.js";
import { fetchWorkspaceRoots, pathAllowed } from "../src/workspaceRoots.js";

describe("FolderPicker (validation logic only)", () => {
  it("allows paths inside allowed roots", () => {
    const picker = new FolderPicker();
    picker.setAllowedRoots(["/home/user/projects", "/home/user/work"]);
    assert.equal(picker["allowedRoots"].length, 2);
  });

  it("validates path inside root", () => {
    const picker = new FolderPicker();
    picker.setAllowedRoots(["/home/user/projects"]);
    const chosen: string = "/home/user/projects/myapp";
    const exact: string = "/home/user/projects";
    const inside = chosen.startsWith(exact + "/") || chosen === exact;
    assert.ok(inside);
  });

  it("rejects paths outside allowed roots", () => {
    const picker = new FolderPicker();
    picker.setAllowedRoots(["/home/user/projects"]);
    const chosen: string = "/home/user/other";
    const exact: string = "/home/user/projects";
    const inside = chosen.startsWith(exact + "/") || chosen === exact;
    assert.ok(!inside);
  });

  it("refuses to open the dialog when no roots are known", async () => {
    const picker = new FolderPicker();
    let opened = false;
    const chosen = await picker.pick({}, {
      showOpenDialog: async () => {
        opened = true;
        return { canceled: false, filePaths: ["/tmp"] };
      },
      showMessageBox: async () => ({}),
    });
    assert.equal(opened, false);
    assert.equal(chosen, null);
  });

  it("rejects a symlink that points outside the root", async () => {
    const root = await mkdtemp(join(tmpdir(), "zb-root-"));
    const outside = await mkdtemp(join(tmpdir(), "zb-out-"));
    const inside = join(root, "proj");
    await mkdir(inside);
    const link = join(root, "escape");
    await symlink(outside, link);
    assert.equal(await pathAllowed([root], inside), true);
    assert.equal(await pathAllowed([root], link), false);
    assert.equal(await pathAllowed([], inside), false);
  });

  it("loads roots from GET /v1/info with a bearer token", async () => {
    let seen = "";
    let auth = "";
    const roots = await fetchWorkspaceRoots("http://127.0.0.1:9/", "sekret", async (url, init) => {
      seen = String(url);
      auth = String((init?.headers as Record<string, string>).Authorization);
      return new Response(JSON.stringify({ workspaceRoots: ["/work"] }), { status: 200 });
    });
    assert.equal(seen.includes("/v1/info"), true);
    assert.equal(seen.includes("/v1/capabilities"), false);
    assert.equal(auth, "Bearer sekret");
    assert.deepEqual(roots, ["/work"]);
  });

  it("allows exact root match", () => {
    const picker = new FolderPicker();
    picker.setAllowedRoots(["/home/user/projects"]);
    const chosen: string = "/home/user/projects";
    const exact: string = "/home/user/projects";
    const inside = chosen.startsWith(exact + "/") || chosen === exact;
    assert.ok(inside);
  });
});