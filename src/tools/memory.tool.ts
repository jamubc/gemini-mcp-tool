import { z } from "zod";
import { UnifiedTool } from "./registry.js";
import { ERROR_MESSAGES } from "../constants.js";
import {
  saveEntry,
  getEntry,
  listEntries,
  deleteEntry,
  clearAll,
} from "../utils/memoryStore.js";

const memoryArgsSchema = z.object({
  action: z
    .enum(["store", "recall", "list", "delete", "clear"])
    .describe(
      "Operation to perform: 'store' saves a value, 'recall' retrieves it, 'list' shows all entries, 'delete' removes one, 'clear' removes all."
    ),
  key: z
    .string()
    .optional()
    .describe(
      "Identifier for the memory entry. Required for 'store', 'recall', and 'delete'. Must match ^[A-Za-z0-9._-]{1,128}$."
    ),
  content: z
    .string()
    .optional()
    .describe("Text to persist. Required for the 'store' action."),
  label: z
    .string()
    .optional()
    .describe("Optional short human-readable label for the entry."),
  tags: z
    .array(z.string())
    .optional()
    .describe("Optional list of tags for the entry."),
});

export const memoryTool: UnifiedTool = {
  name: "memory",
  description:
    "Project-scoped durable scratchpad. Persist and recall plain-text working context across context-window resets without any Gemini calls. Actions: store, recall, list, delete, clear.",
  zodSchema: memoryArgsSchema,
  category: "utility",

  execute: async (args) => {
    const { action, key, content, label, tags } = args as unknown as {
      action: "store" | "recall" | "list" | "delete" | "clear";
      key?: string;
      content?: string;
      label?: string;
      tags?: string[];
    };

    switch (action) {
      case "store": {
        if (!key || !content) {
          return `❌ ${ERROR_MESSAGES.MEMORY_CONTENT_REQUIRED}`;
        }
        saveEntry(key, content, { label, tags });
        return `✅ Stored memory entry \`${key}\` (${Buffer.byteLength(content, "utf8")} bytes).`;
      }

      case "recall": {
        if (!key) {
          return `❌ ${ERROR_MESSAGES.MEMORY_KEY_REQUIRED}`;
        }
        const entry = getEntry(key);
        if (!entry) {
          return ERROR_MESSAGES.MEMORY_RECALL_MISS(key);
        }
        const metaParts: string[] = [
          `_Updated: ${entry.meta.updatedAt}_`,
          `_Size: ${entry.meta.bytes} bytes_`,
        ];
        if (entry.meta.label) metaParts.push(`_Label: ${entry.meta.label}_`);
        if (entry.meta.tags?.length) {
          metaParts.push(`_Tags: ${entry.meta.tags.join(", ")}_`);
        }
        return `${metaParts.join(" | ")}\n\n${entry.content}`;
      }

      case "list": {
        const entries = listEntries();
        if (entries.length === 0) {
          return "The memory store is empty.";
        }
        const header = "| Key | Bytes | Updated | Label | Tags |";
        const divider = "|-----|-------|---------|-------|------|";
        const rows = entries.map((e) => {
          const label = e.label ?? "";
          const tags = e.tags?.join(", ") ?? "";
          return `| \`${e.key}\` | ${e.bytes} | ${e.updatedAt} | ${label} | ${tags} |`;
        });
        return [header, divider, ...rows].join("\n");
      }

      case "delete": {
        if (!key) {
          return `❌ ${ERROR_MESSAGES.MEMORY_KEY_REQUIRED}`;
        }
        const deleted = deleteEntry(key);
        if (!deleted) {
          return `❌ No memory entry found for key: \`${key}\`.`;
        }
        return `✅ Deleted memory entry \`${key}\`.`;
      }

      case "clear": {
        const count = clearAll();
        return `✅ Cleared ${count} memory ${count === 1 ? "entry" : "entries"}.`;
      }

      default: {
        // TypeScript exhaustiveness guard — should never be reached.
        return `❌ Unknown action: ${action}`;
      }
    }
  },
};
