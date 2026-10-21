import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AGENT_ARG_MAX,
  PROFILE_MAX,
  agentArgsForLaunch,
  loadShellConfig,
  parseShellConfig,
  readShellConfig,
} from "../src/shellConfig.js";
import { errorPageHtml } from "../src/errorPage.js";
import { bundledBridgePath, configBinaryAllowed, resolveAllowedBins } from "../src/bins.js";

describe("shell config", () => {
  it("reads bins, unix socket, login, and locale from a local file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zb-cfg-"));
    const path = join(dir, "shell-config.json");
    writeFileSync(
      path,
      JSON.stringify({
        bridgeBin: "/usr/local/bin/zero-bridge",
        agentBin: "/usr/local/bin/zero",
        unixSocket: "/tmp/zb.sock",
        openAtLogin: true,
        locale: "pt-BR",
      }),
    );
    const cfg = await loadShellConfig(path);
    assert.equal(cfg.bridgeBin, "/usr/local/bin/zero-bridge");
    assert.equal(cfg.agentBin, "/usr/local/bin/zero");
    assert.equal(cfg.unixSocket, "/tmp/zb.sock");
    assert.equal(cfg.openAtLogin, true);
    assert.equal(cfg.locale, "pt-BR");
    assert.deepEqual(cfg.passEnv, undefined);
  });

  it("reads passEnv names and rejects a loader or token name", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zb-pass-"));
    const path = join(dir, "shell-config.json");
    writeFileSync(path, JSON.stringify({ passEnv: ["OPENAI_API_KEY", "HTTPS_PROXY"] }));
    const cfg = await loadShellConfig(path);
    assert.deepEqual(cfg.passEnv, ["OPENAI_API_KEY", "HTTPS_PROXY"]);
    assert.throws(() => parseShellConfig(JSON.stringify({ passEnv: ["LD_PRELOAD"] })));
    assert.throws(() => parseShellConfig(JSON.stringify({ passEnv: ["MY_TOKEN"] })));
  });

  it("returns an empty config when the file is absent", async () => {
    const cfg = await loadShellConfig(join(tmpdir(), "zb-missing-shell-config.json"));
    assert.deepEqual(cfg, {});
  });

  it("returns a cause for invalid JSON and a rejected key", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zb-bad-"));
    const broken = join(dir, "broken.json");
    writeFileSync(broken, "{");
    const invalid = await readShellConfig(broken);
    assert.equal(invalid.config && typeof invalid.error === "string" && invalid.error.length > 0, true);
    const page = errorPageHtml("crashed", invalid.error!);
    assert.equal(page.includes(invalid.error!), true);
    assert.equal(page.includes("<script>"), false);

    const secret = join(dir, "secret.json");
    writeFileSync(secret, JSON.stringify({ token: "sekret-token" }));
    const rejected = await readShellConfig(secret);
    assert.match(rejected.error ?? "", /rejects secrets/);
    assert.equal(errorPageHtml("crashed", rejected.error!).includes("sekret-token"), false);
  });

  it("reads agent arguments and a short profile", () => {
    const cfg = parseShellConfig(JSON.stringify({ agentArgs: ["acp", "e2e-marker"], profile: "generic" }));
    assert.deepEqual(cfg.agentArgs, ["acp", "e2e-marker"]);
    assert.equal(cfg.profile, "generic");
  });

  it("leaves agent arguments unset when the config has none", () => {
    const cfg = parseShellConfig(JSON.stringify({ locale: "en" }));
    assert.equal(cfg.agentArgs, undefined);
    assert.equal(cfg.profile, undefined);
    assert.deepEqual(agentArgsForLaunch(cfg.agentArgs), ["acp"]);
  });

  it("keeps an explicit empty agent argument list empty", () => {
    const cfg = parseShellConfig(JSON.stringify({ agentArgs: [] }));
    assert.deepEqual(cfg.agentArgs, []);
    assert.deepEqual(agentArgsForLaunch(cfg.agentArgs), []);
  });

  it("refuses an agent argument with a newline, a NUL, or over the length limit", () => {
    assert.throws(() => parseShellConfig(JSON.stringify({ agentArgs: ["a\nb"] })), /agentArgs refused/);
    assert.throws(() => parseShellConfig(JSON.stringify({ agentArgs: ["a\rb"] })), /agentArgs refused/);
    assert.throws(() => parseShellConfig(JSON.stringify({ agentArgs: ["a\0b"] })), /agentArgs refused/);
    assert.throws(() => parseShellConfig(JSON.stringify({ agentArgs: ["x".repeat(AGENT_ARG_MAX + 1)] })), /agentArgs refused/);
    assert.throws(() => parseShellConfig(JSON.stringify({ agentArgs: [1] })), /agentArgs refused/);
  });

  it("refuses a profile outside the short lowercase pattern", () => {
    assert.throws(() => parseShellConfig(JSON.stringify({ profile: "Zero" })), /profile refused/);
    assert.throws(() => parseShellConfig(JSON.stringify({ profile: "has space" })), /profile refused/);
    assert.throws(() => parseShellConfig(JSON.stringify({ profile: "a.b" })), /profile refused/);
    assert.throws(() => parseShellConfig(JSON.stringify({ profile: "" })), /profile refused/);
    assert.throws(() => parseShellConfig(JSON.stringify({ profile: "a".repeat(PROFILE_MAX + 1) })), /profile refused/);
  });

  it("rejects token, token path, and authorization", () => {
    assert.throws(() => parseShellConfig(JSON.stringify({ token: "sekret" })));
    assert.throws(() => parseShellConfig(JSON.stringify({ tokenPath: "/tmp/token.txt" })));
    assert.throws(() => parseShellConfig(JSON.stringify({ authorization: "Bearer sekret" })));
  });

  it("prefers the config paths over the process environment", () => {
    const dir = mkdtempSync(join(tmpdir(), "zb-bin-"));
    const bridge = join(dir, "bridge");
    const agent = join(dir, "agent");
    const other = join(dir, "other");
    writeFileSync(bridge, "");
    writeFileSync(agent, "");
    writeFileSync(other, "");
    chmodSync(bridge, 0o755);
    chmodSync(agent, 0o755);
    chmodSync(other, 0o755);
    const bins = resolveAllowedBins(
      { ZB_BRIDGE_BIN: other, ZB_AGENT_BIN: other },
      false,
      { bridgeBin: bridge, agentBin: agent },
    );
    assert.equal(bins.bridgeBin, bridge);
    assert.equal(bins.agentBin, agent);
  });

  it("refuses a config binary the user does not own or that others can write", () => {
    const uid = 1000;
    const file = { uid, mode: 0o100755, isFile: () => true };
    configBinaryAllowed(file, uid);
    assert.throws(() => configBinaryAllowed({ ...file, uid: 0 }, uid));
    assert.throws(() => configBinaryAllowed({ ...file, mode: 0o100775 }, uid));
    assert.throws(() => configBinaryAllowed({ ...file, mode: 0o100707 }, uid));
    assert.throws(() => configBinaryAllowed({ ...file, isFile: () => false }, uid));

    const dir = mkdtempSync(join(tmpdir(), "zb-own-"));
    const bridge = join(dir, "bridge");
    const agent = join(dir, "agent");
    writeFileSync(bridge, "");
    writeFileSync(agent, "");
    chmodSync(bridge, 0o777);
    chmodSync(agent, 0o755);
    assert.throws(() => resolveAllowedBins({}, false, { bridgeBin: bridge, agentBin: agent }));
  });

  it("uses the bundled bridge when a packaged app has no bridge override", () => {
    assert.equal(bundledBridgePath("/app/resources"), join("/app/resources", "bridge", "zero-bridge"));
    const bins = resolveAllowedBins({ ZB_AGENT_BIN: process.execPath }, true, {}, process.execPath);
    assert.equal(bins.bridgeBin, process.execPath);
    assert.equal(bins.agentBin, process.execPath);
    assert.throws(() => resolveAllowedBins({}, true, {}, process.execPath));
    assert.throws(() => resolveAllowedBins({ ZB_AGENT_BIN: process.execPath }, false, {}, process.execPath));
  });

  it("lets shell config override the bundled bridge", () => {
    const dir = mkdtempSync(join(tmpdir(), "zb-bundle-"));
    const bridge = join(dir, "bridge");
    writeFileSync(bridge, "");
    chmodSync(bridge, 0o755);
    const bins = resolveAllowedBins(
      { ZB_AGENT_BIN: process.execPath },
      true,
      { bridgeBin: bridge },
      process.execPath,
    );
    assert.equal(bins.bridgeBin, bridge);
  });
});
