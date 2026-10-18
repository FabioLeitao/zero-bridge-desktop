#!/usr/bin/env node
// Generate SBOM (Software Bill of Materials) for the distribution artifacts.
// Uses npm's built-in sbom command and cyclonedx format.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

try {
  // Generate SBOM in CycloneDX format
  const sbom = execFileSync("npm", ["sbom", "--sbom-format=cyclonedx", "--package-lock-only"], {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });

  const outPath = join("dist", "packages", `sbom-${new Date().toISOString().split('T')[0]}.json`);
  writeFileSync(outPath, sbom);
  console.log(`SBOM written to ${outPath}`);
} catch (e) {
  console.error("SBOM generation failed:", e);
  process.exit(1);
}