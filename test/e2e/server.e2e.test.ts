import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { callTool, listPrompts, listTools, rawResponse, startServer, textOf, type ServerHandle } from "./harness.js";

// Server + protocol + the tools that do NOT need the gemini CLI. These run
// anywhere the project is built, with no gemini install or network.
let server: ServerHandle;

before(async () => {
  server = await startServer();
});
after(async () => {
  await server?.close();
});

describe("MCP Protocol E2E: Server Lifecycle & System Tools", () => {
  test("lists every registered tool with a valid input schema", async (t) => {
    const { tools } = await listTools(t, server);
    const names = tools.map((t) => t.name);
    for (const expected of ["ask-gemini", "brainstorm", "fetch-chunk", "ping", "Help"]) {
      assert.ok(names.includes(expected), `tools/list is missing "${expected}" (got: ${names.join(", ")})`);
    }
    const ask = tools.find((t) => t.name === "ask-gemini");
    assert.ok(ask);
    assert.equal(ask!.inputSchema.type, "object");
  });

  test("lists prompts derived from the registry", async (t) => {
    const { prompts } = await listPrompts(t, server);
    assert.ok(prompts.map((p) => p.name).includes("ask-gemini"));
  });

  test("ping echoes a message back over the full MCP round-trip", async (t) => {
    const res = await callTool(t, server, { name: "ping", arguments: { prompt: "hello-e2e" } });
    assert.equal(res.isError ?? false, false);
    assert.match(textOf(res), /hello-e2e/);
  });

  test("fetch-chunk returns a clean cache-miss message for an unknown key", async (t) => {
    const res = await callTool(t, server, {
      name: "fetch-chunk",
      arguments: { cacheKey: "00000000", chunkIndex: 1 },
    });
    assert.equal(res.isError ?? false, false);
    assert.match(textOf(res), /Cache miss/);
  });

  test("an unknown tool name is reported as an error", async (t) => {
    await assert.rejects(async () => {
      try {
        await server.client.callTool({ name: "not-a-real-tool", arguments: {} });
      } catch (error) {
        rawResponse(t, "tools/call not-a-real-tool thrown response", error);
        throw error;
      }
    });
  });
});

