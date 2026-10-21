#!/usr/bin/env node
// CycloneDX from the npm lockfile, plus the bundled bridge and its Go modules.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parsePin } from "./bridge-source.mjs";

export function bridgeComponents(record) {
  const pin = parsePin(record.pin);
  if (!Array.isArray(record.modules) || record.modules.length === 0) {
    throw new Error("bridge modules missing");
  }
  const components = [
    {
      type: "application",
      "bom-ref": `bridge@${pin}`,
      name: "zero-bridge",
      version: pin,
      purl: `pkg:golang/zero-bridge/bridge@${pin}`,
      description: "bundled bridge",
      properties: [
        { name: "zero-bridge:path", value: "bridge/zero-bridge" },
        { name: "zero-bridge:pin", value: pin },
      ],
    },
  ];
  for (const mod of record.modules) {
    if (typeof mod.path !== "string" || mod.path.length === 0) throw new Error("bridge module path missing");
    if (typeof mod.version !== "string" || mod.version.length === 0) throw new Error("bridge module version missing");
    const component = {
      type: "library",
      "bom-ref": `mod:${mod.path}@${mod.version}`,
      name: mod.path,
      version: mod.version,
      purl: `pkg:golang/${mod.path}@${mod.version}`,
    };
    if (typeof mod.go === "string" && mod.go.length > 0) {
      component.properties = [{ name: "zero-bridge:go", value: mod.go }];
    }
    components.push(component);
  }
  return components;
}

export function addBundledBridge(sbom, record) {
  const components = Array.isArray(sbom.components) ? sbom.components : [];
  return { ...sbom, components: components.concat(bridgeComponents(record)) };
}

function writeSbom() {
  const sbom = JSON.parse(execFileSync("npm", ["sbom", "--sbom-format=cyclonedx", "--package-lock-only"], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  }));
  const record = JSON.parse(readFileSync(join("dist", "bridge", "go-modules.json"), "utf8"));
  const outPath = join("dist", "packages", `sbom-${new Date().toISOString().split("T")[0]}.json`);
  writeFileSync(outPath, `${JSON.stringify(addBundledBridge(sbom, record), null, 2)}\n`);
  console.log(`SBOM written to ${outPath}`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  try {
    writeSbom();
  } catch (err) {
    console.error("SBOM generation failed:", err);
    process.exit(1);
  }
}
