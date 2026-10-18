#!/usr/bin/env node
// Generate SHA256 checksums for distribution artifacts.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const packagesDir = join("dist", "packages");
const files = readdirSync(packagesDir).filter(f => 
  f.endsWith(".AppImage") || f.endsWith(".deb") || f.endsWith(".rpm")
);

const lines = [];
for (const file of files) {
  const fullPath = join(packagesDir, file);
  const content = readFileSync(fullPath);
  const hash = createHash("sha256").update(content).digest("hex");
  lines.push(`${hash}  ${file}`);
}

const outPath = join(packagesDir, "SHA256SUMS.txt");
writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`Checksums written to ${outPath}`);
console.log(lines.join("\n"));