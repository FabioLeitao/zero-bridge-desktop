// Proves the Linux packages in dist/packages. Not part of npm run check.
// xvfb-run -a node scripts/verify-linux-package.mjs
// The package carries the bridge. This script builds only cmd/acpfake from the
// pinned commit, into a temp directory. It does not read ZB_BRIDGE_SRC.

import { execFileSync, spawn } from "node:child_process";
import {
  accessSync,
  chmodSync,
  constants,
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
import { readPin, withBridgeCheckout } from "./bridge-source.mjs";

if (typeof process.getuid === "function" && process.getuid() === 0) {
  console.error("refusing to run as root");
  process.exit(1);
}
if (!process.env.DISPLAY) {
  console.error("DISPLAY is unset; npm run verify:linux-package uses xvfb-run");
  process.exit(1);
}

const root = process.cwd();
const pin = readPin(root);
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
const bundledDeb = contentLines.filter((line) => line.includes("resources/bridge/zero-bridge"));
console.log(`deb-files=${contentLines.length}`);
console.log(executable.join("\n"));
console.log(bundledDeb.join("\n"));

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
if (bundledDeb.length !== 1 || !bundledDeb[0].trim().split(/\s+/)[0].includes("x")) {
  console.error("deb does not contain an executable resources/bridge/zero-bridge");
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
const bridgeComponent = sbom.components.find((item) => item.name === "zero-bridge" && item.version === pin);
const goModules = sbom.components.filter((item) => typeof item.purl === "string" && item.purl.startsWith("pkg:golang/"));
if (!bridgeComponent || goModules.length === 0 || !goModules.some((item) => item.version === pin)) {
  console.error("SBOM is missing the bundled bridge or its Go modules");
  process.exit(1);
}
console.log(`sbom=${sboms[0]} components=${sbom.components.length} bridge=${pin} go-modules=${goModules.length}`);

const work = mkdtempSync(join(tmpdir(), "zbd-linux-pkg-"));
let app = null;
try {
  const agentBin = join(work, "acpfake");
  withBridgeCheckout(root, ({ moduleDir }) => {
    execFileSync("go", ["build", "-trimpath", "-o", agentBin, "./cmd/acpfake"], {
      cwd: moduleDir,
      env: { ...process.env, GOFLAGS: "-buildvcs=false" },
      stdio: "inherit",
    });
  });
  chmodSync(agentBin, 0o755);

  execFileSync(resolve(packagesDir, appImage), ["--appimage-extract"], { cwd: work });
  const binary = join(work, "squashfs-root", "zero-bridge-desktop");
  const bundled = join(work, "squashfs-root", "resources", "bridge", "zero-bridge");
  if (!existsSync(binary)) throw new Error(`extracted binary missing: ${binary}`);
  accessSync(bundled, constants.X_OK);
  const packedPin = readFileSync(join(work, "squashfs-root", "resources", "bridge", "bridge.sha"), "utf8").trim();
  if (packedPin !== pin) throw new Error(`packaged bridge pin ${packedPin} does not match ${pin}`);

  const home = join(work, "home");
  const runtime = join(work, "runtime");
  const userData = join(work, "user-data");
  mkdirSync(home, { mode: 0o700 });
  mkdirSync(runtime, { mode: 0o700 });
  mkdirSync(userData, { mode: 0o700 });
  writeFileSync(join(userData, "shell-config.json"), `${JSON.stringify({ agentBin })}\n`);

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
    sidecar = findSidecar(app.pid, bundled);
    if (windowLine && sidecar) break;
  }

  console.log(windowLine || "window=missing");
  console.log(sidecar || "sidecar=missing");
  const startLine = log.split("\n").find((line) => line.includes("sidecar start bridge")) ?? "";
  console.log(startLine || "start-line=missing");
  if (!windowLine || !sidecar || !startLine.includes(pin)) {
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
