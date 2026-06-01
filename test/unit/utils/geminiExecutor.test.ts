import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { assertSafeFileReferences } from "../../../src/utils/geminiExecutor.js";

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
});

