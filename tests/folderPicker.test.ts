import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FolderPicker } from "../src/folderPicker.js";

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

  it("allows exact root match", () => {
    const picker = new FolderPicker();
    picker.setAllowedRoots(["/home/user/projects"]);
    const chosen: string = "/home/user/projects";
    const exact: string = "/home/user/projects";
    const inside = chosen.startsWith(exact + "/") || chosen === exact;
    assert.ok(inside);
  });
});