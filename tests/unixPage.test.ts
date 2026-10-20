import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loginOverUnix, unixInfo, unixProtocolResponse, UNIX_PAGE_ORIGIN } from "../src/unixPage.js";

async function fakeBridge(): Promise<{ socketPath: string; close: () => Promise<void>; seen: string[] }> {
  const dir = mkdtempSync(join(tmpdir(), "zb-unix-page-"));
  const socketPath = join(dir, "bridge.sock");
  const seen: string[] = [];
  const server: Server = createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    if (req.method === "POST" && req.url === "/v1/login") {
      res.setHeader("set-cookie", "zb_session=session-value; HttpOnly; Path=/");
      res.end("ok");
      return;
    }
    if (req.method === "GET" && req.url === "/") {
      res.end("bridge-ui");
      return;
    }
    if (req.method === "GET" && req.url === "/v1/info") {
      res.end(JSON.stringify({ workspaceRoots: ["/work/proj"] }));
      return;
    }
    res.statusCode = 404;
    res.end("missing");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, () => resolve());
  });
  return {
    socketPath,
    seen,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

describe("unix page", () => {
  it("logs in and loads the page through the socket, with no TCP port and no token in the path", async () => {
    const bridge = await fakeBridge();
    try {
      const cookie = await loginOverUnix(bridge.socketPath, "sekret-token-value");
      assert.equal(cookie.name, "zb_session");
      assert.equal(cookie.value, "session-value");
      assert.equal(bridge.seen.some((line) => line.includes("sekret-token-value")), false);

      const page = await unixProtocolResponse(bridge.socketPath, {
        method: "GET",
        url: UNIX_PAGE_ORIGIN,
      });
      assert.equal(page.status, 200);
      assert.equal(page.body.toString("utf8"), "bridge-ui");

      const roots = await unixInfo(bridge.socketPath, "sekret-token-value");
      assert.deepEqual(roots, ["/work/proj"]);
      assert.equal(bridge.seen.includes("GET /v1/info"), true);
      assert.equal(bridge.seen.some((line) => line.includes("sekret-token-value")), false);
      await assert.rejects(() => unixProtocolResponse(bridge.socketPath, { method: "GET", url: "zb://other/" }));
    } finally {
      await bridge.close();
    }
  });
});
