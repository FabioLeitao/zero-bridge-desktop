import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claimPrivateDir, shellPaths, type PrivateDirIo } from "../src/paths.js";

const logs = "/var/lib/zb-logs";
const userData = "/var/lib/zb-user";

describe("shell paths", () => {
  it("keeps config and bounds under the injected user data and the log under the injected logs path", () => {
    const paths = shellPaths({
      platform: "linux",
      env: { HOME: "/home/me", XDG_RUNTIME_DIR: "/run/user/1000" },
      userData,
      logs,
      tmpdir: "/tmp/zb",
    });
    assert.equal(paths.configFile, join(userData, "shell-config.json"));
    assert.equal(paths.boundsFile, join(userData, "window-bounds.json"));
    assert.equal(paths.logFile, join(logs, "shell.log"));
    assert.equal(paths.tokenDir, "/run/user/1000/zero-bridge");
    assert.equal(paths.socketPath, "/run/user/1000/zero-bridge/bridge.sock");
    for (const value of Object.values(paths)) assert.equal(String(value).includes("/home/me"), false);
  });

  it("uses tmpdir for the token and socket when linux has no runtime dir", () => {
    const paths = shellPaths({
      platform: "linux",
      env: { HOME: "/home/me" },
      userData,
      logs,
      tmpdir: "/tmp/zb",
      uid: 1000,
    });
    assert.equal(paths.tokenDir, "/tmp/zb/zero-bridge-1000");
    assert.equal(paths.socketPath, "/tmp/zb/zero-bridge-1000/bridge.sock");
    assert.equal(paths.tokenDir.includes("/home/me"), false);
  });

  it("ignores XDG_RUNTIME_DIR on win32 and darwin and does not fall back to a home path", () => {
    const win = shellPaths({
      platform: "win32",
      env: { HOME: "/home/me", XDG_RUNTIME_DIR: "/run/user/1000", USERPROFILE: "C:\\Users\\me" },
      userData: "D:\\zb-user",
      logs: "D:\\zb-logs",
      tmpdir: "D:\\Temp\\zb",
    });
    assert.equal(win.tokenDir, "D:\\Temp\\zb\\zero-bridge");
    assert.equal(win.socketPath, "D:\\Temp\\zb\\zero-bridge\\bridge.sock");
    assert.equal(win.configFile, "D:\\zb-user\\shell-config.json");
    assert.equal(win.tokenDir.includes("Users"), false);

    const mac = shellPaths({
      platform: "darwin",
      env: { HOME: "/Users/me", XDG_RUNTIME_DIR: "/run/user/1000" },
      userData: "/var/lib/zb-user",
      logs,
      tmpdir: "/var/folders/zb",
      uid: 1000,
    });
    assert.equal(mac.tokenDir, "/var/folders/zb/zero-bridge-1000");
    assert.equal(mac.socketPath, "/var/folders/zb/zero-bridge-1000/bridge.sock");
    assert.equal(mac.tokenDir.includes("/Users/me"), false);
  });

  it("refuses a missing user-data or logs path instead of building a home path", () => {
    const input = {
      platform: "linux" as const,
      env: { HOME: "/home/me", XDG_RUNTIME_DIR: "/run/user/1000" },
      userData: "",
      logs,
      tmpdir: "/tmp/zb",
    };
    assert.throws(() => shellPaths(input), /userData required/);
    assert.throws(() => shellPaths({ ...input, userData, logs: "" }), /logs required/);
    try {
      shellPaths(input);
    } catch (err) {
      assert.equal(String(err).includes("/home/me"), false);
    }
  });
});

describe("private runtime directory", () => {
  it("creates a 0700 directory when the path is absent", async () => {
    const uid = process.getuid?.();
    if (uid === undefined) return;
    const root = mkdtempSync(join(tmpdir(), "zb-priv-"));
    const dir = join(root, "zero-bridge-" + uid);
    await claimPrivateDir(dir, uid);
    const stat = lstatSync(dir);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.isDirectory(), true);
    assert.equal(stat.uid, uid);
    assert.equal(stat.mode & 0o777, 0o700);
  });

  it("refuses a symlink without following it", async () => {
    const uid = process.getuid?.();
    if (uid === undefined) return;
    const root = mkdtempSync(join(tmpdir(), "zb-link-"));
    const target = join(root, "target");
    mkdirSync(target);
    chmodSync(target, 0o755);
    const link = join(root, "link");
    symlinkSync(target, link);
    await assert.rejects(() => claimPrivateDir(link, uid), /symlink/);
    assert.equal(lstatSync(target).mode & 0o777, 0o755);
    assert.equal(lstatSync(link).isSymbolicLink(), true);
  });

  it("refuses a directory owned by another uid", async () => {
    let mkdirCalls = 0;
    const io = stubDir({ uid: 1, mode: 0o40700, directory: true }, () => {
      mkdirCalls += 1;
    });
    await assert.rejects(() => claimPrivateDir("/tmp/zb/zero-bridge-1000", 1000, io), /owner/);
    assert.equal(mkdirCalls, 0);
  });

  it("refuses mode 0755", async () => {
    let chmodCalls = 0;
    const io = stubDir({ uid: 1000, mode: 0o40755, directory: true }, undefined, () => {
      chmodCalls += 1;
    });
    await assert.rejects(() => claimPrivateDir("/tmp/zb/zero-bridge-1000", 1000, io), /mode/);
    assert.equal(chmodCalls, 0);
  });
});

function stubDir(
  stat: { uid: number; mode: number; directory: boolean; symlink?: boolean },
  onMkdir?: () => void,
  onChmod?: () => void,
): PrivateDirIo {
  return {
    async lstat() {
      return {
        uid: stat.uid,
        mode: stat.mode,
        isDirectory: () => stat.directory && !stat.symlink,
        isSymbolicLink: () => Boolean(stat.symlink),
      };
    },
    async mkdir() {
      onMkdir?.();
    },
    async chmod() {
      onChmod?.();
    },
  };
}
