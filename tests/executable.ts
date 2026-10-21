// Fixture for the binary allowlist. The caller picks the mode.
// An accepted binary is 0755 inside a directory the test made 0700.
// src/bins.ts rejects a binary the group or others can write, and a parent
// directory they can write. process.execPath is not that fixture: the node
// binary on a CI runner may be group-writable.
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function executable(dir: string, name: string, mode: number): string {
  const path = join(dir, name);
  writeFileSync(path, "");
  chmodSync(path, mode);
  return path;
}
