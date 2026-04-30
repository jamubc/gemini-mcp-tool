import { appendFile } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TRACE_ENABLED = process.env.GEMINI_MCP_TRACE === "1";
const TRACE_FILE = process.env.GEMINI_MCP_TRACE_FILE || join(tmpdir(), "gemini-mcp-debug.log");
const TRACE_DEBUG = process.env.GEMINI_MCP_TRACE_DEBUG === "1";

function reportTraceError(error: unknown): void {
  if (TRACE_DEBUG) {
    console.error("[fileTrace] Failed to write trace event:", error);
  }
}

export function trace(event: string, data: Record<string, unknown> = {}): void {
  if (!TRACE_ENABLED) {
    return;
  }

  try {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      pid: process.pid,
      event,
      ...data,
    }) + "\n";

    appendFile(TRACE_FILE, line, (error) => {
      if (error) {
        reportTraceError(error);
      }
    });
  } catch (error) {
    reportTraceError(error);
  }
}
