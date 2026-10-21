// Fetch the pinned zero-bridge commit, check rev-parse, and build cmd/zero-bridge.

import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withBridgeCheckout } from "./bridge-source.mjs";

const root = process.cwd();
const outDir = join(root, "dist", "bridge");
const goEnv = { ...process.env, GOFLAGS: "-buildvcs=false" };

withBridgeCheckout(root, ({ pin, moduleDir }) => {
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, "zero-bridge");
  execFileSync("go", ["build", "-trimpath", "-o", out, "./cmd/zero-bridge"], {
    cwd: moduleDir,
    env: goEnv,
    stdio: "inherit",
  });
  chmodSync(out, 0o755);
  const listed = execFileSync(
    "go",
    ["list", "-m", "-f", "{{.Path}}\t{{.Version}}\t{{.GoVersion}}", "all"],
    { cwd: moduleDir, env: goEnv, encoding: "utf8" },
  );
  const modules = [];
  for (const line of listed.split("\n")) {
    if (line.trim() === "") continue;
    const [path, version, go] = line.split("\t");
    if (!path) throw new Error("go list returned a module without a path");
    const row = { path, version: version ? version : pin };
    if (go) row.go = go;
    modules.push(row);
  }
  if (modules.length === 0) throw new Error("go list returned no modules");
  writeFileSync(join(outDir, "go-modules.json"), `${JSON.stringify({ pin, modules }, null, 2)}\n`);
  copyFileSync(join(root, "bridge.sha"), join(outDir, "bridge.sha"));
  console.log(`bridge ${pin} -> ${out}`);
});
