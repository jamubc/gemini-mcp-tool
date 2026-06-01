import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseChangeModeOutput,
  validateChangeModeEdits,
  type ChangeModeEdit,
} from "../../../src/utils/changeModeParser.js";

// The markdown fence is built as a plain string so the fixtures can be written
// as template literals without colliding with the backtick delimiter.
const FENCE = "```";

function block(file: string, line: number, oldCode: string, newCode: string): string {
  return [`**FILE: ${file}:${line}**`, FENCE, "OLD:", oldCode, "NEW:", newCode, FENCE].join("\n");
}

describe("Node Utilities: changeMode Parser", () => {
  test("parseChangeModeOutput parses a single markdown OLD/NEW block", () => {
    const out = parseChangeModeOutput(
      ["Here is the edit:", block("src/a.ts", 10, "const x = 1;", "const x = 2;")].join("\n\n"),
    );
    assert.equal(out.length, 1);
    const e = out[0];
    assert.equal(e.filename, "src/a.ts");
    assert.equal(e.oldStartLine, 10);
    assert.equal(e.oldEndLine, 10); // single line
    assert.equal(e.oldCode, "const x = 1;");
    assert.equal(e.newCode, "const x = 2;");
  });

  test("parseChangeModeOutput computes end lines from multi-line OLD/NEW content", () => {
    const out = parseChangeModeOutput(block("src/b.ts", 20, "foo();\nbar();", "baz();"));
    assert.equal(out.length, 1);
    const e = out[0];
    assert.equal(e.oldStartLine, 20);
    assert.equal(e.oldEndLine, 21); // two old lines: 20..21
    assert.equal(e.newStartLine, 20);
    assert.equal(e.newEndLine, 20); // one new line
    assert.equal(e.oldCode, "foo();\nbar();");
  });

  test("parseChangeModeOutput parses multiple blocks in order", () => {
    const out = parseChangeModeOutput(
      [block("a.ts", 1, "a", "A"), block("b.ts", 2, "b", "B")].join("\n\n"),
    );
    assert.equal(out.length, 2);
    assert.deepEqual(
      out.map((e) => e.filename),
      ["a.ts", "b.ts"],
    );
  });

  test("parseChangeModeOutput returns [] for empty or non-matching input", () => {
    assert.deepEqual(parseChangeModeOutput(""), []);
    assert.deepEqual(parseChangeModeOutput("just some prose with no edits"), []);
  });

  test("validateChangeModeEdits accepts well-formed edits", () => {
    const edits: ChangeModeEdit[] = [
      {
        filename: "a.ts",
        oldStartLine: 1,
        oldEndLine: 1,
        oldCode: "a",
        newStartLine: 1,
        newEndLine: 1,
        newCode: "A",
      },
    ];
    assert.deepEqual(validateChangeModeEdits(edits), { valid: true, errors: [] });
  });

  test("validateChangeModeEdits flags missing filename, inverted ranges, and empty edits", () => {
    const edits: ChangeModeEdit[] = [
      {
        filename: "",
        oldStartLine: 5,
        oldEndLine: 1, // inverted
        oldCode: "",
        newStartLine: 1,
        newEndLine: 1,
        newCode: "", // empty edit
      },
    ];
    const result = validateChangeModeEdits(edits);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => /missing filename/i.test(e)));
    assert.ok(result.errors.some((e) => /Invalid line range/i.test(e)));
    assert.ok(result.errors.some((e) => /Empty edit/i.test(e)));
  });
});

