import { readFileSync } from "node:fs";
import { FuseState, FuseV1Options, getCurrentFuseWire } from "@electron/fuses";

const binary = "dist/packages/linux-unpacked/zero-bridge";
const source = "src/electron.fuses.ts";

const camelByFuse = {
  [FuseV1Options.RunAsNode]: "runAsNode",
  [FuseV1Options.EnableCookieEncryption]: "enableCookieEncryption",
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: "enableNodeOptionsEnvironmentVariable",
  [FuseV1Options.EnableNodeCliInspectArguments]: "enableNodeCliInspectArguments",
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: "enableEmbeddedAsarIntegrityValidation",
  [FuseV1Options.OnlyLoadAppFromAsar]: "onlyLoadAppFromAsar",
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: "loadBrowserProcessSpecificV8Snapshot",
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: "grantFileProtocolExtraPrivileges",
};

const stateName = {
  [FuseState.DISABLE]: "DISABLE",
  [FuseState.ENABLE]: "ENABLE",
  [FuseState.REMOVED]: "REMOVED",
  [FuseState.INHERIT]: "INHERIT",
};

const expected = readExpected(source);
const wire = await getCurrentFuseWire(binary);
let failed = false;
const seen = new Set();

for (const key of Object.keys(camelByFuse)) {
  const fuse = Number(key);
  const name = FuseV1Options[fuse];
  const camel = camelByFuse[fuse];
  const actual = wire[fuse];
  const label = stateName[actual] ?? String(actual);
  console.log(`${name}=${label}`);
  seen.add(camel);
  const want = expected[camel];
  const wantState = want === true ? FuseState.ENABLE : FuseState.DISABLE;
  if (want === undefined || actual !== wantState) failed = true;
}

for (const camel of Object.keys(expected)) {
  if (!seen.has(camel)) {
    console.log(`${camel}=MISSING`);
    failed = true;
  }
}

if (failed) process.exit(1);

function readExpected(path) {
  const text = readFileSync(path, "utf8");
  const match = text.match(/export const electronFuses = (\{[\s\S]*?\}) as const/);
  if (!match) throw new Error("electronFuses object missing");
  const body = match[1].replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const json = body.replace(/([A-Za-z0-9_]+)\s*:/g, '"$1":').replace(/,\s*}/, "}");
  const parsed = JSON.parse(json);
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "boolean") throw new Error(`fuse ${key} is not a boolean`);
  }
  return parsed;
}
