import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quoteForCmd,
  resolveCommandForExecution,
  buildEnoentErrorMessage,
} from "./commandExecutor.js";

test("quoteForCmd wraps in double quotes and doubles embedded quotes", () => {
  assert.equal(quoteForCmd("hello"), '"hello"');
  assert.equal(quoteForCmd("a&calc"), '"a&calc"'); // cmd metachar made inert by quoting
  assert.equal(quoteForCmd('a"b'), '"a""b"');
});

test("quoteForCmd doubles a trailing backslash so it can't escape the closing quote", () => {
  assert.equal(quoteForCmd("path\\"), '"path\\\\"');
});

test("resolveCommandForExecution is a no-op off Windows", () => {
  if (process.platform !== "win32") {
    assert.equal(resolveCommandForExecution("gemini"), "gemini");
    assert.equal(resolveCommandForExecution("echo"), "echo");
  } else {
    // On Windows it should at least never return an empty string.
    assert.ok(resolveCommandForExecution("gemini").length > 0);
  }
});

test("buildEnoentErrorMessage gives gemini-specific, platform-aware guidance", () => {
  const msg = buildEnoentErrorMessage("gemini");
  assert.match(msg, /Could not find the "gemini"/);
  assert.match(msg, /GEMINI_CLI_PATH/);
  assert.match(msg, /@google\/gemini-cli/);
  assert.match(msg, process.platform === "win32" ? /where gemini/ : /which gemini/);
});

test("buildEnoentErrorMessage omits the gemini install hint for other commands", () => {
  const msg = buildEnoentErrorMessage("agy");
  assert.match(msg, /Could not find the "agy"/);
  assert.doesNotMatch(msg, /@google\/gemini-cli/);
});
