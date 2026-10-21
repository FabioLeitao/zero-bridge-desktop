import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addBundledBridge } from "../scripts/sbom.mjs";

const pin = "a".repeat(40);

describe("bundled bridge sbom", () => {
  it("adds the bridge and each go module to a cyclonedx bom", () => {
    const bom = addBundledBridge(
      { bomFormat: "CycloneDX", components: [{ name: "left", version: "1" }] },
      {
        pin,
        modules: [
          { path: "zero-bridge/bridge", version: pin, go: "1.22" },
          { path: "golang.org/x/sys", version: "v0.22.0" },
        ],
      },
    );
    const components = bom.components as Array<{
      name: string;
      version: string;
      purl?: string;
      properties?: Array<{ value: string }>;
    }>;
    assert.equal(components.length, 4);
    const bridge = components.find((item) => item.name === "zero-bridge");
    assert.ok(bridge);
    assert.equal(bridge.version, pin);
    assert.equal(bridge.purl, `pkg:golang/zero-bridge/bridge@${pin}`);
    assert.equal(bridge.properties?.some((item) => item.value === "bridge/zero-bridge"), true);
    const sys = components.find((item) => item.name === "golang.org/x/sys");
    assert.ok(sys);
    assert.equal(sys.version, "v0.22.0");
    assert.equal(sys.purl, "pkg:golang/golang.org/x/sys@v0.22.0");
    const main = components.find((item) => item.name === "zero-bridge/bridge");
    assert.ok(main);
    assert.equal(main.version, pin);
    assert.equal(main.properties?.[0]?.value, "1.22");
  });

  it("refuses a record without modules", () => {
    assert.throws(() => addBundledBridge({ components: [] }, { pin, modules: [] }), /bridge modules missing/);
  });
});
