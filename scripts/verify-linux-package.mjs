// Proves the Linux packages in dist/packages. Not part of npm run check.
// xvfb-run -a node scripts/verify-linux-package.mjs
// A packaged app ignores ZB_E2E_*. The sidecar binaries come from shell-config.json.

import { execFileSync, spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

if (typeof process.getuid === "function" && process.getuid() === 0) {
  console.error("refusing to run as root");
  process.exit(1);
}
if (!process.env.DISPLAY) {
  console.error("DISPLAY is unset; npm run verify:linux-package uses xvfb-run");
  process.exit(1);
}

const root = process.cwd();
const packagesDir = join(root, "dist", "packages");
const names = readdirSync(packagesDir);
const appImage = names.find((name) => name.endsWith(".AppImage"));
const deb = names.find((name) => name.endsWith(".deb"));
if (!appImage || !deb) {
  console.error("dist/packages is missing an AppImage or a deb");
  process.exit(1);
}

execFileSync("sha256sum", ["-c", "SHA256SUMS.txt"], { cwd: packagesDir, stdio: "inherit" });

const info = execFileSync("dpkg-deb", ["-I", join(packagesDir, deb)], { encoding: "utf8" });
console.log(info.trim());
const contents = execFileSync("dpkg-deb", ["-c", join(packagesDir, deb)], { encoding: "utf8" });
const contentLines = contents.split("\n").filter((line) => line.length > 0);
const executable = contentLines.filter((line) => line.endsWith("zero-bridge-desktop"));
console.log(`deb-files=${contentLines.length}`);
console.log(executable.join("\n"));

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const depends = info.split("\n").find((line) => line.includes("Depends:")) ?? "";
for (const dep of pkg.build.deb.depends) {
  if (!depends.includes(dep)) {
    console.error(`deb Depends is missing ${dep}`);
    process.exit(1);
  }
}
if (executable.length === 0) {
  console.error("deb does not contain zero-bridge-desktop");
  process.exit(1);
}

const sboms = names.filter((name) => name.startsWith("sbom-") && name.endsWith(".json"));
if (sboms.length !== 1) {
  console.error("expected one sbom-*.json");
  process.exit(1);
}
const sbom = JSON.parse(readFileSync(join(packagesDir, sboms[0]), "utf8"));
if (sbom.bomFormat !== "CycloneDX") {
  console.error("SBOM is not CycloneDX");
  process.exit(1);
}
console.log(`sbom=${sboms[0]} components=${sbom.components.length}`);

const moduleDir = bridgeModule(root);
const work = mkdtempSync(join(tmpdir(), "zbd-linux-pkg-"));
let app = null;
try {
  const bridgeBin = join(work, "zero-bridge");
  const agentBin = join(work, "acpfake");
  const goEnv = { ...process.env, GOFLAGS: "-buildvcs=false" };
  execFileSync("go", ["build", "-o", bridgeBin, "./cmd/zero-bridge"], { cwd: moduleDir, env: goEnv });
  execFileSync("go", ["build", "-o", agentBin, "./cmd/acpfake"], { cwd: moduleDir, env: goEnv });
  chmodSync(bridgeBin, 0o755);
  chmodSync(agentBin, 0o755);

  execFileSync(resolve(packagesDir, appImage), ["--appimage-extract"], { cwd: work });
  const binary = join(work, "squashfs-root", "zero-bridge-desktop");
  if (!existsSync(binary)) throw new Error(`extracted binary missing: ${binary}`);

  const home = join(work, "home");
  const runtime = join(work, "runtime");
  const userData = join(work, "user-data");
  mkdirSync(home, { mode: 0o700 });
  mkdirSync(runtime, { mode: 0o700 });
  mkdirSync(userData, { mode: 0o700 });
  writeFileSync(
    join(userData, "shell-config.json"),
    `${JSON.stringify({ bridgeBin, agentBin })}\n`,
  );

  const env = {
    PATH: process.env.PATH ?? "",
    HOME: home,
    XDG_RUNTIME_DIR: runtime,
    XDG_CONFIG_HOME: join(home, ".config"),
    DISPLAY: process.env.DISPLAY,
    LANG: process.env.LANG || "C.UTF-8",
  };
  if (process.env.XAUTHORITY) env.XAUTHORITY = process.env.XAUTHORITY;
  app = spawn(binary, [`--user-data-dir=${userData}`], {
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let log = "";
  app.stdout.on("data", (chunk) => {
    log += chunk;
  });
  app.stderr.on("data", (chunk) => {
    log += chunk;
  });

  const deadline = Date.now() + 20000;
  let windowLine = "";
  let sidecar = "";
  while (Date.now() < deadline) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
    if (app.exitCode !== null) break;
    windowLine = windowTitle();
    sidecar = findSidecar(app.pid, bridgeBin);
    if (windowLine && sidecar) break;
  }

  console.log(windowLine || "window=missing");
  console.log(sidecar || "sidecar=missing");
  if (!windowLine || !sidecar) {
    console.error(log.trim());
    console.error(`work=${work}`);
    process.exitCode = 1;
  } else {
    rmSync(work, { recursive: true, force: true });
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  console.error(`work=${work}`);
  process.exitCode = 1;
} finally {
  if (app?.pid) {
    try {
      process.kill(-app.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

function bridgeModule(repoRoot) {
  const candidates = [
    process.env.ZB_BRIDGE_SRC,
    join(repoRoot, "zero-bridge", "bridge"),
    join(repoRoot, "..", "zero-bridge", "bridge"),
  ].filter((dir) => typeof dir === "string" && dir.length > 0);
  for (const dir of candidates) {
    if (existsSync(join(dir, "cmd", "zero-bridge"))) return dir;
  }
  throw new Error("set ZB_BRIDGE_SRC to the bridge module");
}

function windowTitle() {
  try {
    const tree = execFileSync("xwininfo", ["-root", "-tree"], { encoding: "utf8" });
    return tree.split("\n").find((line) => line.includes('"zero-bridge":'))?.trim() ?? "";
  } catch {
    return "";
  }
}

function findSidecar(pid, bridgeBin) {
  const seen = new Set();
  const stack = [pid];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);
    let children = "";
    try {
      children = readFileSync(`/proc/${current}/task/${current}/children`, "utf8");
    } catch {
      continue;
    }
    for (const child of children.trim().split(/\s+/).filter((item) => item.length > 0)) {
      stack.push(Number(child));
      let cmd = "";
      try {
        cmd = readFileSync(`/proc/${child}/cmdline`, "utf8").replaceAll("\0", " ").trim();
      } catch {
        continue;
      }
      if (cmd === bridgeBin || cmd.startsWith(`${bridgeBin} `)) return cmd;
    }
  }
  return "";
}
