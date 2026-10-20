import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pathsFromDrop } from "../src/dropPaths.js";

describe("folder drop paths", () => {
  it("uses getPathForFile and ignores a path stuck on the file object", () => {
    const file = { path: "/tmp/from-the-page" };
    const paths = pathsFromDrop({ length: 1, 0: file }, () => "/tmp/from-the-os");
    assert.deepEqual(paths, ["/tmp/from-the-os"]);
  });

  it("skips a file the OS will not name", () => {
    const paths = pathsFromDrop({ length: 1, 0: {} }, () => "");
    assert.deepEqual(paths, []);
  });
});
