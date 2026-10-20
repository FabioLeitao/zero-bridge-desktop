import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadShellConfig, parseShellConfig } from "../src/shellConfig.js";
import { resolveAllowedBins } from "../src/bins.js";

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
});
