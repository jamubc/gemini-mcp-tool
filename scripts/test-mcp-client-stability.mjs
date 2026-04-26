#!/usr/bin/env node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { CallToolResultSchema, ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js";

const iterations = Number.parseInt(process.argv[2] ?? "10", 10);
const serverPath = new URL("../dist/index.js", import.meta.url).pathname;

const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
});

transport.onerror = (error) => {
  console.error("transport error", error);
};

transport.onclose = () => {
  console.error("transport closed");
};

const client = new Client(
  { name: "gemini-mcp-stability-test", version: "1.0.0" },
  { capabilities: {} },
);

await client.connect(transport);

for (let iteration = 1; iteration <= iterations; iteration += 1) {
  const before = await client.request({ method: "tools/list" }, ListToolsResultSchema);
  if (!before.tools.some((tool) => tool.name === "ping")) {
    throw new Error(`iteration ${iteration}: ping tool missing before call`);
  }

  const result = await client.request(
    {
      method: "tools/call",
      params: {
        name: "ping",
        arguments: { prompt: `mcp-pong-${iteration}` },
      },
    },
    CallToolResultSchema,
  );

  const text = result.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n");

  if (!text.includes(`mcp-pong-${iteration}`)) {
    throw new Error(`iteration ${iteration}: unexpected ping output ${JSON.stringify(result)}`);
  }

  const after = await client.request({ method: "tools/list" }, ListToolsResultSchema);
  if (!after.tools.some((tool) => tool.name === "ping")) {
    throw new Error(`iteration ${iteration}: ping tool missing after call`);
  }

  console.error(`iteration ${iteration}: mcp ok`);
}

await client.close();
console.error(`${iterations} MCP client ping cycles completed successfully`);
