import { appendFileSync } from "node:fs";

const TRACE_FILE = process.env.GEMINI_MCP_TRACE_FILE || "/tmp/gemini-mcp-debug.log";

export function trace(event: string, data: Record<string, unknown> = {}): void {
  try {
    appendFileSync(TRACE_FILE, JSON.stringify({
      ts: new Date().toISOString(),
      pid: process.pid,
      event,
      ...data,
    }) + "\n");
  } catch {
  }
}
