import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatChangeModeResponse,
  summarizeChangeModeEdits,
} from "../../../src/utils/changeModeTranslator.js";
import type { ChangeModeEdit } from "../../../src/utils/changeModeParser.js";

function edit(filename: string, oldCode: string, newCode: string): ChangeModeEdit {
  return {
    filename,
    oldStartLine: 1,
    oldEndLine: 1,
    oldCode,
    newStartLine: 1,
    newEndLine: 1,
    newCode,
  };
}

describe("Node Utilities: changeMode Translator", () => {
  test("formatChangeModeResponse renders a single-chunk response with the exact code", () => {
    const out = formatChangeModeResponse([edit("a.ts", "OLD_CODE", "NEW_CODE")]);
    assert.match(out, /CHANGEMODE OUTPUT/);
    assert.match(out, /1 modification\b/); // singular
    assert.match(out, /Replace this exact text:/);
    assert.ok(out.includes("OLD_CODE"));
    assert.ok(out.includes("NEW_CODE"));
    assert.match(out, /Apply these edits in order/);
  });

  test("formatChangeModeResponse pluralizes the modification count", () => {
    const out = formatChangeModeResponse([edit("a.ts", "1", "1"), edit("b.ts", "2", "2")]);
    assert.match(out, /2 modifications\b/);
  });

  test("formatChangeModeResponse emits chunk headers and a fetch-chunk continuation", () => {
    const out = formatChangeModeResponse([edit("a.ts", "x", "y")], {
      current: 1,
      total: 3,
      cacheKey: "abcd1234",
    });
    assert.match(out, /Chunk 1 of 3/);
    assert.ok(out.includes('fetch-chunk cacheKey="abcd1234" chunkIndex=2'));
    assert.match(out, /2 more chunks/);
  });

  test("formatChangeModeResponse omits the continuation on the final chunk", () => {
    const out = formatChangeModeResponse([edit("a.ts", "x", "y")], {
      current: 3,
      total: 3,
      cacheKey: "abcd1234",
    });
    assert.match(out, /Chunk 3 of 3/);
    assert.doesNotMatch(out, /fetch-chunk cacheKey/);
  });

  test("summarizeChangeModeEdits counts edits and affected files", () => {
    const summary = summarizeChangeModeEdits([
      edit("a.ts", "1", "1"),
      edit("a.ts", "2", "2"),
      edit("b.ts", "3", "3"),
    ]);
    assert.match(summary, /Total edits: 3/);
    assert.match(summary, /Files affected: 2/);
    assert.match(summary, /- a\.ts: 2 edits/);
    assert.match(summary, /- b\.ts: 1 edit\b/);
  });

  test("summarizeChangeModeEdits marks the partial (multi-chunk) view", () => {
    const summary = summarizeChangeModeEdits([edit("a.ts", "1", "1")], true);
    assert.match(summary, /across all chunks/);
  });
});

