// The sandboxed renderer loads the preload as a classic script.
// tsc emits ESM, which Electron rejects with "Cannot use import statement outside a module".
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

await build({
  entryPoints: [join(root, "src", "preload.ts")],
  outfile: join(root, "dist", "src", "preload.js"),
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node22",
  external: ["electron"],
  logLevel: "warning",
});
