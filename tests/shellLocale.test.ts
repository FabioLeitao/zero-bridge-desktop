import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { shellLocale, shellStrings } from "../src/shellLocale.js";

describe("shell locale", () => {
  it("follows pt from the OS locale and otherwise stays English", () => {
    assert.equal(shellLocale({ LANG: "pt_BR.UTF-8" }), "pt-BR");
    assert.equal(shellLocale({ LC_ALL: "pt_PT.UTF-8", LANG: "en_US.UTF-8" }), "pt-BR");
    assert.equal(shellLocale({ LANG: "en_US.UTF-8" }), "en");
    assert.equal(shellLocale({}), "en");
    assert.equal(shellLocale({ LANG: "en_US.UTF-8" }, "pt-BR"), "pt-BR");
  });

  it("has tray and notification strings in English and Brazilian Portuguese", () => {
    const en = shellStrings("en");
    const pt = shellStrings("pt-BR");
    assert.equal(en.show, "Show zero-bridge");
    assert.equal(en.quit, "Quit");
    assert.equal(en.permissionTitle, "zero-bridge permission");
    assert.equal(en.permissionBody("tool"), "Permission requested: tool");
    assert.equal(pt.show, "Mostrar zero-bridge");
    assert.equal(pt.quit, "Sair");
    assert.equal(pt.permissionTitle, "permissão do zero-bridge");
    assert.equal(pt.permissionBody("ferramenta"), "Permissão pedida: ferramenta");
  });
});
