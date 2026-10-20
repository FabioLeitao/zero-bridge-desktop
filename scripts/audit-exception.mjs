#!/usr/bin/env node
// Lockfile audit with one recorded exception.
// Any advisory id outside ALLOWED fails the gate. npm audit fix is not run.

import { execFileSync } from "node:child_process";

const ALLOWED = new Map([
  [
    "GHSA-hp3w-g68c-fv3c",
    {
      pkg: "sprintf-js",
      locked: "1.1.3",
      review: "2027-01-19",
    },
  ],
]);

function auditJson() {
  try {
    return execFileSync("npm", ["audit", "--package-lock-only", "--json"], {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (err) {
    const stdout = err && err.stdout ? String(err.stdout) : "";
    if (stdout.trim().startsWith("{")) return stdout;
    throw err;
  }
}

const report = JSON.parse(auditJson());
const found = new Set();
for (const info of Object.values(report.vulnerabilities ?? {})) {
  for (const via of info.via ?? []) {
    if (!via || typeof via !== "object" || !via.url) continue;
    const id = String(via.url).split("/").filter(Boolean).pop();
    if (id) found.add(id);
  }
}

const unexpected = [...found].filter((id) => !ALLOWED.has(id));
if (unexpected.length > 0) {
  console.error("unexpected advisories: " + unexpected.join(", "));
  process.exit(1);
}

if (found.size === 0) {
  console.log("npm audit: no vulnerabilities in the lockfile");
  process.exit(0);
}

for (const id of found) {
  const meta = ALLOWED.get(id);
  console.log(
    `audit exception ${id} ${meta.pkg}@${meta.locked} review ${meta.review} (docs/AUDIT_EXCEPTION.md)`,
  );
}
