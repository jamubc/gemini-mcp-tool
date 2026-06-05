import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeFileReferences,
  buildChangeModePrompt,
  inlineFileReferences,
} from "../../../src/utils/geminiExecutor.js";

const root = process.cwd();

describe("Node Utilities: Gemini CLI Executor", () => {
  test("assertSafeFileReferences allows in-project @file references", () => {
    assert.doesNotThrow(() => assertSafeFileReferences("explain @src/index.ts", root));
    assert.doesNotThrow(() => assertSafeFileReferences("no references at all", root));
    assert.doesNotThrow(() => assertSafeFileReferences("@package.json summarise", root));
  });

  test("assertSafeFileReferences rejects traversal, home, and absolute references", () => {
    assert.throws(() => assertSafeFileReferences("@../secret.txt", root), /outside the project directory/);
    assert.throws(() => assertSafeFileReferences("@~/.ssh/id_rsa", root), /outside the project directory/);
    assert.throws(() => assertSafeFileReferences("@/etc/passwd", root), /outside the project directory/);
  });

  test("buildChangeModePrompt wraps the request in the OLD/NEW template", () => {
    const out = buildChangeModePrompt("do the thing");
    assert.match(out, /\[CHANGEMODE INSTRUCTIONS\]/);
    assert.match(out, /USER REQUEST:\ndo the thing/);
  });

  test("inlineFileReferences replaces in-project refs with file contents", () => {
    const out = inlineFileReferences("see @package.json", root);
    assert.match(out, /BEGIN FILE: package\.json/);
    assert.match(out, /gemini-mcp-tool/);
    assert.doesNotMatch(out, /@package\.json/);
  });

  test("inlineFileReferences enforces the same project-root guard before reading", () => {
    assert.throws(() => inlineFileReferences("@/etc/passwd", root), /outside the project directory/);
  });

  test("inlineFileReferences marks missing files instead of leaking the token", () => {
    const out = inlineFileReferences("@does-not-exist.txt", root);
    assert.match(out, /FILE NOT FOUND: does-not-exist\.txt/);
  });
});

